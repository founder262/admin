import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lidptdtnsvulvjdwkwvz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo');

async function check() {
    const { data: salons } = await supabase.from('salons').select('id, name, owner_id, request_id, created_at');
    const grouped = {};
    for (const s of salons || []) {
        if (!grouped[s.name]) grouped[s.name] = [];
        grouped[s.name].push(s);
    }
    for (const name in grouped) {
        if (grouped[name].length > 1) {
            console.log('--- Duplicate Name: ' + name + ' ---');
            console.log(grouped[name]);
        }
    }
}
check();
