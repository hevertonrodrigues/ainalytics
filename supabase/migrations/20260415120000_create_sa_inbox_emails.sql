-- ============================================================================
-- SA Inbox Emails — Store inbound emails from SendGrid Inbound Parse
-- Receives emails sent to contato@mail.ainalytics.tech
-- ============================================================================

-- ─── 1. Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sa_inbox_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    TEXT UNIQUE,                          -- SendGrid message ID (dedup)
  from_email    TEXT NOT NULL,
  from_name     TEXT,
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '(no subject)',
  body_text     TEXT,                                 -- plain-text body
  body_html     TEXT,                                 -- HTML body
  envelope      JSONB,                                -- raw envelope data
  headers       JSONB,                                -- raw email headers
  is_read       BOOLEAN NOT NULL DEFAULT false,
  is_starred    BOOLEAN NOT NULL DEFAULT false,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Indexes ─────────────────────────────────────────────────────────────

-- Main listing queries: non-archived, newest first
CREATE INDEX idx_sa_inbox_emails_listing
  ON sa_inbox_emails (is_archived, received_at DESC);

-- Unread filter
CREATE INDEX idx_sa_inbox_emails_unread
  ON sa_inbox_emails (is_read, received_at DESC)
  WHERE is_read = false AND is_archived = false;

-- Full-text search on subject and sender
CREATE INDEX idx_sa_inbox_emails_search
  ON sa_inbox_emails USING gin (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(from_name, '') || ' ' || coalesce(from_email, ''))
  );

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE sa_inbox_emails ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role (edge functions) can access.
-- SA admin access is enforced at the edge function layer via verifySuperAdmin().
