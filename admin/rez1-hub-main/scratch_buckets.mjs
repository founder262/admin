import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }
  console.log('Buckets:', buckets.map(b => b.name));

  const requiredBuckets = ['salon-images', 'upi-scanners'];
  for (const bucket of requiredBuckets) {
    if (!buckets.find(b => b.name === bucket)) {
      console.log(`Creating bucket ${bucket}...`);
      const { data, error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) console.error(`Error creating ${bucket}:`, createError);
      else console.log(`Created ${bucket}`);
    } else {
        // Ensure bucket is public
        const { data, error: updateError } = await supabase.storage.updateBucket(bucket, {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            fileSizeLimit: 5242880 // 5MB
        });
        if (updateError) console.error(`Error updating ${bucket}:`, updateError);
        else console.log(`Updated ${bucket} to be public`);
    }
  }
}

checkBuckets();
