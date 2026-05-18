import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProjectSkillConfig,
  useAllProjectSkillConfigs,
  useUpsertProjectSkillConfig,
  useDeleteProjectSkillConfig,
} from '../useProjectSkillConfig';

// ── QueryClient wrapper ────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

function mockFetchOk(data: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }) as jest.Mock;
}

function mockFetchNoContent() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.resolve(undefined),
  }) as jest.Mock;
}

function mockFetchError(status: number, body: unknown = { error: `HTTP ${status}` }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const skillConfig = {
  project: 'proj-alpha',
  skillRepo: 'org/skills-repo',
  skillBranch: 'main',
  updatedBy: 'alice',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

// ── useProjectSkillConfig ──────────────────────────────────────────────────────

describe('useProjectSkillConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/skill-config?project=... and returns the config', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProjectSkillConfig('proj-alpha'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ project: 'proj-alpha', skillRepo: 'org/skills-repo' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('project=proj-alpha'),
      expect.any(Object),
    );
  });

  it('URL-encodes the project name', async () => {
    mockFetchOk(null);
    const { wrapper } = createWrapper();

    renderHook(() => useProjectSkillConfig('my project/with spaces'), { wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('my project/with spaces')),
      expect.any(Object),
    );
  });

  it('returns null when the server responds with 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    }) as jest.Mock;
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProjectSkillConfig('proj-missing'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('does not fetch when project is null', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    renderHook(() => useProjectSkillConfig(null), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when project is empty string', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    renderHook(() => useProjectSkillConfig(''), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces non-404 errors', async () => {
    mockFetchError(500);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProjectSkillConfig('proj-alpha'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useAllProjectSkillConfigs ──────────────────────────────────────────────────

describe('useAllProjectSkillConfigs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/admin/project-settings and returns the list', async () => {
    mockFetchOk([skillConfig]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAllProjectSkillConfigs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toMatchObject({ project: 'proj-alpha' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/project-settings',
      expect.any(Object),
    );
  });

  it('returns an empty array when no configs exist', async () => {
    mockFetchOk([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAllProjectSkillConfigs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('surfaces fetch errors', async () => {
    mockFetchError(403);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAllProjectSkillConfigs(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useUpsertProjectSkillConfig ────────────────────────────────────────────────

describe('useUpsertProjectSkillConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PUTs to /api/admin/project-settings/:project and returns the saved config', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpsertProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate({
        project: 'proj-alpha',
        body: { skillRepo: 'org/skills-repo', skillBranch: 'main' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ project: 'proj-alpha' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('proj-alpha'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('URL-encodes the project name in the URL', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpsertProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate({
        project: 'my project/with spaces',
        body: { skillRepo: 'org/repo', skillBranch: 'main' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('my project/with spaces')),
      expect.any(Object),
    );
  });

  it('sends the correct JSON body', async () => {
    mockFetchOk(skillConfig);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpsertProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate({
        project: 'proj-alpha',
        body: { skillRepo: 'org/new-skills', skillBranch: 'release' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody).toEqual({ skillRepo: 'org/new-skills', skillBranch: 'release' });
  });

  it('surfaces errors from the API', async () => {
    mockFetchError(400);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpsertProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate({ project: 'p', body: { skillRepo: '', skillBranch: '' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useDeleteProjectSkillConfig ────────────────────────────────────────────────

describe('useDeleteProjectSkillConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs /api/admin/project-settings/:project', async () => {
    mockFetchNoContent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate('proj-alpha');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('proj-alpha'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('URL-encodes the project name', async () => {
    mockFetchNoContent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate('my project/with spaces');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('my project/with spaces')),
      expect.any(Object),
    );
  });

  it('surfaces errors from the API', async () => {
    mockFetchError(500);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteProjectSkillConfig(), { wrapper });

    await act(async () => {
      result.current.mutate('proj-alpha');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
