import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkItem } from '../types/workitem';

interface DueDateChange {
  changedDate: string;
  changedBy: string;
  oldDueDate: string | null;
  newDueDate: string | null;
  reason: string | null;
}

interface ReleaseEpicSummary {
  id: number;
  version: string;
  status: string;
}

interface ParentEpic {
  id: number;
  title: string;
  version: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useWorkItemDetail(
  workItem: WorkItem | null,
  project: string,
  areaPath: string,
  showLinkToEpic: boolean
) {
  const queryClient = useQueryClient();
  const id = workItem?.id;
  const type = workItem?.workItemType;
  const enc = encodeURIComponent;

  const shouldFetchRelations =
    type === 'Product Backlog Item' ||
    type === 'Technical Backlog Item' ||
    type === 'Feature';

  const shouldFetchChanges =
    type === 'Product Backlog Item' ||
    type === 'Technical Backlog Item';

  const { data: relatedItems = [], isLoading: isLoadingRelations } = useQuery<WorkItem[]>({
    queryKey: ['workItemRelations', id, project, areaPath],
    queryFn: () => fetchJson<WorkItem[]>(`/api/workitems/${id}/relations?project=${enc(project)}&areaPath=${enc(areaPath)}`),
    enabled: !!id && shouldFetchRelations,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dueDateChanges = [], isLoading: isLoadingChanges } = useQuery<DueDateChange[]>({
    queryKey: ['dueDateChanges', id, project],
    queryFn: () => fetchJson<DueDateChange[]>(`/api/workitems/${id}/due-date-changes?project=${enc(project)}`),
    enabled: !!id && shouldFetchChanges,
    staleTime: 5 * 60 * 1000,
  });

  const { data: discussionsData, isLoading: isLoadingDiscussions } = useQuery<{ discussions: string }>({
    queryKey: ['workItemDiscussions', id, project],
    queryFn: () => fetchJson<{ discussions: string }>(`/api/workitems/${id}/discussions?project=${enc(project)}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: availableReleaseEpics = [], isLoading: isLoadingReleaseEpics } = useQuery<ReleaseEpicSummary[]>({
    queryKey: ['releaseEpics', project, areaPath],
    queryFn: async () => {
      const data = await fetchJson<any[]>(`/api/releases/epics?project=${enc(project)}&areaPath=${enc(areaPath)}`);
      return data.filter((e: any) => e.status !== 'Done' && e.status !== 'Closed');
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentParentEpic = null, isLoading: isLoadingParentEpic } = useQuery<ParentEpic | null>({
    queryKey: ['workItemParentEpic', id, project, areaPath],
    queryFn: async () => {
      const data = await fetchJson<any>(`/api/workitems/${id}/parent-epic?project=${enc(project)}&areaPath=${enc(areaPath)}`);
      return data?.id ? data : null;
    },
    enabled: !!id && showLinkToEpic,
    staleTime: 5 * 60 * 1000,
  });

  const invalidateParentEpic = () =>
    queryClient.invalidateQueries({ queryKey: ['workItemParentEpic', id, project, areaPath] });

  return {
    relatedItems,
    isLoadingRelations,
    dueDateChanges,
    isLoadingChanges,
    discussions: discussionsData?.discussions ?? '',
    isLoadingDiscussions,
    availableReleaseEpics,
    isLoadingReleaseEpics,
    currentParentEpic,
    isLoadingParentEpic,
    invalidateParentEpic,
  };
}
