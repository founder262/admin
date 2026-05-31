import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lidptdtnsvulvjdwkwvz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
)

async function checkAlerts() {
  const { data: rows, error } = await supabase
    .from('owner_booking_alerts')
    .select('*')
    .limit(1)

  if (rows && rows.length > 0) {
    console.log("COLUMNS IN owner_booking_alerts:", Object.keys(rows[0]))
    console.log("SAMPLE ENTRY:", JSON.stringify(rows[0], null, 2))
  } else {
    console.log("No entries in owner_booking_alerts.")
  }
  if (error) console.error("ERROR:", error)
}

checkAlerts()
