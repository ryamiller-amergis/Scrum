import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DesignPrototype,
  DesignPrototypeComment,
  DesignPrototypeSummary,
  DesignPrototypeStatus,
} from '../../shared/types/designPrototype';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const GENERATING_STATUSES: DesignPrototypeStatus[] = ['generating', 'regenerating'];

// ── Queries ─────────────────────────────────────────────────────────────────

export function usePrototypesForPrd(prdId: string | null) {
  return useQuery<DesignPrototypeSummary[]>({
    queryKey: ['design-prototypes', 'prd', prdId],
    queryFn: () => apiFetch(`/api/design-prototypes/prd/${prdId}`),
    enabled: !!prdId,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasGenerating = data.some(p => GENERATING_STATUSES.includes(p.status));
      return hasGenerating ? 5_000 : false;
    },
  });
}

export function usePrototype(id: string | null) {
  return useQuery<DesignPrototype>({
    queryKey: ['design-prototype', id],
    queryFn: () => apiFetch(`/api/design-prototypes/${id}`),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return false;
      return GENERATING_STATUSES.includes(status) ? 5_000 : false;
    },
  });
}

export function usePrototypeComments(prototypeId: string | null) {
  return useQuery<DesignPrototypeComment[]>({
    queryKey: ['design-prototype-comments', prototypeId],
    queryFn: () => apiFetch(`/api/design-prototypes/${prototypeId}/comments`),
    enabled: !!prototypeId,
    staleTime: 15_000,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function useRegeneratePrototype() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: string }) =>
      apiFetch(`/api/design-prototypes/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['design-prototype', variables.id] });
      qc.invalidateQueries({ queryKey: ['design-prototypes'] });
    },
  });
}

export function useRetryPrototype() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/design-prototypes/${id}/retry`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['design-prototype', id] });
      qc.invalidateQueries({ queryKey: ['design-prototypes'] });
    },
  });
}

export function useReviewPrototype() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: 'approve' | 'revision_requested'; comment?: string }) =>
      apiFetch(`/api/design-prototypes/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['design-prototype', variables.id] });
      qc.invalidateQueries({ queryKey: ['design-prototypes'] });
    },
  });
}

export function useAddPrototypeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prototypeId, text, mockVersion, pinX, pinY }: {
      prototypeId: string;
      text: string;
      mockVersion: number;
      pinX?: number;
      pinY?: number;
    }) =>
      apiFetch<DesignPrototypeComment>(`/api/design-prototypes/${prototypeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mockVersion, pinX, pinY }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['design-prototype-comments', variables.prototypeId] });
    },
  });
}

export function useResolvePrototypeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, prototypeId }: { commentId: string; prototypeId: string }) =>
      apiFetch(`/api/design-prototypes/comments/${commentId}/resolve`, { method: 'POST' }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['design-prototype-comments', variables.prototypeId] });
    },
  });
}
