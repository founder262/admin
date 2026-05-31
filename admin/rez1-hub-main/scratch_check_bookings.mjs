
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

async function checkBookings() {
  console.log('Using Supabase URL:', supabaseUrl)
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, customers(full_name)')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching bookings:', error)
  } else {
    console.log('Recent Bookings count:', bookings?.length)
    console.log('Recent Bookings:', JSON.stringify(bookings, null, 2))
  }
}

checkBookings()
