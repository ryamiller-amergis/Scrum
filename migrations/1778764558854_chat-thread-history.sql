-- Up Migration

CREATE TABLE chat_threads (
  id                UUID        PRIMARY KEY,
  user_id           TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'idle',
  kickoff           JSONB       NOT NULL,
  cursor_agent_id   TEXT,
  workspace_dir     TEXT,
  last_error        TEXT,
  saved_wiki_url    TEXT,
  title             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_threads_user_activity
  ON chat_threads (user_id, last_activity_at DESC);

CREATE TABLE chat_messages (
  id          UUID        PRIMARY KEY,
  thread_id   UUID        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  tool_name   TEXT,
  ts          TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_thread_ts
  ON chat_messages (thread_id, ts);

CREATE TABLE chat_message_attachments (
  id          UUID  PRIMARY KEY,
  message_id  UUID  NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  type        TEXT  NOT NULL DEFAULT 'text/plain',
  size        INT   NOT NULL,
  path        TEXT
);

CREATE INDEX idx_chat_message_attachments_message
  ON chat_message_attachments (message_id);

-- Down Migration

-- Note: node-pg-migrate expects the down migration after a separator comment.
-- Run `npm run migrate:down` to revert.

DROP TABLE IF EXISTS chat_message_attachments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_threads;
