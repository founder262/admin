-- ═══════════════════════════════════════════════════════════════════
-- Completely Remove PhonePe Columns from platform_config Table
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE platform_config
  DROP COLUMN IF EXISTS phonepe_enabled,
  DROP COLUMN IF EXISTS phonepe_merchant_id,
  DROP COLUMN IF EXISTS phonepe_salt_key,
  DROP COLUMN IF EXISTS phonepe_salt_index,
  DROP COLUMN IF EXISTS phonepe_env,
  DROP COLUMN IF EXISTS phonepe_client_id,
  DROP COLUMN IF EXISTS phonepe_client_secret,
  DROP COLUMN IF EXISTS phonepe_client_version,
  DROP COLUMN IF EXISTS phonepe_webhook_url,
  DROP COLUMN IF EXISTS phonepe_webhook_username,
  DROP COLUMN IF EXISTS phonepe_webhook_password,
  DROP COLUMN IF EXISTS phonepe_success_url,
  DROP COLUMN IF EXISTS phonepe_failure_url,
  DROP COLUMN IF EXISTS phonepe_cancel_url;
