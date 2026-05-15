/**
 * Integration-style tests for the /api/chat routes.
 *
 * - All service dependencies are mocked so no real DB or agent runner is used.
 * - The RBAC middleware is mocked with a controllable pass/block flag so each
 *   test suite can verify both the happy path and the 403 gate.
 */
import request from 'supertest';
import express from 'express';

// ── Controllable permission flag ───────────────────────────────────────────────
// Must start with 'mock' so Jest's hoist transform allows the factory to
// reference it before the let declaration executes.
let mockPermissionGranted = true;

jest.mock('../middleware/rbac', () => ({
  requirePermission: (..._keys: string[]) =>
    (_req: any, res: any, next: any) => {
      if (mockPermissionGranted) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden', missing: _keys });
      }
    },
  requireAnyPermission: (..._keys: string[]) =>
    (_req: any, _res: any, next: any) => next(),
  attachPermissions: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/chatAgentService', () => ({
  createThread: jest.fn(),
  getThread: jest.fn(),
  getThreadAsync: jest.fn(),
  listThreadSummaries: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn(),
  subscribeToThread: jest.fn().mockReturnValue(() => {}),
  cancelRun: jest.fn(),
  closeThread: jest.fn(),
  readOutputPrd: jest.fn().mockReturnValue(null),
  writeOutputPrd: jest.fn(),
  readOutputBacklog: jest.fn().mockReturnValue(null),
}));

jest.mock('../services/wikiCatalog', () => ({
  saveWikiPage: jest.fn(),
}));

jest.mock('../services/chatThreadRepository', () => ({
  toggleFlag: jest.fn(),
}));

jest.mock('../utils/requestUser', () => ({
  getUserId: jest.fn().mockReturnValue('user-1'),
}));

import chatRouter from '../routes/chat';
import * as chatAgentService from '../services/chatAgentService';

const mockChatService = chatAgentService as jest.Mocked<typeof chatAgentService>;

// ── App factory ────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { profile: { oid: 'user-1' } };
    next();
  });
  app.use('/api/chat', chatRouter);
  return app;
}

// ── Permission gate: chat:view ─────────────────────────────────────────────────

describe('chat routes — chat:view permission gate', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
    jest.clearAllMocks();
    mockChatService.listThreadSummaries.mockResolvedValue([]);
  });

  it('passes through to the handler when the user has chat:view', async () => {
    const res = await request(buildApp()).get('/api/chat/threads');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 403 when the user lacks chat:view', async () => {
    mockPermissionGranted = false;

    const res = await request(buildApp()).get('/api/chat/threads');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden', missing: ['chat:view'] });
  });

  it('gates every sub-route — POST /threads also returns 403 without permission', async () => {
    mockPermissionGranted = false;

    const res = await request(buildApp())
      .post('/api/chat/threads')
      .send({ kickoff: { project: 'proj', repo: 'repo' } });

    expect(res.status).toBe(403);
  });
});

// ── Handler behaviour (with permission) ───────────────────────────────────────

describe('GET /api/chat/threads', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
    jest.clearAllMocks();
  });

  it('returns 200 with an empty thread list', async () => {
    mockChatService.listThreadSummaries.mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/chat/threads');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when listThreadSummaries throws', async () => {
    mockChatService.listThreadSummaries.mockRejectedValue(new Error('DB error'));

    const res = await request(buildApp()).get('/api/chat/threads');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/chat/threads', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
    jest.clearAllMocks();
  });

  it('returns 400 when kickoff.project is missing', async () => {
    const res = await request(buildApp())
      .post('/api/chat/threads')
      .send({ kickoff: { repo: 'repo' } });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'kickoff.project is required' });
  });

  it('returns 400 when kickoff.repo is missing', async () => {
    const res = await request(buildApp())
      .post('/api/chat/threads')
      .send({ kickoff: { project: 'proj' } });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'kickoff.repo is required' });
  });
});
