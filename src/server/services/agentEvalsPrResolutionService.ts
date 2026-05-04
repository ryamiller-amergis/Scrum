/**
 * Loads PR resolution metrics from MaxView Git (agent-evals run folders),
 * resolves PR authors via AzureDevOpsService, and aggregates per developer.
 */

import https from 'https';
import type { PrResolutionMetricFileRow, PrResolutionMetricsCategoryBucket, PrResolutionMetricsStats } from '../types/workitem';
import { AzureDevOpsService } from './azureDevOps';

const DS_REPO = process.env.MAXVIEW_DS_REPO ?? 'MaxView';
const DS_PROJECT = process.env.MAXVIEW_DS_PROJECT ?? 'MaxView';
const DEFAULT_RUNS_BASE = '/agent-evals/runs';
const MAX_METRIC_FILES = 500;
const FETCH_CONCURRENCY = 5;

/**
 * Returns true for any agent-evals resolution metric filename we want to ingest:
 *
 *   pr-resolution[-*].json          canonical / dated / run / PR-specific variants
 *   pre-resolution[-*].json         legacy typo variants
 *   pr-review-{numericId}-{YYYY-MM-DD}.json   dated review artifacts
 *
 * Rejected: wrong extension, missing prefix, backup files, non-numeric PR id,
 * non-date suffix in pr-review pattern, unrelated prefixes like "preflight-".
 */
export const isMetricFilename = (name: string): boolean => {
  // pr-resolution-*.json or pre-resolution-*.json — no dots allowed in the variant suffix
  if (/^(?:pr|pre)-resolution[^.]*\.json$/i.test(name)) return true;
  // pr-review-{numericPrId}-{YYYY-MM-DD}.json
  if (/^pr-review-\d+-\d{4}-\d{2}-\d{2}\.json$/i.test(name)) return true;
  return false;
};

function fetchAdoFile(orgUrl: string, pat: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = Buffer.from(`:${pat}`).toString('base64');
    const encodedPath = encodeURIComponent(path);
    const apiUrl = new URL(
      `${orgUrl.replace(/\/$/, '')}/${encodeURIComponent(DS_PROJECT)}/_apis/git/repositories/${encodeURIComponent(DS_REPO)}/items?path=${encodedPath}&api-version=7.1&$format=text`
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
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout: ${path}`));
    });
    req.end();
  });
}

function fetchAdoTree(orgUrl: string, pat: string, folderPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const token = Buffer.from(`:${pat}`).toString('base64');
    const encodedPath = encodeURIComponent(folderPath);
    const apiUrl = new URL(
      `${orgUrl.replace(/\/$/, '')}/${encodeURIComponent(DS_PROJECT)}/_apis/git/repositories/${encodeURIComponent(DS_REPO)}/items?scopePath=${encodedPath}&recursionLevel=Full&includeContentMetadata=true&api-version=7.1`
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
          reject(new Error(`ADO tree ${res.statusCode} for ${folderPath}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout tree: ${folderPath}`));
    });
    req.end();
  });
}

function normalizeBasePath(p: string): string {
  const t = p.trim() || DEFAULT_RUNS_BASE;
  return t.startsWith('/') ? t : `/${t}`;
}

export function isValidMetricRow(row: unknown): row is PrResolutionMetricFileRow {
  return normalizeMetricRow(row) !== null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Extract a prId as a number from a raw value that may be a string or number. */
function parsePrId(value: unknown): number | null {
  const n = getNumber(value);
  return n !== null && n > 0 ? Math.round(n) : null;
}

/** Resolve any of the date-field variants the files have used. */
function parseDate(r: Record<string, unknown>): string | null {
  for (const key of ['date', 'sessionDate', 'reviewedAt', 'reviewDate', 'timestamp'] as const) {
    const v = r[key];
    if (typeof v === 'string' && v.length >= 10) {
      return v.slice(0, 10);
    }
  }
  return null;
}

interface ByCategoryTotals { total: number; accepted: number; wontfix: number; snoozed: number }

/** Sum accepted/wontfix/snoozed across all byCategory buckets. */
function sumFromByCategory(r: Record<string, unknown>): ByCategoryTotals | null {
  const bc = r.byCategory;
  if (!bc || typeof bc !== 'object' || Array.isArray(bc)) return null;
  let accepted = 0; let wontfix = 0; let snoozed = 0; let hasAny = false;
  for (const bucket of Object.values(bc as Record<string, unknown>)) {
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
    const b = bucket as Record<string, unknown>;
    accepted += getNumber(b.accepted) ?? 0;
    wontfix  += getNumber(b.wontfix) ?? getNumber(b.wontFix) ?? getNumber(b.rejected) ?? 0;
    snoozed  += getNumber(b.snoozed) ?? 0;
    hasAny = true;
  }
  return hasAny ? { total: accepted + wontfix + snoozed, accepted, wontfix, snoozed } : null;
}

/** Resolve any of the total-field variants. Falls back to summing byCategory buckets. */
function parseTotal(r: Record<string, unknown>, bcTotals: ByCategoryTotals | null): number | null {
  for (const key of ['total', 'totalThreads', 'totalReviewed']) {
    const n = getNumber(r[key]);
    if (n !== null) return n;
  }
  return bcTotals ? bcTotals.total : null;
}

/** Resolve the wontfix count — field may be 'wontfix', 'wontFix', or 'rejected'. */
function parseWontfix(r: Record<string, unknown>): number | null {
  return getNumber(r.wontfix) ?? getNumber((r as Record<string, unknown>).wontFix) ?? getNumber(r.rejected);
}

function normalizeCategory(
  byCategory: unknown,
): PrResolutionMetricFileRow['byCategory'] {
  if (!byCategory || typeof byCategory !== 'object' || Array.isArray(byCategory)) return undefined;
  const normalized: PrResolutionMetricFileRow['byCategory'] = {};
  for (const [category, rawBucket] of Object.entries(byCategory as Record<string, unknown>)) {
    if (!rawBucket || typeof rawBucket !== 'object' || Array.isArray(rawBucket)) continue;
    const bucket = rawBucket as Record<string, unknown>;
    const accepted = getNumber(bucket.accepted) ?? 0;
    const wontfix = getNumber(bucket.wontfix) ?? getNumber(bucket.wontFix) ?? getNumber(bucket.rejected) ?? 0;
    const snoozed = getNumber(bucket.snoozed) ?? 0;
    normalized[category] = {
      total: getNumber(bucket.total) ?? accepted + wontfix + snoozed,
      accepted,
      wontfix,
      snoozed,
    };
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeMetricRow(row: unknown): PrResolutionMetricFileRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const prId = parsePrId(r.prId);
  const date = parseDate(r);
  if (prId === null || !date) return null;

  // Compute byCategory sums first — used as fallback for any missing top-level fields
  const bcTotals = sumFromByCategory(r);

  const accepted = getNumber(r.accepted) ?? bcTotals?.accepted ?? 0;
  const wontfix  = parseWontfix(r)       ?? bcTotals?.wontfix  ?? 0;
  const snoozed  = getNumber(r.snoozed)  ?? bcTotals?.snoozed  ?? 0;
  const total    = parseTotal(r, bcTotals) ?? accepted + wontfix + snoozed;

  const timestamp = (() => {
    const v = r.timestamp;
    return typeof v === 'string' && v.length > 10 ? v : undefined;
  })();

  return {
    prId,
    date,
    timestamp,
    total,
    accepted,
    wontfix,
    snoozed,
    acceptanceRate: getNumber(r.acceptanceRate) ??
      (total > 0 ? Math.round((accepted / total) * 1000) / 1000 : 0),
    byCategory: normalizeCategory(r.byCategory),
  };
}

/** Dedupe exact snapshots; timestamped rows from the same PR/day are distinct events. */
export function dedupePrResolutionMetricRows(rows: PrResolutionMetricFileRow[]): PrResolutionMetricFileRow[] {
  const seen = new Set<string>();
  const out: PrResolutionMetricFileRow[] = [];
  for (const r of rows) {
    const key = [
      r.prId,
      r.timestamp ?? r.date,
      r.total,
      r.accepted,
      r.wontfix,
      r.snoozed,
      JSON.stringify(r.byCategory ?? {}),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function filterRowsByDateRange(
  rows: PrResolutionMetricFileRow[],
  from?: string,
  to?: string,
): PrResolutionMetricFileRow[] {
  const fromD = from?.trim() || '0000-01-01';
  const toD = to?.trim() || '9999-12-31';
  return rows.filter((r) => r.date >= fromD && r.date <= toD);
}

export function mergeCategoryInto(
  target: Record<string, PrResolutionMetricsCategoryBucket>,
  byCategory?: PrResolutionMetricFileRow['byCategory'],
): void {
  if (!byCategory) return;
  for (const [k, v] of Object.entries(byCategory)) {
    if (!target[k]) {
      target[k] = { total: 0, accepted: 0, wontfix: 0, snoozed: 0 };
    }
    const accepted = v.accepted ?? 0;
    const wontfix = v.wontfix ?? 0;
    const snoozed = v.snoozed ?? 0;
    target[k].total += v.total ?? accepted + wontfix + snoozed;
    target[k].accepted += accepted;
    target[k].wontfix += wontfix;
    target[k].snoozed += snoozed;
  }
}

export function parsePrResolutionMetricsJson(content: string): PrResolutionMetricFileRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeMetricRow)
    .filter((row): row is PrResolutionMetricFileRow => row !== null);
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const chunk = await Promise.all(batch.map(worker));
    results.push(...chunk);
  }
  return results;
}

/**
 * Collects all metric rows from ADO under AGENT_EVALS_RUNS_BASE_PATH (default /agent-evals/runs).
 */
export async function collectMetricRowsFromRepo(): Promise<PrResolutionMetricFileRow[]> {
  const orgUrl = process.env.ADO_ORG;
  const pat = process.env.ADO_PAT;
  if (!orgUrl || !pat) {
    console.warn('[agentEvalsPrResolution] ADO_ORG or ADO_PAT not set');
    return [];
  }

  const basePath = normalizeBasePath(process.env.AGENT_EVALS_RUNS_BASE_PATH ?? DEFAULT_RUNS_BASE);
  let childPaths: string[] = [];
  try {
    childPaths = await fetchAdoTree(orgUrl, pat, basePath);
  } catch (e) {
    console.error('[agentEvalsPrResolution] Failed to list runs folder:', (e as Error).message);
    return [];
  }

  const norm = (p: string) => (p.startsWith('/') ? p : `/${p}`);
  const pathsArr = childPaths
    .map(norm)
    .filter((p) => isMetricFilename(p.split('/').pop() ?? ''))
    .slice(0, MAX_METRIC_FILES);

  const allRows: PrResolutionMetricFileRow[] = [];

  await runPool(pathsArr, FETCH_CONCURRENCY, async (path) => {
    try {
      const text = await fetchAdoFile(orgUrl, pat, path);
      const rows = parsePrResolutionMetricsJson(text);
      allRows.push(...rows);
    } catch {
      /* missing file is expected for alternate filenames */
    }
    return null;
  });

  return allRows;
}

const UNKNOWN_AUTHOR = 'Unknown PR author';

/**
 * Fetches JSON from agent-evals, resolves PR creators, filters by date and optional developer.
 */
export async function getPrResolutionMetricsStats(
  ado: AzureDevOpsService,
  from?: string,
  to?: string,
  developerFilter?: string,
): Promise<PrResolutionMetricsStats[]> {
  const rawRows = await collectMetricRowsFromRepo();
  const deduped = dedupePrResolutionMetricRows(rawRows);
  const inRange = filterRowsByDateRange(deduped, from, to);
  if (inRange.length === 0) return [];

  const uniquePrIds = Array.from(new Set(inRange.map((r) => r.prId)));
  const prIdToAuthor = new Map<number, { displayName: string; title: string; prUrl: string; repositoryName: string }>();

  for (let i = 0; i < uniquePrIds.length; i += FETCH_CONCURRENCY) {
    const batch = uniquePrIds.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (prId) => {
        const snap = await ado.getPullRequestAuthorSnapshot(prId);
        if (snap) prIdToAuthor.set(prId, snap);
      }),
    );
  }

  // Aggregate per-developer.
  // Each unique prId gets one prBucket; rows from multiple files for the same prId are
  // merged into that bucket so totals are never double-counted at the developer level.
  type PerPrBucket = {
    prId: number; date: string; prTitle: string; prUrl: string; repositoryName: string;
    total: number; accepted: number; wontfix: number; snoozed: number;
    byCategory: Record<string, PrResolutionMetricsCategoryBucket>;
  };
  type Agg = {
    byCategory: Record<string, PrResolutionMetricsCategoryBucket>;
    prBuckets: Map<number, PerPrBucket>;
  };
  const byDev = new Map<string, Agg>();

  const ensureDev = (name: string): Agg => {
    if (!byDev.has(name)) byDev.set(name, { byCategory: {}, prBuckets: new Map() });
    return byDev.get(name)!;
  };

  for (const row of inRange) {
    const snap = prIdToAuthor.get(row.prId);
    const developer = snap?.displayName ?? UNKNOWN_AUTHOR;
    if (developerFilter && developer !== developerFilter) continue;

    const agg = ensureDev(developer);

    // Merge all rows for the same prId into one bucket
    if (!agg.prBuckets.has(row.prId)) {
      agg.prBuckets.set(row.prId, {
        prId: row.prId,
        date: row.date,
        prTitle: snap?.title ?? `PR #${row.prId}`,
        prUrl: snap?.prUrl ?? '',
        repositoryName: snap?.repositoryName ?? '',
        total: 0, accepted: 0, wontfix: 0, snoozed: 0,
        byCategory: {},
      });
    }
    const prBucket = agg.prBuckets.get(row.prId)!;
    prBucket.total += row.total;
    prBucket.accepted += row.accepted;
    prBucket.wontfix += row.wontfix;
    prBucket.snoozed += row.snoozed;
    mergeCategoryInto(prBucket.byCategory, row.byCategory);
    // keep earliest date
    if (row.date < prBucket.date) prBucket.date = row.date;
  }

  // Derive developer-level totals from the already-merged per-PR buckets
  const result: PrResolutionMetricsStats[] = Array.from(byDev.entries()).map(([developer, a]) => {
    const buckets = Array.from(a.prBuckets.values());

    const totalComments = buckets.reduce((s, p) => s + p.total, 0);
    const accepted      = buckets.reduce((s, p) => s + p.accepted, 0);
    const wontfix       = buckets.reduce((s, p) => s + p.wontfix, 0);
    const snoozed       = buckets.reduce((s, p) => s + p.snoozed, 0);

    // Rebuild byCategory from merged buckets
    const byCategory: Record<string, PrResolutionMetricsCategoryBucket> = {};
    for (const p of buckets) mergeCategoryInto(byCategory, p.byCategory);

    const prDetails: PrResolutionMetricsStats['prDetails'] = buckets
      .sort((x, y) => y.date.localeCompare(x.date) || y.prId - x.prId)
      .map(p => ({
        prId: p.prId,
        date: p.date,
        prTitle: p.prTitle,
        prUrl: p.prUrl,
        repositoryName: p.repositoryName,
        total: p.total,
        accepted: p.accepted,
        wontfix: p.wontfix,
        snoozed: p.snoozed,
        acceptanceRate: p.total > 0 ? Math.round((p.accepted / p.total) * 1000) / 1000 : 0,
      }));

    return {
      developer,
      prCount: a.prBuckets.size,
      snapshotCount: a.prBuckets.size,
      totalComments,
      accepted,
      wontfix,
      snoozed,
      acceptanceRate: totalComments > 0 ? Math.round((accepted / totalComments) * 1000) / 1000 : 0,
      byCategory,
      prDetails,
    };
  });

  result.sort((x, y) => y.totalComments - x.totalComments);
  return result;
}
