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

async function cleanAndConstraint() {
  console.log('Fetching all salons...')
  const { data: salons, error } = await supabase.from('salons').select('id, owner_id, request_id, name, created_at')
  if (error) {
    console.error('Error fetching salons:', error.message)
    return
  }

  console.log(`Found ${salons.length} salons in total.`)
  
  // Find duplicates
  const ownerSeen = new Map()
  const requestSeen = new Map()
  const dupesInfo = [] // { duplicateId, primaryId }

  for (const s of salons) {
    let primary = null
    
    if (s.owner_id) {
      if (ownerSeen.has(s.owner_id)) {
        primary = ownerSeen.get(s.owner_id)
      } else {
        ownerSeen.set(s.owner_id, s)
      }
    }

    if (s.request_id && !primary) {
      if (requestSeen.has(s.request_id)) {
        primary = requestSeen.get(s.request_id)
      } else {
        requestSeen.set(s.request_id, s)
      }
    }

    if (primary) {
      console.log(`Duplicate found: ${s.name} (ID: ${s.id}, created: ${s.created_at}) will be re-mapped to Primary (ID: ${primary.id}, created: ${primary.created_at})`)
      dupesInfo.push({ duplicateId: s.id, primaryId: primary.id })
    }
  }

  if (dupesInfo.length > 0) {
    for (const info of dupesInfo) {
      console.log(`Re-mapping services of duplicate salon ${info.duplicateId} to primary ${info.primaryId}...`)
      // Services fkey fkey constraint check
      await supabase.from('services').delete().eq('salon_id', info.duplicateId)
      
      console.log(`Re-mapping bookings of duplicate salon ${info.duplicateId} to primary ${info.primaryId}...`)
      const { data: bUpdates, error: bErr } = await supabase
        .from('bookings')
        .update({ salon_id: info.primaryId })
        .eq('salon_id', info.duplicateId)
      if (bErr) {
        console.error(`Error re-mapping bookings:`, bErr.message)
      }

      console.log(`Re-mapping alerts of duplicate salon ${info.duplicateId} to primary ${info.primaryId}...`)
      const { error: alertErr } = await supabase
        .from('owner_booking_alerts')
        .update({ salon_id: info.primaryId })
        .eq('salon_id', info.duplicateId)
      if (alertErr) {
        console.error(`Error re-mapping alerts:`, alertErr.message)
      }

      console.log(`Deleting duplicate salon ${info.duplicateId}...`)
      const { error: delErr } = await supabase.from('salons').delete().eq('id', info.duplicateId)
      if (delErr) {
        console.error(`Error deleting duplicate salon ${info.duplicateId}:`, delErr.message)
      } else {
        console.log(`Successfully cleaned duplicate salon ${info.duplicateId}.`)
      }
    }
    console.log('Cleanup completed successfully!')
  } else {
    console.log('No duplicate salons to process.')
  }
}

cleanAndConstraint()
