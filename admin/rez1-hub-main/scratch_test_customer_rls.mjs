
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

async function testCustomerInsert() {
  console.log('Testing customer table RLS...')
  
  const { data, error } = await supabase
    .from('customers')
    .upsert({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      full_name: 'Test Customer',
      phone: '1234567890'
    })

  if (error) {
    console.log(`Upsert Error - ${error.message}`)
  } else {
    console.log(`Upsert Success!`)
  }
}

testCustomerInsert()
