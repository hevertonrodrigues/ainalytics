-- ============================================================
-- Add 'pending_payment' to proposals.status CHECK constraint
-- Required for Stripe Checkout integration: proposals enter
-- pending_payment after checkout session creation, then move
-- to accepted once the stripe-webhook confirms payment.
-- ============================================================

ALTER TABLE proposals DROP CONSTRAINT proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'expired', 'pending_payment'));
