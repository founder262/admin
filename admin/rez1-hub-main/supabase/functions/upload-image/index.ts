// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const bucket = formData.get('bucket')
    const path = formData.get('path')

    if (!file || !bucket || !path) {
      return new Response(JSON.stringify({ error: 'Missing file, bucket, or path' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? 'https://lidptdtnsvulvjdwkwvz.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'
    )

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
      })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)

    return new Response(JSON.stringify({ url: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Upload Error:', error)
    // Return 200 so supabase-js parses the JSON payload instead of throwing a generic Non-2xx error.
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
