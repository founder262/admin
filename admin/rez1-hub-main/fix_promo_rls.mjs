import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';
const ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';
const URL       = 'https://lidptdtnsvulvjdwkwvz.supabase.co';

const adminClient = createClient(URL, SERVICE_KEY);
const anonClient  = createClient(URL, ANON_KEY);

const today = new Date().toISOString().split('T')[0];

async function main() {
  // ── 1. Test anon read ──────────────────────────────────────────────────────
  console.log(`\nToday: ${today}`);
  console.log('\n[1] Testing anon key read on promo_banners...');
  const { data: anonData, error: anonErr } = await anonClient
    .from('promo_banners').select('id, title, is_active, start_date, end_date').order('display_order');

  if (anonErr) {
    console.log('❌ BLOCKED by RLS:', anonErr.message);
    console.log('   → The admin & customer panels cannot read banners. Fix with SQL below.\n');
    needSql = true;
  } else {
    console.log(`✅ Anon CAN read promo_banners. Found ${anonData.length} rows.`);
    anonData.forEach(b => {
      const startOk = !b.start_date || b.start_date <= today;
      const endOk   = !b.end_date   || b.end_date   >= today;
      const shows   = b.is_active && startOk && endOk;
      console.log(`   [${b.is_active ? 'ON' : 'OFF'}] "${b.title}" | start:${b.start_date||'-'} end:${b.end_date||'-'} | shows today: ${shows ? '✅' : '❌'}`);
      if (!startOk) console.log(`        ↳ start_date (${b.start_date}) > today (${today}) — banner not active yet`);
      if (!endOk)   console.log(`        ↳ end_date (${b.end_date}) < today (${today}) — banner expired`);
    });
    needSql = false;
  }

  // ── 2. Print SQL fix if needed ─────────────────────────────────────────────
  if (needSql) {
    console.log(`
══════════════════════════════════════════════════════
REQUIRED SQL — paste in Supabase Dashboard > SQL Editor
══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public can read all promo banners" ON public.promo_banners;
CREATE POLICY "Public can read all promo banners"
  ON public.promo_banners FOR SELECT
  USING (true);
══════════════════════════════════════════════════════
`);
  }
}

let needSql = false;
main().catch(console.error);
