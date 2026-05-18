-- Up Migration

CREATE TABLE interviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_thread_id  UUID        NOT NULL UNIQUE REFERENCES chat_threads(id) ON DELETE CASCADE,
  author_id       TEXT        NOT NULL,
  title           TEXT        NOT NULL DEFAULT 'Untitled Interview',
  project         TEXT        NOT NULL,
  repo            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interviews_author_updated ON interviews (author_id, updated_at DESC);
CREATE INDEX idx_interviews_status ON interviews (status);

CREATE TABLE prds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id     UUID        REFERENCES interviews(id) ON DELETE SET NULL,
  chat_thread_id   UUID        REFERENCES chat_threads(id) ON DELETE CASCADE,
  author_id        TEXT        NOT NULL,
  title            TEXT        NOT NULL DEFAULT 'Untitled PRD',
  content          TEXT        NOT NULL DEFAULT '',
  backlog_json     JSONB,
  status           TEXT        NOT NULL DEFAULT 'draft',
  reviewer_id      TEXT,
  review_comment   TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prds_author_updated ON prds (author_id, updated_at DESC);
CREATE INDEX idx_prds_interview_id ON prds (interview_id);
CREATE INDEX idx_prds_status ON prds (status);

-- RBAC: add interviews:view and interviews:manage permissions
INSERT INTO app_permissions (key, description, category) VALUES
  ('interviews:view',   'View interviews and PRDs',                       'interviews'),
  ('interviews:manage', 'Create and manage interviews and PRDs',          'interviews');

-- Retire backlog:view; replace with interviews:view for roles that had it
-- First copy old backlog:view assignments to interviews:view and interviews:manage
INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app_roles r, app_permissions p
WHERE p.key = 'interviews:view'
  AND r.name IN ('admin', 'member', 'viewer');

INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app_roles r, app_permissions p
WHERE p.key = 'interviews:manage'
  AND r.name IN ('admin', 'member');

-- Remove backlog:view
DELETE FROM app_role_permissions
WHERE permission_id = (SELECT id FROM app_permissions WHERE key = 'backlog:view');

DELETE FROM app_permissions WHERE key = 'backlog:view';

-- Down Migration

DROP TABLE IF EXISTS prds;
DROP TABLE IF EXISTS interviews;

DELETE FROM app_role_permissions
WHERE permission_id IN (
  SELECT id FROM app_permissions WHERE key IN ('interviews:view', 'interviews:manage')
);
DELETE FROM app_permissions WHERE key IN ('interviews:view', 'interviews:manage');

-- Restore backlog:view
INSERT INTO app_permissions (key, description, category) VALUES
  ('backlog:view', 'View interview backlog', 'backlog');

INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app_roles r, app_permissions p
WHERE p.key = 'backlog:view'
  AND r.name IN ('admin', 'member');
