
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

async function checkAlerts() {
  console.log('Checking owner_booking_alerts...')
  
  const { data, error, count } = await supabase
    .from('owner_booking_alerts')
    .select('*', { count: 'exact' })
  
  if (error) {
    console.log(`Error - ${error.message}`)
  } else {
    console.log(`Count - ${count}`)
    console.log(`Alerts:`, JSON.stringify(data, null, 2))
  }
}

checkAlerts()
