import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('=').map(s => s.trim()))
)

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function getRlsPolicies() {
  const { data, error } = await supabase.rpc('get_rls_policies')
  if (error) {
    // If RPC doesn't exist, we can query PG catalogs directly using supabase admin sql or functions
    console.log('RPC get_rls_policies not found. Let us fetch the actual policies from pg_policies.')
    const { data: policies, error: err2 } = await supabase.from('pg_policies').select('*')
    // Wait, pg_policies might not be exposed as a table, let's see.
    // If not, we can query using RPC if there's any SQL exec rpc or try to read them.
    if (err2) {
      console.log('pg_policies fetch error:', err2.message)
    } else {
      console.log('Policies:', policies)
    }
  } else {
    console.log('RLS Policies:', data)
  }
}

getRlsPolicies()
