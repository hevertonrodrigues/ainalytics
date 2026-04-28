-- =====================================================================
-- Course catalog + course purchases — completely separate from
-- subscription billing (subscriptions / payments / payment_attempts).
--
-- Rationale: course payments are one-time purchases that may originate
-- from anonymous prospects (no tenant, no auth user yet). They live in
-- their own ledger so course revenue, refunds and reconciliation never
-- mix with recurring SaaS subscription accounting.
-- =====================================================================

-- ─── Courses catalog (global, public-readable) ─────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  -- Prices stored per supported currency (smallest unit handled at Stripe layer)
  price_brl       NUMERIC(10, 2),
  price_usd       NUMERIC(10, 2),
  price_eur       NUMERIC(10, 2),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active) WHERE is_active = true;

CREATE TRIGGER set_updated_at_courses
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Course purchase status ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE course_purchase_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'canceled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Course purchases (one-time payments, separate ledger) ─────────────
CREATE TABLE IF NOT EXISTS course_purchases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Course reference (frozen slug + name in case the course row changes later)
  course_id                   UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_slug                 TEXT NOT NULL,
  course_name                 TEXT NOT NULL,

  -- Buyer (no tenant_id by design — course buyers are prospects, not tenants)
  customer_email              TEXT NOT NULL,
  customer_name               TEXT,
  customer_phone              TEXT,
  customer_locale             TEXT,
  -- Optional link if the buyer is already a registered Ainalytics user
  user_id                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Stripe references — flag and IDs that prove this is a COURSE payment
  -- and never a subscription one
  payment_type                TEXT NOT NULL DEFAULT 'course'
    CHECK (payment_type = 'course'),
  stripe_session_id           TEXT UNIQUE,
  stripe_payment_intent_id    TEXT,
  stripe_charge_id            TEXT,
  stripe_customer_id          TEXT,

  -- Money
  amount                      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'brl',
  payment_method              TEXT, -- 'card', 'pix', 'boleto', etc.

  -- Lifecycle
  status                      course_purchase_status NOT NULL DEFAULT 'pending',
  paid_at                     TIMESTAMPTZ,
  refunded_at                 TIMESTAMPTZ,
  failure_reason              TEXT,

  -- Marketing attribution (captured client-side at checkout)
  utm_source                  TEXT,
  utm_medium                  TEXT,
  utm_campaign                TEXT,
  utm_term                    TEXT,
  utm_content                 TEXT,
  referrer                    TEXT,

  -- Audit
  raw_session                 JSONB,
  raw_event                   JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_purchases_course_id          ON course_purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_email              ON course_purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_course_purchases_status             ON course_purchases(status);
CREATE INDEX IF NOT EXISTS idx_course_purchases_stripe_session_id  ON course_purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id            ON course_purchases(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_purchases_created_at         ON course_purchases(created_at DESC);

CREATE TRIGGER set_updated_at_course_purchases
  BEFORE UPDATE ON course_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

-- Courses: public read of active courses (for marketing pages)
DROP POLICY IF EXISTS "courses_public_read" ON courses;
CREATE POLICY "courses_public_read"
  ON courses
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Course purchases: NO public read policies. Mutations & queries flow only
-- through Edge Functions using the admin (service_role) client, mirroring
-- the project rule for tenant tables.

-- ─── Seed: GEO Essencial course (R$97 / US$20 launch pricing) ──────────
INSERT INTO courses (slug, name, description, price_brl, price_usd, price_eur, metadata)
VALUES (
  'geo-essencial',
  'GEO Essencial',
  'Curso direto para sua marca aparecer no ChatGPT, Claude, Gemini e Grok em 30 dias.',
  97.00,
  20.00,
  18.00,
  jsonb_build_object(
    'modules', 5,
    'lessons', 19,
    'duration_min', 210,
    'lifetime_access', true,
    'guarantee_days', 7,
    'launch_price', true,
    'normal_price_brl', 397.00
  )
)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE courses           IS 'Course catalog. Global (no tenant). Public-readable when is_active=true.';
COMMENT ON TABLE course_purchases  IS 'One-time course payment ledger. Completely separate from subscriptions / payments / payment_attempts.';
COMMENT ON COLUMN course_purchases.payment_type IS 'Always ''course''. Hard-pinned via CHECK so the table can never accidentally absorb a subscription payment.';
