import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking platform_config row:");
  const { data: config, error: configErr } = await supabase
    .from('platform_config')
    .select('*')
    .maybeSingle();
  
  if (configErr) {
    console.error("Config error:", configErr);
  } else {
    console.log("Config keys:", Object.keys(config || {}));
    console.log("Config value:", config);
  }

  console.log("\nChecking if categories table exists:");
  const { data: catData, error: catErr } = await supabase
    .from('categories')
    .select('*');
  
  if (catErr) {
    console.log("categories table check failed:", catErr.message);
  } else {
    console.log("categories table exists! Rows:", catData);
  }
}

check();
