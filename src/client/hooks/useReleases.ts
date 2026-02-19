import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkItem, ReleaseMetrics } from '../types/workitem';

interface ReleaseDetails {
  workItems: WorkItem[];
  metrics: ReleaseMetrics;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useReleases(project: string, areaPath: string) {
  const queryClient = useQueryClient();
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);

  const releasesQueryKey = ['releases', project, areaPath] as const;
  const releaseEpicsQueryKey = ['releaseEpics', project, areaPath] as const;

  const { data: releases = [] } = useQuery<string[]>({
    queryKey: releasesQueryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/releases?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`,
        { credentials: 'include' }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: releaseEpics = [], isLoading: loadingEpics } = useQuery<any[]>({
    queryKey: releaseEpicsQueryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/releases/epics?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`,
        { credentials: 'include' }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: releaseDetails, isLoading: loadingDetails } = useQuery<ReleaseDetails>({
    queryKey: ['releaseDetails', selectedRelease, project, areaPath],
    queryFn: async () => {
      if (!selectedRelease) throw new Error('No release selected');
      const enc = encodeURIComponent;
      const base = `project=${enc(project)}&areaPath=${enc(areaPath)}`;
      const [workItems, metrics, deployments] = await Promise.all([
        fetchJson<WorkItem[]>(`/api/releases/${enc(selectedRelease)}/workitems?${base}`),
        fetchJson<ReleaseMetrics>(`/api/releases/${enc(selectedRelease)}/metrics?${base}`),
        fetchJson<any>(`/api/deployments/${enc(selectedRelease)}/latest`),
      ]);
      return { workItems, metrics, deployments };
    },
    enabled: !!selectedRelease,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (releases.length > 0 && !selectedRelease) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRelease(releases[0]);
    }
  }, [releases, selectedRelease]);

  return {
    releases,
    releaseEpics,
    loadingEpics,
    selectedRelease,
    setSelectedRelease,
    releaseWorkItems: (releaseDetails as any)?.workItems ?? [],
    releaseMetrics: (releaseDetails as any)?.metrics ?? null,
    latestDeployments: (releaseDetails as any)?.deployments ?? {},
    loadingDetails,
    refreshReleases: () => queryClient.invalidateQueries({ queryKey: releasesQueryKey }),
    refreshReleaseEpics: () => queryClient.invalidateQueries({ queryKey: releaseEpicsQueryKey }),
    refreshReleaseDetails: () =>
      queryClient.invalidateQueries({ queryKey: ['releaseDetails', selectedRelease, project, areaPath] }),
  };
}
