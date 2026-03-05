-- Add 'canceled' value to the payment_attempt_status enum
ALTER TYPE payment_attempt_status ADD VALUE IF NOT EXISTS 'canceled';
