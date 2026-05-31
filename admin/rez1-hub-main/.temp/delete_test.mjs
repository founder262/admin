import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteData() {
  const reqId = 'e21fb163-d323-426c-b720-1be1f9254afd';
  
  // First delete from salons
  const { error: err1 } = await supabase.from('salons').delete().eq('request_id', reqId);
  console.log("Delete from salons:", err1 || "Success");

  // Then delete from salon_requests
  const { error: err2 } = await supabase.from('salon_requests').delete().eq('id', reqId);
  console.log("Delete from salon_requests:", err2 || "Success");
}

deleteData();
