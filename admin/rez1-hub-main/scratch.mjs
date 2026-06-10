import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, status, cancelled_by, created_at, updated_at')
    .eq('status', 'cancelled')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("All Cancelled Bookings sorted by created_at desc:");
  data.forEach((b, idx) => {
    console.log(`${idx + 1}. Ref: ${b.booking_ref} | By: ${b.cancelled_by} | Created: ${b.created_at} | Updated: ${b.updated_at}`);
  });
}

check();
