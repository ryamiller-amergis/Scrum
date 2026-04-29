/**
 * Fetches a lightweight design-system catalog from the MaxView ADO repository:
 *   - Page routes (React Router routes scraped from App.tsx / routes file)
 *   - CSS design tokens (custom properties from App.css / variables)
 *   - Component index (names + descriptions from src/components)
 *   - Component descriptions (leading JSDoc from each .tsx file, max 200 chars)
 *   - Route layout hints (heuristic layout pattern per route, e.g. "table", "calendar")
 *
 * Results are cached for CATALOG_TTL_MS (10 minutes) so repeated backlog-mock
 * requests don't hammer ADO.
 */

import https from 'https';

/* ── Config ───────────────────────────────────────────────── */

const DS_REPO    = process.env.MAXVIEW_DS_REPO    ?? 'MaxView';
const DS_PROJECT = process.env.MAXVIEW_DS_PROJECT ?? 'MaxView';
const CATALOG_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Path to the UI knowledge base that describes each existing MaxView screen. */
const UI_KNOWLEDGE_BASE_PATH = '/.cursor/skills/figma-ui-knowledge-base/SKILL.md';

/** Candidate paths tried in order; first non-empty wins. */
const ROUTE_PATHS = [
  '/src/client/App.tsx',
  '/src/App.tsx',
  '/App.tsx',
];

const TOKEN_PATHS = [
  '/src/client/App.css',
  '/src/client/index.css',
  '/src/App.css',
  '/src/index.css',
];

const COMPONENT_INDEX_PATHS = [
  '/src/client/components',
  '/src/components',
];

/* ── Types ────────────────────────────────────────────────── */

export interface PageRoute {
  path: string;
  title: string;
}

export interface DesignSystemCatalog {
  routes: PageRoute[];
  tokensCss: string;        // raw CSS :root block(s)
  componentNames: string[]; // e.g. ["ScrumCalendar", "BacklogView", …]
  /** Raw markdown from /.cursor/skills/figma-ui-knowledge-base/SKILL.md describing each existing screen */
  uiKnowledgeBase: string;
  /** Short descriptions extracted from each component's leading JSDoc comment (≤ 200 chars each). */
  componentDescriptions: Record<string, string>;
  /** Heuristic layout pattern per route, e.g. { "/shift-scheduler": "calendar", "/timecards": "table" } */
  routeLayoutHints: Record<string, string>;
  fetchedAt: number;
}

/* ── Cache ────────────────────────────────────────────────── */

let catalogCache: DesignSystemCatalog | null = null;

/* ── ADO file fetch helper ────────────────────────────────── */

function fetchAdoFile(orgUrl: string, pat: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = Buffer.from(`:${pat}`).toString('base64');
    const encodedPath = encodeURIComponent(path);
    const apiUrl = new URL(
      `${orgUrl}/${DS_PROJECT}/_apis/git/repositories/${DS_REPO}/items?path=${encodedPath}&api-version=7.1&$format=text`
    );
    const options: https.RequestOptions = {
      hostname: apiUrl.hostname,
      path: apiUrl.pathname + apiUrl.search,
      method: 'GET',
      headers: { Authorization: `Basic ${token}`, Accept: 'text/plain' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`ADO ${res.statusCode} for ${path}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error(`Timeout: ${path}`)); });
    req.end();
  });
}

/** Fetch ADO git tree listing for a folder path (returns item paths). */
function fetchAdoTree(orgUrl: string, pat: string, folderPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const token = Buffer.from(`:${pat}`).toString('base64');
    const encodedPath = encodeURIComponent(folderPath);
    const apiUrl = new URL(
      `${orgUrl}/${DS_PROJECT}/_apis/git/repositories/${DS_REPO}/items?path=${encodedPath}&recursionLevel=OneLevel&api-version=7.1`
    );
    const options: https.RequestOptions = {
      hostname: apiUrl.hostname,
      path: apiUrl.pathname + apiUrl.search,
      method: 'GET',
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data) as { value?: Array<{ path: string }> };
            resolve((json.value ?? []).map(i => i.path));
          } catch {
            resolve([]);
          }
        } else {
          reject(new Error(`ADO tree ${res.statusCode} for ${folderPath}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error(`Timeout tree: ${folderPath}`)); });
    req.end();
  });
}

/* ── Parsers ──────────────────────────────────────────────── */

/**
 * Extract React Router <Route path="…"> entries from App.tsx source.
 * Also picks up navigate('/foo') and pathname.startsWith('/foo') patterns
 * to capture dynamic navigation targets.
 */
function parseRoutes(src: string): PageRoute[] {
  const routes: PageRoute[] = [];
  const seen = new Set<string>();

  const add = (path: string, title: string) => {
    if (!seen.has(path)) { seen.add(path); routes.push({ path, title }); }
  };

  // pathname.startsWith('/foo') or pathname === '/foo'
  for (const m of src.matchAll(/pathname(?:\.startsWith\(['"])?(\/[^'")\s]+)/g)) {
    add(m[1], m[1]);
  }

  // navigate('/foo')
  for (const m of src.matchAll(/navigate\(['"](\/?[^'"]+)['"]\)/g)) {
    add(m[1], m[1]);
  }

  // <Route path="/foo" element={…} />  or  path: '/foo'
  for (const m of src.matchAll(/path[=:]\s*['"](\/?[^'"]+)['"]/g)) {
    add(m[1], m[1]);
  }

  // currentView string literals
  for (const m of src.matchAll(/currentView[^'"]*?['"](calendar|planning|cloudcost|backlog|[a-z-]+)['"]/g)) {
    add(`/${m[1]}`, m[1]);
  }

  return routes;
}

/**
 * Extract :root { --variable: value } blocks from CSS.
 * Truncates to 4 KB so the prompt stays manageable.
 */
function parseTokens(css: string): string {
  const matches: string[] = [];
  for (const m of css.matchAll(/:root\s*\{([^}]+)\}/g)) {
    matches.push(`:root {\n${m[1]}\n}`);
  }
  const joined = matches.join('\n\n');
  return joined.length > 4096 ? joined.slice(0, 4096) + '\n/* …truncated… */' : joined;
}

/**
 * Resolve a relative path against a base ADO file path.
 * e.g. base = "/.cursor/skills/figma-ui-knowledge-base/SKILL.md"
 *      ref  = "./screens/document-manager.md"
 *      →     "/.cursor/skills/figma-ui-knowledge-base/screens/document-manager.md"
 */
function resolveAdoPath(basePath: string, ref: string): string {
  // External URLs are not ADO paths — skip them
  if (/^https?:\/\//.test(ref)) return '';

  const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));

  // Strip leading "./" for simplicity
  const clean = ref.startsWith('./') ? ref.slice(2) : ref;

  // Handle "../" traversal
  const parts = `${baseDir}/${clean}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') { resolved.pop(); }
    else if (part !== '.') { resolved.push(part); }
  }
  return resolved.join('/');
}

/**
 * Parse markdown for file references: [label](./relative-path.md)
 * Only returns refs that point to markdown files (.md / .mdx).
 * Ignores anchors (#section), external URLs, and non-markdown files.
 */
function parseMarkdownFileRefs(markdown: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const href = m[2].split('#')[0].trim(); // strip anchor fragments
    if (!href || /^https?:\/\//.test(href)) continue;
    if (!href.endsWith('.md') && !href.endsWith('.mdx')) continue;
    if (!seen.has(href)) { seen.add(href); refs.push(href); }
  }
  return refs;
}

/**
 * Fetch the SKILL.md knowledge base plus any .md files it references inline.
 * Referenced file content is appended after the root file, separated by headers.
 * Depth is limited to 1 level — references within referenced files are not followed.
 */
async function fetchUiKnowledgeBase(orgUrl: string, pat: string): Promise<string> {
  let root = '';
  try {
    root = await fetchAdoFile(orgUrl, pat, UI_KNOWLEDGE_BASE_PATH);
  } catch (e: any) {
    console.warn(`[designSystemService] ui-knowledge-base: could not fetch ${UI_KNOWLEDGE_BASE_PATH} — ${e.message}`);
    return '';
  }

  const refs = parseMarkdownFileRefs(root);
  if (refs.length === 0) return root;

  // Fetch all referenced files in parallel; failures are non-fatal
  const fetched = await Promise.allSettled(
    refs.map(async (ref) => {
      const adoPath = resolveAdoPath(UI_KNOWLEDGE_BASE_PATH, ref);
      if (!adoPath) return null;
      const content = await fetchAdoFile(orgUrl, pat, adoPath);
      return { ref, adoPath, content };
    })
  );

  const sections: string[] = [root];
  for (const result of fetched) {
    if (result.status === 'fulfilled' && result.value?.content?.trim()) {
      const { adoPath, content } = result.value;
      const name = adoPath.split('/').pop() ?? adoPath;
      sections.push(`\n---\n<!-- ${name} -->\n\n${content.trim()}`);
      console.log(`[designSystemService] ui-knowledge-base: loaded referenced file ${adoPath}`);
    } else if (result.status === 'rejected') {
      console.warn(`[designSystemService] ui-knowledge-base: could not fetch referenced file — ${result.reason}`);
    }
  }

  return sections.join('\n');
}

/**
 * Convert ADO file paths under /src/client/components to component names.
 * e.g. "/src/client/components/BacklogView.tsx" → "BacklogView"
 */
function pathsToComponentNames(paths: string[]): string[] {
  return paths
    .filter(p => (p.endsWith('.tsx') || p.endsWith('.ts')) && !p.includes('.css') && !p.includes('__tests__') && !p.includes('.module.'))
    .map(p => {
      const base = p.split('/').pop() ?? p;
      return base.replace(/\.(tsx?|jsx?)$/, '');
    })
    .filter(n => n.length > 0 && /^[A-Z]/.test(n)); // exported components start with uppercase
}

/**
 * Extract the first JSDoc-style comment from a TypeScript source file.
 * Returns the comment text stripped of leading `* ` markers, truncated to 200 chars.
 */
function extractLeadingJsDoc(src: string): string {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return '';
  const text = m[1]
    .split('\n')
    .map(l => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

/**
 * Infer a rough layout pattern from a component file's source.
 * Returns one of the UiLayoutPattern string literals, or empty string when unknown.
 */
function inferLayoutPattern(src: string): string {
  if (/react-big-calendar|BigCalendar|FullCalendar|CalendarView/i.test(src)) return 'calendar';
  if (/<table|mwx-table-wrap|DataTable/i.test(src)) return 'table';
  if (/Dashboard|stat-value|grid-3|KpiCard/i.test(src)) return 'dashboard';
  if (/<form|useForm|FormField|\.form-row/i.test(src)) return 'form';
  if (/detail-layout|detail-main|detail-side/i.test(src)) return 'detail-page';
  if (/wizard|step-by-step|WizardStep/i.test(src)) return 'wizard';
  return '';
}

/**
 * Fetch component source files in parallel and extract descriptions + layout hints.
 * At most 20 files are fetched to stay within the ADO rate limit.
 */
async function fetchComponentDetails(
  orgUrl: string,
  pat: string,
  componentPaths: string[]
): Promise<{ descriptions: Record<string, string>; layoutHints: Record<string, string> }> {
  const descriptions: Record<string, string> = {};
  const layoutHints: Record<string, string> = {};

  // Filter to component .tsx files only and cap at 20
  const targets = componentPaths
    .filter(p => p.endsWith('.tsx') && !p.includes('__tests__') && !p.includes('.module.'))
    .slice(0, 20);

  const results = await Promise.allSettled(
    targets.map(p => fetchAdoFile(orgUrl, pat, p).then(src => ({ path: p, src })))
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { path, src } = result.value;
    const base = path.split('/').pop() ?? path;
    const name = base.replace(/\.tsx?$/, '');
    if (!name || !/^[A-Z]/.test(name)) continue;

    const desc = extractLeadingJsDoc(src);
    if (desc) descriptions[name] = desc;

    const layout = inferLayoutPattern(src);
    if (layout) layoutHints[name] = layout;
  }

  return { descriptions, layoutHints };
}

/**
 * Build route → layout hints by matching route paths to component names.
 * e.g. "/shift-scheduler" → component ScrumCalendar → "calendar"
 */
function buildRouteLayoutHints(
  routes: PageRoute[],
  componentLayoutHints: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const route of routes) {
    // Normalise the route path to a camelCase or PascalCase component name guess
    const slug = route.path.replace(/^\//, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascalSlug = slug.charAt(0).toUpperCase() + slug.slice(1);

    // Find a component whose name contains the slug (partial match)
    const matchingEntry = Object.entries(componentLayoutHints).find(([name]) =>
      name.toLowerCase().includes(slug.toLowerCase()) || name.toLowerCase().includes(pascalSlug.toLowerCase())
    );
    if (matchingEntry) {
      result[route.path] = matchingEntry[1];
    }
  }
  return result;
}

/* ── Main export ──────────────────────────────────────────── */

export async function getDesignSystemCatalog(): Promise<DesignSystemCatalog> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return catalogCache;
  }

  const orgUrl = process.env.ADO_ORG;
  const pat    = process.env.ADO_PAT;

  if (!orgUrl || !pat) {
    console.warn('[designSystemService] ADO_ORG or ADO_PAT not set — returning empty catalog');
    return { routes: [], tokensCss: '', componentNames: [], uiKnowledgeBase: '', componentDescriptions: {}, routeLayoutHints: {}, fetchedAt: now };
  }

  /* ── Routes ── */
  let routes: PageRoute[] = [];
  for (const p of ROUTE_PATHS) {
    try {
      const src = await fetchAdoFile(orgUrl, pat, p);
      if (src.trim()) { routes = parseRoutes(src); break; }
    } catch (e: any) {
      console.warn(`[designSystemService] routes: skipping ${p} — ${e.message}`);
    }
  }

  /* ── Tokens ── */
  let tokensCss = '';
  for (const p of TOKEN_PATHS) {
    try {
      const css = await fetchAdoFile(orgUrl, pat, p);
      if (css.trim()) { tokensCss = parseTokens(css); break; }
    } catch (e: any) {
      console.warn(`[designSystemService] tokens: skipping ${p} — ${e.message}`);
    }
  }

  /* ── Component names + descriptions + layout hints ── */
  let componentNames: string[] = [];
  let componentDescriptions: Record<string, string> = {};
  let componentLayoutHints: Record<string, string> = {};

  for (const folder of COMPONENT_INDEX_PATHS) {
    try {
      const paths = await fetchAdoTree(orgUrl, pat, folder);
      componentNames = pathsToComponentNames(paths);
      if (componentNames.length > 0) {
        // Fetch source for component details (non-fatal)
        try {
          const componentFilePaths = paths.filter(
            p => p.endsWith('.tsx') && !p.includes('__tests__') && !p.includes('.module.')
          );
          const details = await fetchComponentDetails(orgUrl, pat, componentFilePaths);
          componentDescriptions = details.descriptions;
          componentLayoutHints = details.layoutHints;
        } catch (e: any) {
          console.warn(`[designSystemService] component details: skipping — ${e.message}`);
        }
        break;
      }
    } catch (e: any) {
      console.warn(`[designSystemService] components: skipping ${folder} — ${e.message}`);
    }
  }

  /* ── Route layout hints (derived from component layout hints) ── */
  const routeLayoutHints = buildRouteLayoutHints(routes, componentLayoutHints);

  /* ── UI Knowledge Base (SKILL.md + any referenced .md files) ── */
  const uiKnowledgeBase = await fetchUiKnowledgeBase(orgUrl, pat);

  const catalog: DesignSystemCatalog = {
    routes,
    tokensCss,
    componentNames,
    uiKnowledgeBase,
    componentDescriptions,
    routeLayoutHints,
    fetchedAt: now,
  };
  catalogCache = catalog;

  console.log(
    `[designSystemService] Catalog loaded — ${routes.length} routes, ${componentNames.length} components, ` +
    `${Object.keys(componentDescriptions).length} descriptions, ${Object.keys(routeLayoutHints).length} layout hints, ` +
    `${tokensCss.length} chars of tokens, ui-kb: ${uiKnowledgeBase.length} chars`
  );

  return catalog;
}

/** Force-clear the catalog cache (useful in tests). */
export function clearDesignSystemCache(): void {
  catalogCache = null;
}
