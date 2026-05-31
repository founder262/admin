
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('=').map(s => s.trim()))
)

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('Checking tables...')
  
  // Try to fetch from common tables to see if they exist and have data
  const tables = ['bookings', 'salons', 'customers', 'salon_requests', 'platform_config']
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.log(`Table ${table}: Error - ${error.message}`)
    } else {
      console.log(`Table ${table}: Count - ${count}`)
    }
  }
}

checkSchema()
