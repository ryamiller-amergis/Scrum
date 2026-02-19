import { useQuery } from '@tanstack/react-query';
import type { DeveloperDueDateStats, DueDateHitRateStats, PullRequestTimeStats, QABugStats } from '../types/workitem';

export interface StatsFilters {
  fromDate: string;
  toDate: string;
  developer: string;
}

function buildParams(filters: StatsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.fromDate) params.append('from', filters.fromDate);
  if (filters.toDate) params.append('to', filters.toDate);
  if (filters.developer !== 'all') params.append('developer', filters.developer);
  return params;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface StatQueryResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  load: () => void;
}

export interface UseDueDateStatsReturn {
  dueDateChanges: StatQueryResult<DeveloperDueDateStats>;
  hitRate: StatQueryResult<DueDateHitRateStats>;
  prTime: StatQueryResult<PullRequestTimeStats>;
  qaBugs: StatQueryResult<QABugStats>;
  allDevelopers: string[];
}

export function useDueDateStats(filters: StatsFilters): UseDueDateStatsReturn {
  const params = buildParams(filters);

  const dueDateChangesQuery = useQuery<DeveloperDueDateStats[]>({
    queryKey: ['dueDateChanges', filters.fromDate, filters.toDate, filters.developer],
    queryFn: () => fetchJson<DeveloperDueDateStats[]>(`/api/due-date-stats?${params}`),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const hitRateQuery = useQuery<DueDateHitRateStats[]>({
    queryKey: ['dueDateHitRate', filters.fromDate, filters.toDate, filters.developer],
    queryFn: () => fetchJson<DueDateHitRateStats[]>(`/api/due-date-hit-rate?${params}`),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const prTimeQuery = useQuery<PullRequestTimeStats[]>({
    queryKey: ['prTimeStats', filters.fromDate, filters.toDate, filters.developer],
    queryFn: () => fetchJson<PullRequestTimeStats[]>(`/api/pull-request-time-stats?${params}`),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const qaBugsQuery = useQuery<QABugStats[]>({
    queryKey: ['qaBugStats', filters.fromDate, filters.toDate, filters.developer],
    queryFn: () => fetchJson<QABugStats[]>(`/api/qa-bug-stats?${params}`),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const allDevelopers = Array.from(new Set([
    ...(dueDateChangesQuery.data ?? []).map(s => s.developer),
    ...(hitRateQuery.data ?? []).map(s => s.developer),
    ...(prTimeQuery.data ?? []).map(s => s.developer),
  ])).sort();

  return {
    dueDateChanges: {
      data: dueDateChangesQuery.data ?? [],
      isLoading: dueDateChangesQuery.isFetching,
      error: dueDateChangesQuery.error ? (dueDateChangesQuery.error as Error).message : null,
      hasLoaded: dueDateChangesQuery.data !== undefined,
      load: () => dueDateChangesQuery.refetch(),
    },
    hitRate: {
      data: hitRateQuery.data ?? [],
      isLoading: hitRateQuery.isFetching,
      error: hitRateQuery.error ? (hitRateQuery.error as Error).message : null,
      hasLoaded: hitRateQuery.data !== undefined,
      load: () => hitRateQuery.refetch(),
    },
    prTime: {
      data: prTimeQuery.data ?? [],
      isLoading: prTimeQuery.isFetching,
      error: prTimeQuery.error ? (prTimeQuery.error as Error).message : null,
      hasLoaded: prTimeQuery.data !== undefined,
      load: () => prTimeQuery.refetch(),
    },
    qaBugs: {
      data: qaBugsQuery.data ?? [],
      isLoading: qaBugsQuery.isFetching,
      error: qaBugsQuery.error ? (qaBugsQuery.error as Error).message : null,
      hasLoaded: qaBugsQuery.data !== undefined,
      load: () => qaBugsQuery.refetch(),
    },
    allDevelopers,
  };
}
