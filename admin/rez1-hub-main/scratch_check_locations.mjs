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

async function checkLocations() {
  const { data: locations } = await supabase.from('locations').select('id, name, salons_count')
  const { data: salons } = await supabase.from('salons').select('id, name, address, location_id')

  console.log("Locations:")
  locations.forEach(l => console.log(`- ${l.name} (ID: ${l.id}, Count: ${l.salons_count})`))

  console.log("\nSalons:")
  salons.forEach(s => {
    const locName = locations.find(l => l.id === s.location_id)?.name || 'NONE'
    console.log(`- ${s.name} | Address: ${s.address} | Location: ${locName}`)
  })
}

checkLocations()
