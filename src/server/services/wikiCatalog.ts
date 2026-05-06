import * as azdev from 'azure-devops-node-api';
import type { WikiInfo, WikiPage, SaveWikiPageRequest, SaveWikiPageResult } from '../../shared/types/skills';

const ORG_URL = process.env.ADO_ORG || '';
const PAT = process.env.ADO_PAT || '';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

function makeCache<T>() {
  const map = new Map<string, CacheEntry<T>>();
  return {
    get(key: string): T | null {
      const entry = map.get(key);
      if (!entry || Date.now() > entry.expiresAt) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    },
    invalidate(key: string) {
      map.delete(key);
    },
  };
}

const wikiCache = makeCache<WikiInfo[]>();
const pageCache = makeCache<WikiPage>();

function getBaseUrl(): string {
  return ORG_URL.replace(/\/$/, '');
}

function getHeaders(): Record<string, string> {
  const token = Buffer.from(`:${PAT}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/** ADO Wiki REST API doesn't have great SDK coverage — use REST directly. */
async function adoFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ADO API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch that also returns the response ETag header.
 * Returns null (instead of throwing) on 404.
 */
async function adoFetchWithEtag(
  url: string,
  options?: RequestInit,
): Promise<{ data: any; etag: string | null } | null> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ADO API ${res.status}: ${body.slice(0, 300)}`);
  }

  const etag = res.headers.get('ETag');
  const data = await res.json();
  return { data, etag };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function listWikis(project: string): Promise<WikiInfo[]> {
  const cacheKey = `wikis:${project}`;
  const cached = wikiCache.get(cacheKey);
  if (cached) return cached;

  const base = getBaseUrl();
  const url = `${base}/${project}/_apis/wiki/wikis?api-version=7.1`;

  const data = await adoFetch<{ value: any[] }>(url);

  const result: WikiInfo[] = (data.value ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type === 'codeWiki' ? 'codeWiki' : 'projectWiki',
    project,
    mappedPath: w.mappedPath,
    remoteUrl: w.remoteUrl,
  }));

  wikiCache.set(cacheKey, result);
  return result;
}

export async function getWikiPage(
  project: string,
  wikiId: string,
  pagePath: string,
  includeContent = true,
): Promise<WikiPage> {
  const cacheKey = `page:${project}:${wikiId}:${pagePath}`;
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const base = getBaseUrl();
  const encodedPath = encodeURIComponent(pagePath);
  const url = `${base}/${project}/_apis/wiki/wikis/${wikiId}/pages?path=${encodedPath}&includeContent=${includeContent}&api-version=7.1`;

  const data = await adoFetch<any>(url);

  const result: WikiPage = {
    id: data.id,
    path: data.path,
    content: data.content ?? '',
    gitItemPath: data.gitItemPath,
    url: data.url,
    remoteUrl: data.remoteUrl,
    order: data.order,
    isParentPage: data.isParentPage,
  };

  pageCache.set(cacheKey, result);
  return result;
}

export async function listWikiPages(
  project: string,
  wikiId: string,
  path = '/',
): Promise<WikiPage[]> {
  const base = getBaseUrl();
  const encodedPath = encodeURIComponent(path);
  const url = `${base}/${project}/_apis/wiki/wikis/${wikiId}/pages?path=${encodedPath}&recursionLevel=oneLevel&api-version=7.1`;

  const data = await adoFetch<any>(url);

  const pages: WikiPage[] = [
    {
      path: data.path,
      content: '',
      order: data.order,
      isParentPage: data.isParentPage,
      subPages: (data.subPages ?? []).map((sp: any) => ({
        path: sp.path,
        content: '',
        order: sp.order,
        isParentPage: sp.isParentPage,
      })),
    },
  ];

  return pages;
}

/**
 * Ensure every ancestor of `path` exists as a wiki page.
 * ADO returns 404 on a child PUT when the parent page doesn't exist yet.
 * We walk up the tree and create any missing parents with placeholder content.
 */
async function ensureParentPages(
  project: string,
  wikiId: string,
  path: string,
): Promise<void> {
  const base = getBaseUrl();

  // Build the list of ancestor paths, outermost first.
  // e.g. "/scrum-app-requirement/prd" → ["/scrum-app-requirement"]
  const segments = path.split('/').filter(Boolean); // ['scrum-app-requirement', 'prd']
  if (segments.length <= 1) return; // root-level page, no parent needed

  const ancestors = segments.slice(0, -1).map((_, i) =>
    '/' + segments.slice(0, i + 1).join('/'),
  );

  for (const ancestorPath of ancestors) {
    const encodedPath = encodeURIComponent(ancestorPath);
    const pageUrl = `${base}/${project}/_apis/wiki/wikis/${wikiId}/pages?path=${encodedPath}&api-version=7.1`;

    const existing = await adoFetchWithEtag(`${pageUrl}&includeContent=false`);
    if (existing) continue; // already exists

    // Create the ancestor with minimal placeholder content
    const pageName = ancestorPath.split('/').pop() ?? ancestorPath;
    await adoFetchWithEtag(pageUrl, {
      method: 'PUT',
      body: JSON.stringify({
        content: `# ${pageName}\n`,
        comment: 'AI-Pilot: parent page auto-created',
      }),
      // No If-Match → creates new page
    });
  }
}

export async function saveWikiPage(req: SaveWikiPageRequest): Promise<SaveWikiPageResult> {
  const base = getBaseUrl();
  const encodedPath = encodeURIComponent(req.path);
  const pageUrl = `${base}/${req.project}/_apis/wiki/wikis/${req.wikiId}/pages?path=${encodedPath}&api-version=7.1`;

  // Ensure every ancestor page exists before writing the target page.
  // ADO returns 404 on PUT when the parent doesn't exist yet.
  await ensureParentPages(req.project, req.wikiId, req.path);

  // Resolve the current ETag so we can decide create vs. update.
  // ADO Wiki API:
  //   - Create (page does not exist): PUT with NO If-Match header
  //   - Update (page exists):         PUT with If-Match: <current ETag>
  let ifMatch: string | null = req.version ?? null;

  if (!ifMatch) {
    const existing = await adoFetchWithEtag(`${pageUrl}&includeContent=false`);
    if (existing) {
      ifMatch = existing.etag ?? existing.data?.eTag ?? null;
    }
  }

  const saveHeaders: Record<string, string> = {};
  if (ifMatch) {
    saveHeaders['If-Match'] = ifMatch;
  }

  const result = await adoFetchWithEtag(pageUrl, {
    method: 'PUT',
    body: JSON.stringify({
      content: req.content,
      comment: req.comment ?? 'AI-Pilot: PRD saved via chat agent',
    }),
    headers: saveHeaders,
  });

  if (!result) {
    throw new Error(
      `Failed to save wiki page at "${req.path}". ` +
      `The parent path may not be accessible or the wiki ID is incorrect.`,
    );
  }

  // Invalidate page cache so next read gets fresh content
  pageCache.invalidate(`page:${req.project}:${req.wikiId}:${req.path}`);

  const browserUrl =
    result.data?.page?.remoteUrl ||
    result.data?.remoteUrl ||
    `${base}/${encodeURIComponent(req.project)}/_wiki/wikis/${encodeURIComponent(req.wikiId)}?pagePath=${encodeURIComponent(req.path)}`;

  return {
    path: result.data?.page?.path ?? req.path,
    url: browserUrl,
    version: result.etag ?? result.data?.eTag ?? '',
  };
}
