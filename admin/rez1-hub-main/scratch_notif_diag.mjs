// Diagnostic: inspect actual columns in owner_booking_alerts and notifications tables
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lidptdtnsvulvjdwkwvz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
)

async function run() {
  // 1. Check owner_booking_alerts schema by fetching 1 row
  const { data: alertRow, error: alertErr } = await supabase
    .from('owner_booking_alerts')
    .select('*')
    .limit(1)
  
  console.log('\n=== owner_booking_alerts ===')
  if (alertErr) console.error('ERROR:', alertErr.message)
  else if (alertRow?.length) console.log('Columns:', Object.keys(alertRow[0]))
  else console.log('Table is EMPTY - no rows found')

  // 2. Check notifications schema by fetching 1 row
  const { data: notifRow, error: notifErr } = await supabase
    .from('notifications')
    .select('*')
    .limit(1)
  
  console.log('\n=== notifications ===')
  if (notifErr) console.error('ERROR:', notifErr.message)
  else if (notifRow?.length) console.log('Columns:', Object.keys(notifRow[0]))
  else console.log('Table is EMPTY - no rows found')

  // 3. Count all alerts
  const { count: alertCount } = await supabase
    .from('owner_booking_alerts')
    .select('*', { count: 'exact', head: true })
  console.log('\nTotal owner_booking_alerts rows:', alertCount)

  // 4. Count all notifications
  const { count: notifCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
  console.log('Total notifications rows:', notifCount)

  // 5. Try ordering by created_at on owner_booking_alerts (to detect if that column exists)
  const { data: orderedAlerts, error: orderErr } = await supabase
    .from('owner_booking_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)
  
  console.log('\n=== owner_booking_alerts ordered by created_at ===')
  if (orderErr) console.error('ORDER ERROR (column may not exist):', orderErr.message)
  else console.log('Sample rows:', JSON.stringify(orderedAlerts, null, 2))
}

run().catch(console.error)
