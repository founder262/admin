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

async function getInfo() {
  const { data: cols, error: err1 } = await supabase.rpc('get_table_cols')
  if (err1) {
    // If RPC doesn't exist, query PG catalogs directly using SQL injection via supabase rpc or another way?
    // Wait, let's just query a single row from each table to inspect keys and types!
    console.log('RPC get_table_cols not found, fetching single rows to inspect keys...')
    const tables = ['salon_requests', 'salons', 'bookings', 'owners', 'customers']
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*').limit(1)
      if (error) console.log(`${t} fetch error:`, error.message)
      else console.log(`${t} keys:`, data[0] ? Object.keys(data[0]) : 'empty table')
    }
  } else {
    console.log('Table columns:', cols)
  }
}

getInfo()
