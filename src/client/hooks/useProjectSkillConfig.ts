import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProjectSkillConfig,
  UpsertProjectSkillConfigRequest,
  ProjectSkillConfigResponse,
} from '../../shared/types/projectSettings';

export function useProjectSkillConfig(project: string | null | undefined) {
  return useQuery<ProjectSkillConfigResponse | null>({
    queryKey: ['skill-config', project],
    queryFn: async () => {
      if (!project) return null;
      const res = await fetch(`/api/skill-config?project=${encodeURIComponent(project)}`, {
        credentials: 'include',
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch skill config');
      return res.json() as Promise<ProjectSkillConfigResponse>;
    },
    enabled: !!project,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllProjectSkillConfigs() {
  return useQuery<ProjectSkillConfig[]>({
    queryKey: ['admin', 'project-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/project-settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch project settings');
      return res.json() as Promise<ProjectSkillConfig[]>;
    },
    staleTime: 60 * 1000,
  });
}

export function useUpsertProjectSkillConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project,
      body,
    }: {
      project: string;
      body: UpsertProjectSkillConfigRequest;
    }) => {
      const res = await fetch(`/api/admin/project-settings/${encodeURIComponent(project)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save project settings');
      return res.json() as Promise<ProjectSkillConfig>;
    },
    onSuccess: (_data, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-settings'] });
      queryClient.invalidateQueries({ queryKey: ['skill-config', project] });
    },
  });
}

export function useDeleteProjectSkillConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: string) => {
      const res = await fetch(`/api/admin/project-settings/${encodeURIComponent(project)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete project settings');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-settings'] });
    },
  });
}
