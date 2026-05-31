import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
  const { data: requests } = await supabase.from('salon_requests').select('*').eq('email', 'team@dudexai.in');
  if (requests && requests.length > 0) {
    const req = requests[0];
    console.log("Found request:", req.id, req.status);
    
    await supabase.from('salon_requests').update({ status: 'pending' }).eq('id', req.id);
    
    // Also delete from salons table so it recreates it or updates it safely
    await supabase.from('salons').delete().eq('request_id', req.id);
    
    console.log("Reset complete. You can now approve again.");
  }
}

reset();
