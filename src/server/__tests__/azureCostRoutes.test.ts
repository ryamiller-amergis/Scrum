/**
 * Integration-style tests for the /api/azure routes.
 *
 * - AzureCostService is fully mocked so no real Azure credentials are needed.
 * - The RBAC middleware is mocked with a controllable pass/block flag so each
 *   test suite can verify both the happy path and the 403 gate.
 */
import request from 'supertest';
import express from 'express';

// ── Controllable permission flag ──────────────────────────────────────────────
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

// Mock AzureCostService so no Azure credentials are required at module load time.
jest.mock('../services/azureCost', () => ({
  AzureCostService: jest.fn().mockImplementation(() => ({
    getSubscriptions: jest.fn().mockResolvedValue([{ subscriptionId: 'sub-1', displayName: 'Test' }]),
    getResourceGroups: jest.fn().mockResolvedValue([]),
    getSubscriptionsWithResourceGroups: jest.fn().mockResolvedValue([]),
    getCostData: jest.fn().mockResolvedValue([]),
    getDashboardData: jest.fn().mockResolvedValue([]),
  })),
}));

import azureCostRouter from '../routes/azureCost';

// ── App factory ────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { profile: { oid: 'user-1' } };
    next();
  });
  app.use('/api/azure', azureCostRouter);
  return app;
}

// ── Permission gate: cost:view ─────────────────────────────────────────────────

describe('azureCost routes — cost:view permission gate', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
  });

  it('passes through to the handler when the user has cost:view', async () => {
    const res = await request(buildApp()).get('/api/azure/subscriptions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ subscriptionId: 'sub-1', displayName: 'Test' }]);
  });

  it('returns 403 when the user lacks cost:view', async () => {
    mockPermissionGranted = false;

    const res = await request(buildApp()).get('/api/azure/subscriptions');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden', missing: ['cost:view'] });
  });

  it('gates every sub-route — dashboard also returns 403 without permission', async () => {
    mockPermissionGranted = false;

    const res = await request(buildApp()).get('/api/azure/dashboard');

    expect(res.status).toBe(403);
  });
});

// ── Handler behaviour (with permission) ───────────────────────────────────────

describe('GET /api/azure/subscriptions', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
  });

  it('returns 200 with subscription list', async () => {
    const res = await request(buildApp()).get('/api/azure/subscriptions');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/azure/cost-data', () => {
  beforeEach(() => {
    mockPermissionGranted = true;
  });

  it('returns 400 when required query params are missing', async () => {
    const res = await request(buildApp()).get('/api/azure/cost-data');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Missing required parameters') });
  });
});
