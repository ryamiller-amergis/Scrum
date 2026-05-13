---
name: postgresql-migrations
description: Guides creation and management of PostgreSQL schema migrations using node-pg-migrate in this project. Use when adding a new table, altering a column, creating an index, or when the user asks about database schema changes, EF migrations equivalent, "how do I add a column", or "how do I create a table".
disable-model-invocation: true
---

# PostgreSQL Migrations (node-pg-migrate)

This project uses `node-pg-migrate` with the `pg` driver. Migrations are plain SQL files in `migrations/`.

## Create a migration

```bash
npm run migrate:create -- add-work-items-table
# Creates: migrations/20260513120000_add-work-items-table.sql
```

## Migration file structure

```sql
-- Up Migration
CREATE TABLE work_items (
  id          SERIAL PRIMARY KEY,
  ado_id      INTEGER NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  state       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS work_items;
```

## Apply / roll back

```bash
npm run migrate:up      # apply all pending migrations
npm run migrate:down    # roll back the last migration
```

`node-pg-migrate` reads `DATABASE_URL` from the environment automatically — same variable used by `src/server/db.ts`.

## Environment targets

| Target | Command | Reads from |
|---|---|---|
| **Local DB** | `npm run migrate:local:up` | `.env.local` → `localhost:5432/aipilot` |
| **Cloud dev DB** | `npm run migrate:up` | `.env` → Azure `DATABASE_URL` |
| **Production** | Run in CI/CD pipeline before `npm start` | App Service env var |

Always test migrations locally first:
```bash
# 1. scaffold
npm run migrate:local:create -- add-my-table

# 2. test locally
npm run migrate:local:up

# 3. verify, then roll back if needed
npm run migrate:local:down

# 4. once happy, apply to cloud dev
npm run migrate:up
```

`.env.local` is git-ignored. If it doesn't exist, create it:
```
DATABASE_URL=postgresql://pgadmin:yourpassword@localhost:5432/aipilot
```
One-time DB setup if the local database doesn't exist yet:
```bash
createdb -U pgadmin aipilot
# or in psql: CREATE DATABASE aipilot;
```

## Common patterns

**Add a column safely:**
```sql
-- Up
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Down
ALTER TABLE work_items DROP COLUMN IF EXISTS assigned_to;
```

**Add an index (non-blocking):**
```sql
-- Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_items_state ON work_items(state);

-- Down
DROP INDEX IF EXISTS idx_work_items_state;
```

**Foreign key:**
```sql
-- Up
ALTER TABLE sprints ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

-- Down
ALTER TABLE sprints DROP COLUMN IF EXISTS team_id;
```

**Rename a column:**
```sql
-- Up
ALTER TABLE work_items RENAME COLUMN old_name TO new_name;

-- Down
ALTER TABLE work_items RENAME COLUMN new_name TO old_name;
```

## .NET EF equivalent commands

| EF Migrations | node-pg-migrate |
|---|---|
| `dotnet ef migrations add Name` | `npm run migrate:create -- name` |
| `dotnet ef database update` | `npm run migrate:up` |
| `dotnet ef migrations revert` | `npm run migrate:down` |

The main difference: EF generates C# from your model diff; `node-pg-migrate` uses SQL files you write by hand. The SQL gives you full control with no magic.
