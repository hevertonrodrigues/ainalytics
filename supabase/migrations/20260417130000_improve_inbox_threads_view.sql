-- Replace the inbox threads view with one that behaves like a real email client:
--   • sort by most recent activity in the thread
--   • display the correspondent (last inbound sender), not our own outgoing "from"
--   • aggregate flags across the whole thread (unread if ANY unread; archived only if ALL archived)
--   • use the ROOT email subject (not the latest "Re: ..." prefix churn)

DROP VIEW IF EXISTS sa_inbox_threads_view;

CREATE VIEW sa_inbox_threads_view AS
WITH thread_stats AS (
  SELECT
    thread_id,
    MAX(received_at)         AS last_activity_at,
    COUNT(*)                 AS message_count,
    bool_or(NOT is_read)     AS has_unread,
    bool_or(is_starred)      AS any_starred,
    bool_and(is_archived)    AS all_archived
  FROM sa_inbox_emails
  GROUP BY thread_id
),
last_any AS (
  SELECT DISTINCT ON (thread_id)
    thread_id,
    id,
    from_email,
    from_name,
    to_email,
    body_text,
    body_html,
    received_at
  FROM sa_inbox_emails
  ORDER BY thread_id, received_at DESC, id DESC
),
last_inbound AS (
  SELECT DISTINCT ON (thread_id)
    thread_id,
    from_email,
    from_name,
    to_email
  FROM sa_inbox_emails
  WHERE from_email <> 'contato@mail.ainalytics.tech'
  ORDER BY thread_id, received_at DESC, id DESC
),
first_email AS (
  SELECT DISTINCT ON (thread_id)
    thread_id,
    subject
  FROM sa_inbox_emails
  ORDER BY thread_id, received_at ASC, id ASC
)
SELECT
  la.id,
  s.thread_id,
  COALESCE(li.from_email, la.from_email) AS from_email,
  COALESCE(li.from_name,  la.from_name)  AS from_name,
  COALESCE(li.to_email,   la.to_email)   AS to_email,
  f.subject,
  la.body_text,
  la.body_html,
  NOT s.has_unread  AS is_read,
  s.any_starred     AS is_starred,
  s.all_archived    AS is_archived,
  s.last_activity_at AS received_at,
  s.message_count
FROM thread_stats s
JOIN last_any     la ON la.thread_id = s.thread_id
LEFT JOIN last_inbound li ON li.thread_id = s.thread_id
JOIN first_email  f  ON f.thread_id = s.thread_id;
