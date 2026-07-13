import { createClient } from '@supabase/supabase-js';

// Test with ANON key (same key used in customer panel)
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';
const URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';

const anonClient = createClient(URL, ANON_KEY);

async function check() {
  console.log('Testing ANON read on platform_config...');
  const { data, error } = await anonClient
    .from('platform_config')
    .select('categories_enabled')
    .maybeSingle();

  if (error) {
    console.log('❌ ANON cannot read platform_config:', error.message);
    console.log('   → This is why categories always show! The fallback default (true) is used.');
  } else if (!data) {
    console.log('⚠️  ANON read returned no rows (null)');
  } else {
    console.log('✅ ANON can read platform_config. categories_enabled =', data.categories_enabled);
  }

  console.log('\nTesting ANON read on categories...');
  const { data: cats, error: catsErr } = await anonClient
    .from('categories')
    .select('name, is_active')
    .eq('is_active', true);

  if (catsErr) {
    console.log('❌ ANON cannot read categories:', catsErr.message);
  } else {
    console.log('✅ ANON can read categories. Active categories:', cats);
  }
}

check();
