
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

async function testBooking() {
  console.log('Testing booking table...')
  
  // Try to insert a dummy booking (it might fail if RLS is on and we are not auth'd)
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: '00000000-0000-0000-0000-000000000000', // dummy
      salon_id: '00000000-0000-0000-0000-000000000000', // dummy
      status: 'upcoming',
      booking_date: '2026-01-01',
      booking_time: '10:00 AM'
    })
    .select()

  if (error) {
    console.log(`Insert Error - ${error.message}`)
  } else {
    console.log(`Insert Success! Data:`, JSON.stringify(data, null, 2))
  }
}

testBooking()
