import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lidptdtnsvulvjdwkwvz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
);

async function main() {
  console.log('\n=== Checking promo_banners table ===');
  const { data: banners, error: bErr } = await supabase
    .from('promo_banners')
    .select('id, title, media_type, media_url, is_active, display_order')
    .order('display_order');

  if (bErr) {
    console.error('Error fetching banners:', bErr.message);
  } else {
    console.log(`Found ${banners.length} banner(s):`);
    banners.forEach(b => {
      console.log(`  [${b.is_active ? 'ACTIVE' : 'INACTIVE'}] #${b.display_order} "${b.title}" (${b.media_type})`);
      console.log(`    URL: ${b.media_url}`);
    });
  }

  console.log('\n=== Checking storage buckets ===');
  const { data: buckets, error: buckErr } = await supabase.storage.listBuckets();
  if (buckErr) {
    console.error('Error listing buckets:', buckErr.message);
  } else {
    buckets.forEach(b => {
      console.log(`  Bucket: "${b.name}" | public: ${b.public}`);
    });

    const promoBucket = buckets.find(b => b.name === 'promo-media');
    if (!promoBucket) {
      console.log('\n⚠️  "promo-media" bucket does NOT exist! You need to create it in Supabase Storage.');
    } else if (!promoBucket.public) {
      console.log('\n⚠️  "promo-media" bucket exists but is NOT PUBLIC.');
      console.log('   → Images will not load. Run the fix below to make it public.');

      // Attempt to make it public
      const { error: updateErr } = await supabase.storage.updateBucket('promo-media', { public: true });
      if (updateErr) {
        console.error('   Failed to make bucket public:', updateErr.message);
      } else {
        console.log('   ✅ Bucket successfully made public!');
      }
    } else {
      console.log('\n✅ "promo-media" bucket is public — storage access is fine.');
    }
  }
}

main().catch(console.error);
