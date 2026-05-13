---
name: fullstack-node-bff
description: Best practices for this project's full-stack TypeScript architecture — Express backend serving a React/Vite frontend from the same Node process. Use when adding API routes, client-side data fetching, shared types, environment variables, auth-gated endpoints, or when the user asks about where code belongs (client vs server), how the app is served in production, how Vite dev proxying works, or how this compares to .NET backend patterns.
disable-model-invocation: true
---

# Full-Stack Node BFF (Backend for Frontend)

Single TypeScript monorepo: Express serves both the API and the React SPA from one Node process.

## Project layout

```
src/
  server/       — Express API (Node.js, CommonJS, tsconfig.server.json)
    routes/     — Express routers mounted in index.ts
    services/   — Business logic (never import from client/)
    middleware/ — Auth, error handling
    db.ts       — Singleton pg Pool
  client/       — React + Vite (ESM, tsconfig.client.json)
    hooks/      — Data-fetching hooks (useQuery wrappers, EventSource)
    services/   — fetch() wrappers that call /api/*
    components/ — React components
    config/
      env.ts    — Zod-validated VITE_ env vars
  shared/       — Types/utils imported by BOTH server AND client
    types/      — TypeScript interfaces shared across the boundary
    utils/      — Pure functions (no platform-specific imports)
```

## Dev vs production serving

| | Local dev | Production (Azure App Service) |
|---|---|---|
| Client | Vite dev server (`localhost:5173`) | Express serves `dist/client/` |
| API | Express (`localhost:3001`) | Same Express process, same origin |
| How `/api/*` is reached | Vite proxies to `localhost:3001` | Direct same-origin request |
| Env vars | `.env` via `dotenv.config()` | Azure App Service `app_settings` (Terraform) |

## Rule: client API calls always use relative `/api` paths

```typescript
// ✅ GOOD — works in dev (proxied) and production (same-origin)
const response = await fetch('/api/workitems', { credentials: 'include' });

// ❌ BAD — breaks in production
const response = await fetch('http://localhost:3001/api/workitems');
```

Always pass `credentials: 'include'` for any session-authenticated endpoint.

## Rule: never import server code from the client (or vice versa)

```typescript
// ❌ BAD — drags pg, passport, etc. into the Vite bundle
import pool from '../../server/db';

// ✅ GOOD — communicate via HTTP; share types via src/shared/
import type { WorkItem } from '../../shared/types/workitem';
```

`src/shared/` is the only safe import boundary between client and server.

## Adding a new API endpoint (checklist)

1. **Shared type** — add request/response shape to `src/shared/types/`
2. **Route handler** — add to `src/server/routes/*.ts`
3. **Mount it** — register in `src/server/index.ts` with `ensureAuthenticated` if auth-gated
4. **Client service** — add a `fetch('/api/...')` wrapper in `src/client/services/`
5. **React hook** — wrap with a custom hook in `src/client/hooks/`

## Environment variables

### Server-side — never exposed to the browser
```typescript
const pat = process.env.ADO_PAT; // read in src/server/ only
```

### Client-side — must be prefixed `VITE_`, bundled at build time, no secrets
```typescript
// Always go through the Zod-validated module
import { env } from '../config/env';
const org = env.VITE_ADO_ORG;
```
Add new client vars to the `envSchema` in `src/client/config/env.ts`.

## Auth pattern

All routes except `/auth/*` are protected by `ensureAuthenticated`.

```typescript
// src/server/index.ts
app.use('/api/my-feature', ensureAuthenticated, myFeatureRoutes);
```

Client fetches must include `credentials: 'include'` to send the session cookie.
On 401, redirect to `/auth/login`.

## Production static serving (Express)

```
GET /api/*       → Express router
GET /assets/*    → express.static, 1-year cache (Vite adds content hashes)
GET /index.html  → no-cache (always latest)
GET *            → catch-all returns index.html (React Router SPA fallback)
```

Never add Express routes that conflict with React Router client-side paths.

## TypeScript compilation — two separate configs

```bash
npx tsc -p tsconfig.server.json --noEmit   # server changes
npx tsc -p tsconfig.client.json --noEmit   # client changes
```

`src/shared/` is included in both configs — it must compile cleanly under both.

## .NET mental model mapping

| .NET | This project |
|---|---|
| `Controllers/` | `src/server/routes/*.ts` |
| `Services/` | `src/server/services/*.ts` |
| Shared DTO / `Models/` | `src/shared/types/*.ts` |
| `appsettings.json` | `.env` (dev) / Azure App Service settings (prod) |
| `wwwroot/` | `dist/client/` served by `express.static` |
| IIS / Kestrel | `app.listen()` in `src/server/index.ts` |
| `[Authorize]` | `ensureAuthenticated` middleware |
| `HttpClient` (server-to-server) | `fetch()` or SDK in `src/server/services/` |
