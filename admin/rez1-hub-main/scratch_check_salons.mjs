
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

async function checkSalons() {
  console.log('Checking salons...')
  
  const { data, error } = await supabase
    .from('salons')
    .select('id, name, owner_id')
  
  if (error) {
    console.log(`Error - ${error.message}`)
  } else {
    console.log(`Salons:`, JSON.stringify(data, null, 2))
  }
}

checkSalons()
