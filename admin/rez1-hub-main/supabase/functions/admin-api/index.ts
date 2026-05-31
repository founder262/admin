// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function recalculateSalonLocations(supabaseAdmin: any) {
  const { data: locations } = await supabaseAdmin
    .from('locations')
    .select('id, name')
    .eq('is_active', true);

  if (!locations || locations.length === 0) return;

  const { data: salons } = await supabaseAdmin
    .from('salons')
    .select('id, name, address, location_id');

  if (!salons || salons.length === 0) return;

  const normalizePlaceString = (value: string) =>
    (value || "")
      .toLowerCase()
      .replace(/[-_.]/g, " ")
      .replace(/[^ - \w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getBestLocationMatch = (address: string, locs: any[]) => {
    const normalizedAddress = normalizePlaceString(address);
    const candidates = locs
      .map((loc: any) => ({
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

  const fallbackLoc = locations.find((loc: any) => loc.name.toLowerCase() === 'chennai') || locations[0];

  for (const salon of salons) {
    const matched = getBestLocationMatch(salon.address || "", locations);
    const targetLocId = matched ? matched.id : fallbackLoc.id;

    if (salon.location_id !== targetLocId) {
      console.log(`Re-assigning salon "${salon.name}" from location ${salon.location_id} to ${targetLocId}`);
      await supabaseAdmin
        .from('salons')
        .update({ location_id: targetLocId })
        .eq('id', salon.id);
    }
  }

  // Recalculate salons_count for all locations (active & inactive)
  const { data: allLocs } = await supabaseAdmin.from('locations').select('id');
  if (allLocs) {
    for (const loc of allLocs) {
      const { count } = await supabaseAdmin
        .from('salons')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', loc.id)
        .eq('is_approved', true)
        .eq('is_suspended', false)
        .eq('is_visible', true);

      await supabaseAdmin
        .from('locations')
        .update({ salons_count: count || 0 })
        .eq('id', loc.id);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, table, data, id, query, filters, orderBy, eqFilters } = await req.json()

    // Analytics shortcut — fetches all needed data with service role (bypasses RLS)
    if (action === 'ANALYTICS') {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const lastWeekStr = lastWeek.toISOString().split('T')[0]

      const supabaseAdmin2 = createClient(
        Deno.env.get('SUPABASE_URL') ?? 'https://lidptdtnsvulvjdwkwvz.supabase.co',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
      )

      const [bookingsRes, salonsRes, requestsRes, completedRes] = await Promise.all([
        supabaseAdmin2.from('bookings').select('booking_date, id').gte('booking_date', lastWeekStr),
        supabaseAdmin2.from('salons').select('id, is_suspended'),
        supabaseAdmin2.from('salon_requests').select('id').eq('status', 'pending'),
        supabaseAdmin2.from('bookings').select('total_price, salons(name)').eq('status', 'completed'),
      ])

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            weeklyBookings: bookingsRes.data || [],
            salons: salonsRes.data || [],
            pendingRequests: requestsRes.data || [],
            completedBookings: completedRes.data || [],
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? 'https://lidptdtnsvulvjdwkwvz.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
    )

    let result: any = { data: null, error: null }

    switch (action) {
      case 'SELECT':
        // Some tables use different timestamp column names
        const defaultOrder = table === 'customers' ? 'joined_at' : 'created_at'
        let selectQuery = supabaseAdmin.from(table).select(query || '*')
        if (id) {
          selectQuery = selectQuery.eq('id', id)
        }
        // Support eqFilters: [{ column, value }] for filtering
        if (eqFilters && Array.isArray(eqFilters)) {
          eqFilters.forEach((f: any) => {
            selectQuery = selectQuery.eq(f.column, f.value)
          })
        }
        // Legacy filters support
        if (filters && Array.isArray(filters) && !eqFilters) {
          filters.forEach((f: any) => {
            selectQuery = selectQuery.eq(f.column, f.value)
          })
        }
        // Support custom orderBy: { column, ascending }
        const finalOrder = orderBy?.column || defaultOrder
        const ascending = orderBy?.ascending !== undefined ? orderBy.ascending : false
        result = await selectQuery.order(finalOrder, { ascending })
        break

      case 'UPDATE':
        if (table === 'salons' && data.address) {
          const normalizePlaceString = (value: string) => (value || "").toLowerCase().replace(/[-_.]/g, " ").replace(/[^ - \w\s]/g, " ").replace(/\s+/g, " ").trim();
          const { data: locations } = await supabaseAdmin.from('locations').select('id, name').eq('is_active', true);
          if (locations && locations.length > 0) {
            const normalizedAddress = normalizePlaceString(data.address);
            const candidates = locations.map((loc: any) => ({ ...loc, normalizedName: normalizePlaceString(loc.name) })).filter((loc: any) => loc.normalizedName.length > 0);
            const exactMatches = candidates.filter((loc: any) => normalizedAddress === loc.normalizedName || normalizedAddress.startsWith(`${loc.normalizedName} `) || normalizedAddress.endsWith(` ${loc.normalizedName}`) || normalizedAddress.includes(` ${loc.normalizedName} `));
            const matches = exactMatches.length ? exactMatches : candidates.filter((loc: any) => normalizedAddress.includes(loc.normalizedName));
            if (matches.length > 0) {
              const matchedLoc = matches.sort((a: any, b: any) => {
                const aTokens = a.normalizedName.split(" ").length;
                const bTokens = b.normalizedName.split(" ").length;
                if (bTokens !== aTokens) return bTokens - aTokens;
                return b.normalizedName.length - a.normalizedName.length;
              })[0];
              data.location_id = matchedLoc.id;
            } else {
              const fallbackLoc = locations.find((loc: any) => loc.name.toLowerCase() === 'chennai') || locations[0];
              data.location_id = fallbackLoc.id;
            }
          }
        }
        result = await supabaseAdmin
          .from(table)
          .update(data)
          .eq('id', id)
          .select()
          
        if (table === 'salons') {
          const { data: allLocs } = await supabaseAdmin.from('locations').select('id');
          if (allLocs) {
            for (const loc of allLocs) {
              const { count } = await supabaseAdmin.from('salons').select('*', { count: 'exact', head: true }).eq('location_id', loc.id).eq('is_approved', true).eq('is_suspended', false).eq('is_visible', true);
              await supabaseAdmin.from('locations').update({ salons_count: count || 0 }).eq('id', loc.id);
            }
          }
        }
        if (table === 'locations') {
          await recalculateSalonLocations(supabaseAdmin);
        }
        break

      case 'INSERT':
        result = await supabaseAdmin
          .from(table)
          .insert(data)
          .select()

        if (table === 'locations') {
          await recalculateSalonLocations(supabaseAdmin);
        }
        break

      case 'DELETE':
        result = await supabaseAdmin
          .from(table)
          .delete()
          .eq('id', id)
          
        if (table === 'salons') {
          const { data: allLocs } = await supabaseAdmin.from('locations').select('id');
          if (allLocs) {
            for (const loc of allLocs) {
              const { count } = await supabaseAdmin.from('salons').select('*', { count: 'exact', head: true }).eq('location_id', loc.id).eq('is_approved', true).eq('is_suspended', false).eq('is_visible', true);
              await supabaseAdmin.from('locations').update({ salons_count: count || 0 }).eq('id', loc.id);
            }
          }
        }
        if (table === 'locations') {
          await recalculateSalonLocations(supabaseAdmin);
        }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    if (result.error) {
      console.error(`DB Error (${action} ${table}):`, result.error)
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: unknown) {
    console.error('Proxy Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
