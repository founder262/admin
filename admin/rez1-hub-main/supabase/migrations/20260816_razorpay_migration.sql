-- ═══════════════════════════════════════════════════════════════════
-- Razorpay Payment Gateway Integration — Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ensure Razorpay columns exist in platform_config table
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS razorpay_enabled        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS razorpay_mode           TEXT DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS razorpay_key_id         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS razorpay_key_secret     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS razorpay_account_id     TEXT DEFAULT '';

-- 2. Ensure Razorpay transaction columns exist in bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS razorpay_order_id       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_signature      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_refund_id       TEXT DEFAULT NULL;

-- 3. Set Razorpay active by default and disable PhonePe
UPDATE platform_config
SET 
  razorpay_enabled = true,
  phonepe_enabled = false,
  updated_at = NOW();

-- 4. Verification query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('platform_config', 'bookings')
  AND column_name LIKE '%razorpay%'
ORDER BY table_name, column_name;
