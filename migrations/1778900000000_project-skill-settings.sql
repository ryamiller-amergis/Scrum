CREATE TABLE IF NOT EXISTS project_skill_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT UNIQUE NOT NULL,
  skill_repo TEXT NOT NULL,
  skill_branch TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
