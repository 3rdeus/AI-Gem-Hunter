/**
 * Supabase Integration
 * Store and retrieve token safety data, maintain blacklists
 */

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Check if token is in blacklist
 */
export async function checkBlacklist(tokenAddress) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await supabase
      .from('token_blacklist')
      .select('*')
      .eq('address', tokenAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Supabase blacklist check error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        isBlacklisted: !!data,
        reason: data?.reason || null,
        addedAt: data?.created_at || null,
      },
    };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cached token safety data
 */
export async function getCachedTokenData(tokenAddress) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await supabase
      .from('token_cache')
      .select('*')
      .eq('address', tokenAddress)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase cache check error:', error);
      return { success: false, error: error.message };
    }

    // Check if cache is still fresh (5 minutes)
    if (data) {
      const cacheAge = Date.now() - new Date(data.updated_at).getTime();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

      if (cacheAge < CACHE_TTL) {
        return {
          success: true,
          data: {
            cached: true,
            cacheAge,
            ...data.data,
          },
        };
      }
    }

    return { success: true, data: { cached: false } };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save token safety data to cache
 */
export async function cacheTokenData(tokenAddress, safetyData) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { error } = await supabase
      .from('token_cache')
      .upsert({
        address: tokenAddress,
        data: safetyData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'address',
      });

    if (error) {
      console.error('Supabase cache save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get community reports for a token
 */
export async function getCommunityReports(tokenAddress) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .eq('token_address', tokenAddress)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Supabase community reports error:', error);
      return { success: false, error: error.message };
    }

    const scamReports = data?.filter(r => r.report_type === 'scam').length || 0;
    const rugReports = data?.filter(r => r.report_type === 'rug').length || 0;
    const honeypotReports = data?.filter(r => r.report_type === 'honeypot').length || 0;

    return {
      success: true,
      data: {
        totalReports: data?.length || 0,
        scamReports,
        rugReports,
        honeypotReports,
        reports: data || [],
      },
    };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze Supabase data for risk
 */
export function analyzeSupabaseData(blacklist, communityReports) {
  const warnings = [];
  let riskScore = 0;

  // Check blacklist
  if (blacklist && blacklist.success && blacklist.data.isBlacklisted) {
    warnings.push(`BLACKLISTED: ${blacklist.data.reason || 'Known scam token'}`);
    riskScore += 100; // Instant max risk
  }

  // Check community reports
  if (communityReports && communityReports.success) {
    const { totalReports, scamReports, rugReports, honeypotReports } = communityReports.data;

    if (totalReports > 0) {
      if (scamReports > 5) {
        warnings.push(`${scamReports} community scam reports`);
        riskScore += 40;
      }

      if (rugReports > 3) {
        warnings.push(`${rugReports} rug pull reports`);
        riskScore += 50;
      }

      if (honeypotReports > 3) {
        warnings.push(`${honeypotReports} honeypot reports`);
        riskScore += 45;
      }
    }
  }

  return {
    warnings,
    riskScore: Math.min(riskScore, 100),
  };
}
