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

const normalizePlaceString = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[-_.]/g, " ")
    .replace(/[^ - \w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBestLocationMatch = (address, locations) => {
  const normalizedAddress = normalizePlaceString(address);
  const candidates = (locations || [])
    .map((loc) => ({
      ...loc,
      normalizedName: normalizePlaceString(loc.name),
    }))
    .filter((loc) => loc.normalizedName.length > 0);

  const exactMatches = candidates.filter((loc) => {
    const name = loc.normalizedName;
    return (
      normalizedAddress === name ||
      normalizedAddress.startsWith(`${name} `) ||
      normalizedAddress.endsWith(` ${name}`) ||
      normalizedAddress.includes(` ${name} `)
    );
  });

  const matches = exactMatches.length
    ? exactMatches
    : candidates.filter((loc) => normalizedAddress.includes(loc.normalizedName));

  if (!matches.length) return null;

  return matches.sort((a, b) => {
    const aTokens = a.normalizedName.split(" ").length;
    const bTokens = b.normalizedName.split(" ").length;
    if (bTokens !== aTokens) return bTokens - aTokens;
    return b.normalizedName.length - a.normalizedName.length;
  })[0];
};

async function fixLocations() {
  const { data: locations } = await supabase.from('locations').select('id, name').eq('is_active', true)
  const { data: salons } = await supabase.from('salons').select('id, name, address, location_id')

  console.log("Re-evaluating Salon Locations...")
  for (const s of salons) {
    const matched = getBestLocationMatch(s.address || "", locations)
    if (matched) {
      if (s.location_id !== matched.id) {
        console.log(`Updating ${s.name} location from ${s.location_id} to ${matched.name} (${matched.id})`)
        await supabase.from('salons').update({ location_id: matched.id }).eq('id', s.id)
      } else {
        console.log(`${s.name} is correctly mapped to ${matched.name}.`)
      }
    } else {
      console.log(`No location match found for ${s.name} (Address: ${s.address})`)
    }
  }

  console.log("\nRecalculating all location salon_counts...")
  for (const loc of locations) {
    const { count } = await supabase.from('salons')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', loc.id)
      .eq('is_approved', true)
      .eq('is_visible', true)
    
    await supabase.from('locations').update({ salons_count: count || 0 }).eq('id', loc.id)
    console.log(`- ${loc.name} -> ${count || 0} active salons`)
  }

  console.log("Database synchronization complete.")
}

fixLocations()
