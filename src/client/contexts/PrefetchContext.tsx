import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { azureCostService } from '../services/azureCostService';

// SessionStorage keys used by CloudCost - must match CloudCost.tsx
const CLOUD_COST_KEYS = {
  SUBSCRIPTIONS: 'cloudCost_subscriptions',
  DASHBOARD_DATA: 'cloudCost_dashboardData',
} as const;

interface PrefetchContextValue {
  /** Prefetched release versions for the current prefetch scope */
  prefetchedReleases: string[] | null;
  /** Prefetched release epics for the current prefetch scope */
  prefetchedReleaseEpics: any[] | null;
  /** Project used for the last prefetch (to match ReleaseView project) */
  prefetchProject: string | null;
  /** Area path used for the last prefetch (to match ReleaseView areaPath) */
  prefetchAreaPath: string | null;
}

const PrefetchContext = createContext<PrefetchContextValue>({
  prefetchedReleases: null,
  prefetchedReleaseEpics: null,
  prefetchProject: null,
  prefetchAreaPath: null,
});

/** Delay before starting prefetch so calendar load isn't competing for bandwidth */
const PREFETCH_DELAY_MS = 2000;
/** Delay between starting releases vs cloud cost prefetch to avoid a burst of 4 requests */
const PREFETCH_STAGGER_MS = 600;

interface PrefetchProviderProps {
  children: React.ReactNode;
  project: string;
  areaPath: string;
  isAuthenticated: boolean;
  /** Prefetch only runs after this is true (e.g. after calendar work items load). Keeps initial load fast. */
  mainViewReady?: boolean;
}

/**
 * Prefetches data in the background for Planning (Releases) and Cloud Cost Dashboard
 * so that when the user navigates to those views, data is already available or nearly so.
 * Waits until the main view is ready, then runs after a short delay so the app feels fast.
 */
export function PrefetchProvider({ children, project, areaPath, isAuthenticated, mainViewReady = false }: PrefetchProviderProps) {
  const [prefetchedReleases, setPrefetchedReleases] = useState<string[] | null>(null);
  const [prefetchedReleaseEpics, setPrefetchedReleaseEpics] = useState<any[] | null>(null);
  const [prefetchProject, setPrefetchProject] = useState<string | null>(null);
  const [prefetchAreaPath, setPrefetchAreaPath] = useState<string | null>(null);
  const prefetchStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !project || !areaPath || !mainViewReady) return;

    const scopeKey = `${project}|${areaPath}`;
    if (prefetchStartedRef.current === scopeKey) return;
    prefetchStartedRef.current = scopeKey;

    let cancelled = false;

    const prefetchReleases = async () => {
      try {
        const [releasesRes, epicsRes] = await Promise.all([
          fetch(
            `/api/releases?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`,
            { credentials: 'include' }
          ),
          fetch(
            `/api/releases/epics?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`,
            { credentials: 'include' }
          ),
        ]);

        if (cancelled) return;
        if (!releasesRes.ok || !epicsRes.ok) return;

        const releases = await releasesRes.json();
        const releaseEpics = await epicsRes.json();

        if (cancelled) return;
        if (!Array.isArray(releases)) return;

        setPrefetchedReleases(releases);
        setPrefetchedReleaseEpics(Array.isArray(releaseEpics) ? releaseEpics : []);
        setPrefetchProject(project);
        setPrefetchAreaPath(areaPath);
      } catch (e) {
        if (!cancelled) console.debug('[Prefetch] Releases prefetch failed:', e);
      }
    };

    const prefetchCloudCost = async () => {
      try {
        const [subscriptions, dashboardData] = await Promise.all([
          azureCostService.getSubscriptionsWithResourceGroups(),
          azureCostService.getDashboardData(5),
        ]);

        if (cancelled) return;

        try {
          sessionStorage.setItem(CLOUD_COST_KEYS.SUBSCRIPTIONS, JSON.stringify(subscriptions));
          sessionStorage.setItem(CLOUD_COST_KEYS.DASHBOARD_DATA, JSON.stringify(dashboardData));
        } catch (storageErr) {
          console.debug('[Prefetch] Cloud Cost sessionStorage write failed:', storageErr);
        }
      } catch (e) {
        if (!cancelled) console.debug('[Prefetch] Cloud Cost prefetch failed:', e);
      }
    };

    let staggerTimerId: ReturnType<typeof setTimeout> | null = null;

    const delayTimerId = window.setTimeout(() => {
      if (cancelled) return;
      prefetchReleases();
      staggerTimerId = window.setTimeout(() => {
        if (!cancelled) prefetchCloudCost();
      }, PREFETCH_STAGGER_MS);
    }, PREFETCH_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(delayTimerId);
      if (staggerTimerId !== null) clearTimeout(staggerTimerId);
    };
  }, [isAuthenticated, project, areaPath, mainViewReady]);

  // Reset prefetch scope and cache when project/areaPath change so next prefetch can run
  const prevScopeRef = useRef(`${project}|${areaPath}`);
  useEffect(() => {
    const scope = `${project}|${areaPath}`;
    if (prevScopeRef.current !== scope) {
      prevScopeRef.current = scope;
      prefetchStartedRef.current = null;
      setPrefetchedReleases(null);
      setPrefetchedReleaseEpics(null);
      setPrefetchProject(null);
      setPrefetchAreaPath(null);
    }
  }, [project, areaPath]);

  const value: PrefetchContextValue = {
    prefetchedReleases,
    prefetchedReleaseEpics,
    prefetchProject,
    prefetchAreaPath,
  };

  return (
    <PrefetchContext.Provider value={value}>
      {children}
    </PrefetchContext.Provider>
  );
}

export function usePrefetch(): PrefetchContextValue {
  const ctx = useContext(PrefetchContext);
  if (!ctx) {
    throw new Error('usePrefetch must be used within PrefetchProvider');
  }
  return ctx;
}
