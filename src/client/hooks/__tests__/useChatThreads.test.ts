import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useChatThreadList,
  useChatThread,
  useStartChat,
  useDeleteThread,
} from '../useChatThreads';
import type { ChatThreadSummary } from '../../../shared/types/chat';

// ── QueryClient wrapper ───────────────────────────────────────────────────────

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

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockFetchOk(data: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as jest.Mock;
}

function mockFetchError(status: number, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const threadSummary: ChatThreadSummary = {
  id: 'thread-1',
  userId: 'user-1',
  title: 'Grill With Docs',
  status: 'idle',
  kickoff: { project: 'TestProject', repo: 'TestRepo' },
  createdAt: '2026-01-01T00:00:00.000Z',
  lastActivityAt: '2026-01-02T00:00:00.000Z',
};

const threadSummary2: ChatThreadSummary = {
  ...threadSummary,
  id: 'thread-2',
  title: 'Another Thread',
};

// ── useChatThreadList ─────────────────────────────────────────────────────────

describe('useChatThreadList', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fetches thread summaries and returns them', async () => {
    mockFetchOk([threadSummary, threadSummary2]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThreadList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].id).toBe('thread-1');
  });

  it('calls /api/chat/threads with the default limit', async () => {
    mockFetchOk([]);
    const { wrapper } = createWrapper();

    renderHook(() => useChatThreadList(), { wrapper });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/threads?limit=50',
        expect.objectContaining({ credentials: 'include' }),
      ),
    );
  });

  it('calls /api/chat/threads with a custom limit', async () => {
    mockFetchOk([]);
    const { wrapper } = createWrapper();

    renderHook(() => useChatThreadList(10), { wrapper });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/threads?limit=10',
        expect.objectContaining({ credentials: 'include' }),
      ),
    );
  });

  it('surfaces an error when the API returns a non-ok response', async () => {
    mockFetchError(500, { error: 'Internal Server Error' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThreadList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Internal Server Error');
  });

  it('falls back to HTTP status when the response body has no error field', async () => {
    mockFetchError(503, {});
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThreadList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('HTTP 503');
  });
});

// ── useChatThread ─────────────────────────────────────────────────────────────

describe('useChatThread', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not fetch when threadId is null', () => {
    mockFetchOk({});
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThread(null), { wrapper });

    // Query is disabled — status remains 'pending' but no fetch is triggered
    expect(result.current.fetchStatus).toBe('idle');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches the thread when a threadId is provided', async () => {
    mockFetchOk({ id: 'thread-1', messages: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThread('thread-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/threads/thread-1',
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});

// ── useStartChat ──────────────────────────────────────────────────────────────

describe('useStartChat', () => {
  afterEach(() => jest.restoreAllMocks());

  it('POSTs to /api/chat/threads and returns the threadId', async () => {
    mockFetchOk({ threadId: 'new-thread-123' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartChat(), { wrapper });

    let response: { threadId: string } | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({
        kickoff: { project: 'TestProject', repo: 'TestRepo' },
      });
    });

    expect(response).toEqual({ threadId: 'new-thread-123' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/threads',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('includes the full kickoff body in the request', async () => {
    mockFetchOk({ threadId: 'thread-xyz' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartChat(), { wrapper });

    const kickoff = {
      project: 'MyProject',
      repo: 'MyRepo',
      branch: 'feature/auth',
      skillPath: '.cursor/skills/grill-with-docs/SKILL.md',
    };

    await act(async () => {
      await result.current.mutateAsync({ kickoff });
    });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.kickoff).toEqual(kickoff);
  });
});

// ── useDeleteThread ───────────────────────────────────────────────────────────

describe('useDeleteThread', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends DELETE to the correct thread URL', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteThread(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('thread-1');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/threads/thread-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('removes the deleted thread from the chat-thread-list cache', async () => {
    mockFetchOk({ ok: true });
    const { queryClient, wrapper } = createWrapper();

    // Pre-populate the cache with two summaries
    queryClient.setQueryData<ChatThreadSummary[]>(
      ['chat-thread-list', 50],
      [threadSummary, threadSummary2],
    );

    const { result } = renderHook(() => useDeleteThread(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('thread-1');
    });

    const cached = queryClient.getQueryData<ChatThreadSummary[]>(['chat-thread-list', 50]);
    expect(cached).toHaveLength(1);
    expect(cached![0].id).toBe('thread-2');
  });

  it('removes the full-thread cache entry for the deleted thread', async () => {
    mockFetchOk({ ok: true });
    const { queryClient, wrapper } = createWrapper();

    // Pre-populate the full-thread cache
    queryClient.setQueryData(['chat-thread', 'thread-1'], { id: 'thread-1', messages: [] });

    const { result } = renderHook(() => useDeleteThread(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('thread-1');
    });

    const cached = queryClient.getQueryData(['chat-thread', 'thread-1']);
    expect(cached).toBeUndefined();
  });

  it('leaves other threads untouched in the list cache', async () => {
    mockFetchOk({ ok: true });
    const { queryClient, wrapper } = createWrapper();

    queryClient.setQueryData<ChatThreadSummary[]>(
      ['chat-thread-list', 50],
      [threadSummary, threadSummary2],
    );

    const { result } = renderHook(() => useDeleteThread(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('thread-1');
    });

    const cached = queryClient.getQueryData<ChatThreadSummary[]>(['chat-thread-list', 50]);
    expect(cached!.find((t) => t.id === 'thread-2')).toBeDefined();
  });

  it('handles an empty list cache gracefully (does not throw)', async () => {
    mockFetchOk({ ok: true });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteThread(), { wrapper });

    // No cache pre-populated — should not throw
    await expect(
      act(async () => {
        await result.current.mutateAsync('thread-1');
      }),
    ).resolves.not.toThrow();
  });
});
