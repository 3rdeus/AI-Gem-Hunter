// Supabase Edge Function for Token Safety Check
// Deploy with: supabase functions deploy check-token

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tokenAddress } = await req.json()

    if (!tokenAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing tokenAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check cache
    const { data: cached } = await supabaseClient
      .from('token_cache')
      .select('*')
      .eq('address', tokenAddress)
      .single()

    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime()
      if (cacheAge < 300000) { // 5 minutes
        return new Response(
          JSON.stringify({ success: true, data: { ...cached.data, from_cache: true } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch data from APIs (implement your logic here)
    // This is a simplified version - you'll need to add the full API integration

    const response = {
      success: true,
      data: {
        token_address: tokenAddress,
        token_name: 'Token',
        safety_score: 50,
        checked_at: new Date().toISOString(),
      },
    }

    // Cache the result
    await supabaseClient
      .from('token_cache')
      .upsert({
        address: tokenAddress,
        data: response.data,
        updated_at: new Date().toISOString(),
      })

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
