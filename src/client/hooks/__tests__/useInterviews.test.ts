import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useInterviewList,
  useInterview,
  usePrdList,
  usePrd,
  useCreateInterview,
  useUpdateInterviewStatus,
  useUpdateInterviewTitle,
  useDeleteInterview,
  useDeletePrd,
  useCreatePrd,
  useUpdatePrdContent,
  useSubmitPrd,
  useWithdrawPrd,
  useReviewPrd,
  useSyncPrd,
} from '../useInterviews';

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

function mockFetchOk(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status,
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

const interviewSummary = {
  id: 'interview-1',
  chatThreadId: 'thread-1',
  authorId: 'user-1',
  title: 'Sprint Review',
  project: 'proj-alpha',
  repo: 'org/repo',
  status: 'in_progress',
  prdCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const interview = { ...interviewSummary, prds: [] };

const prdSummary = {
  id: 'prd-1',
  interviewId: 'interview-1',
  chatThreadId: 'thread-2',
  authorId: 'user-1',
  title: 'Feature PRD',
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const prd = { ...prdSummary, content: 'PRD content', backlogJson: null };

// ── useInterviewList ───────────────────────────────────────────────────────────

describe('useInterviewList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/interviews and returns interview summaries', async () => {
    mockFetchOk([interviewSummary]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInterviewList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toMatchObject({ id: 'interview-1', title: 'Sprint Review' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/interviews'),
      expect.any(Object),
    );
  });

  it('includes status query param when filter is provided', async () => {
    mockFetchOk([]);
    const { wrapper } = createWrapper();

    renderHook(() => useInterviewList({ status: 'complete' }), { wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=complete'),
      expect.any(Object),
    );
  });

  it('surfaces fetch errors', async () => {
    mockFetchError(500, { error: 'Server error' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInterviewList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useInterview ───────────────────────────────────────────────────────────────

describe('useInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/interviews/:id and returns the interview', async () => {
    mockFetchOk(interview);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInterview('interview-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ id: 'interview-1' });
  });

  it('does not fetch when id is null', async () => {
    mockFetchOk(interview);
    const { wrapper } = createWrapper();

    renderHook(() => useInterview(null), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── usePrdList ─────────────────────────────────────────────────────────────────

describe('usePrdList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/interviews/prds and returns PRD summaries', async () => {
    mockFetchOk([prdSummary]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePrdList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toMatchObject({ id: 'prd-1' });
  });

  it('includes status filter in the URL', async () => {
    mockFetchOk([]);
    const { wrapper } = createWrapper();

    renderHook(() => usePrdList({ status: 'approved' }), { wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=approved'),
      expect.any(Object),
    );
  });
});

// ── usePrd ─────────────────────────────────────────────────────────────────────

describe('usePrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches /api/interviews/prds/:id and returns the PRD', async () => {
    mockFetchOk(prd);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePrd('prd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ id: 'prd-1', content: 'PRD content' });
  });

  it('does not fetch when id is null', async () => {
    mockFetchOk(prd);
    const { wrapper } = createWrapper();

    renderHook(() => usePrd(null), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── useCreateInterview ─────────────────────────────────────────────────────────

describe('useCreateInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /api/interviews and returns the created identifiers', async () => {
    mockFetchOk({ interviewId: 'interview-new', threadId: 'thread-new' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateInterview(), { wrapper });

    await act(async () => {
      result.current.mutate({ project: 'proj', repo: 'org/repo', chatThreadId: 'thread-x' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ interviewId: 'interview-new' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces errors from the API', async () => {
    mockFetchError(400, { error: 'project is required' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateInterview(), { wrapper });

    await act(async () => {
      result.current.mutate({ project: '', repo: 'org/repo', chatThreadId: 'thread-x' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useUpdateInterviewStatus ───────────────────────────────────────────────────

describe('useUpdateInterviewStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PATCHes /api/interviews/:id with the new status', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateInterviewStatus(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'interview-1', status: 'complete' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/interview-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

// ── useUpdateInterviewTitle ────────────────────────────────────────────────────

describe('useUpdateInterviewTitle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PATCHes /api/interviews/:id with the new title', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateInterviewTitle(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'interview-1', title: 'New Title' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({ title: 'New Title' });
  });
});

// ── useDeleteInterview ─────────────────────────────────────────────────────────

describe('useDeleteInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs /api/interviews/:id', async () => {
    mockFetchNoContent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteInterview(), { wrapper });

    await act(async () => {
      result.current.mutate('interview-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/interview-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ── useDeletePrd ───────────────────────────────────────────────────────────────

describe('useDeletePrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs /api/interviews/prds/:prdId', async () => {
    mockFetchNoContent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeletePrd(), { wrapper });

    await act(async () => {
      result.current.mutate('prd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ── useCreatePrd ───────────────────────────────────────────────────────────────

describe('useCreatePrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /api/interviews/:interviewId/prds', async () => {
    mockFetchOk({ prdId: 'prd-new', threadId: 'thread-new' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePrd(), { wrapper });

    await act(async () => {
      result.current.mutate({ interviewId: 'interview-1', chatThreadId: 'thread-x', title: 'My PRD' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ prdId: 'prd-new' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/interview-1/prds',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── useUpdatePrdContent ────────────────────────────────────────────────────────

describe('useUpdatePrdContent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PUTs new content to /api/interviews/prds/:prdId/content', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdatePrdContent(), { wrapper });

    await act(async () => {
      result.current.mutate({ prdId: 'prd-1', content: 'Updated content' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1/content',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ── useSubmitPrd ───────────────────────────────────────────────────────────────

describe('useSubmitPrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /api/interviews/prds/:prdId/submit', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSubmitPrd(), { wrapper });

    await act(async () => {
      result.current.mutate('prd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1/submit',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── useWithdrawPrd ─────────────────────────────────────────────────────────────

describe('useWithdrawPrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /api/interviews/prds/:prdId/withdraw', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWithdrawPrd(), { wrapper });

    await act(async () => {
      result.current.mutate('prd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1/withdraw',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── useReviewPrd ───────────────────────────────────────────────────────────────

describe('useReviewPrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs an approve action to /api/interviews/prds/:prdId/review', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useReviewPrd(), { wrapper });

    await act(async () => {
      result.current.mutate({ prdId: 'prd-1', action: 'approve' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1/review',
      expect.objectContaining({ method: 'POST' }),
    );
    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({ action: 'approve' });
  });

  it('includes a comment when rejecting', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useReviewPrd(), { wrapper });

    await act(async () => {
      result.current.mutate({ prdId: 'prd-1', action: 'reject', comment: 'Needs more work' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({ action: 'reject', comment: 'Needs more work' });
  });
});

// ── useSyncPrd ─────────────────────────────────────────────────────────────────

describe('useSyncPrd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /api/interviews/prds/:prdId/sync and returns content', async () => {
    mockFetchOk({ ok: true, content: '# Generated PRD' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSyncPrd(), { wrapper });

    await act(async () => {
      result.current.mutate('prd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ ok: true, content: '# Generated PRD' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/interviews/prds/prd-1/sync',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
