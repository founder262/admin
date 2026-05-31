// Quick test: call the admin-api edge function exactly as the panels will
const SUPABASE_URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

async function testAdminApi() {
  console.log('Testing admin-api edge function for promo_banners...\n');

  // Test 1: Admin panel — all banners
  const res1 = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      action: 'SELECT',
      table: 'promo_banners',
      query: '*',
      orderBy: { column: 'display_order', ascending: true }
    })
  });
  const data1 = await res1.json();
  console.log('[Admin] All banners fetch:');
  if (data1.success) {
    console.log(`  ✅ Got ${data1.data.length} banners`);
    data1.data.forEach(b => console.log(`     [${b.is_active ? 'ACTIVE' : 'OFF'}] "${b.title}" | ${b.media_url?.substring(0,60)}...`));
  } else {
    console.log('  ❌ Error:', data1.error);
  }

  // Test 2: Customer panel — active only
  console.log('\n[Customer] Active banners fetch:');
  const res2 = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      action: 'SELECT',
      table: 'promo_banners',
      query: '*',
      eqFilters: [{ column: 'is_active', value: true }],
      orderBy: { column: 'display_order', ascending: true }
    })
  });
  const data2 = await res2.json();
  if (data2.success) {
    console.log(`  ✅ Got ${data2.data.length} active banners`);
    data2.data.forEach(b => console.log(`     "${b.title}" | media_url: ${b.media_url?.substring(0,70)}`));
  } else {
    console.log('  ❌ Error:', data2.error);
  }
}

testAdminApi().catch(console.error);
