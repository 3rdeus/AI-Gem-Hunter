/**
 * Gem Tracker - Supabase Integration
 * Tracks discovered gems and their performance over time
 */

import { createClient } from '@supabase/supabase-js';
import { getAlertTier } from './token-scorer.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[GEM-TRACKER] ✅ Supabase client initialized');
  }
  return supabase;
}

/**
 * Save a newly discovered gem to the database
 */
export async function saveGemDiscovery(gemData) {
  const client = getSupabaseClient();
  
  if (!client) {
    console.log('[GEM-TRACKER] ⚠️ Supabase not configured, skipping gem save');
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const alertTier = getAlertTier(gemData.gemScore);
    
    const discoveryData = {
      token_address: gemData.tokenAddress,
      name: gemData.basicData?.name || 'Unknown',
      symbol: gemData.basicData?.symbol || 'UNKNOWN',
      source: gemData.source || 'unknown',
      
      discovery_score: gemData.gemScore,
      discovery_tier: alertTier.tier,
      
      initial_price: gemData.metrics?.price || null,
      initial_liquidity: gemData.metrics?.liquidity || 0,
      initial_volume_24h: gemData.metrics?.volume24h || 0,
      initial_holders: gemData.metrics?.holders || 0,
      initial_market_cap: gemData.metrics?.marketCap || 0,
      
      score_liquidity: gemData.scoreBreakdown?.liquidity || 0,
      score_volume: gemData.scoreBreakdown?.volume || 0,
      score_holders: gemData.scoreBreakdown?.holders || 0,
      score_social: gemData.scoreBreakdown?.social || 0,
      score_safety: gemData.scoreBreakdown?.safety || 0,
      
      website: gemData.social?.website || null,
      twitter: gemData.social?.twitter || null,
      telegram: gemData.social?.telegram || null,
      
      alert_sent: false,
      alert_tier: null
    };
    
    const { data, error } = await client
      .from('gem_discoveries')
      .upsert(discoveryData, { onConflict: 'token_address' })
      .select()
      .single();
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error saving gem discovery:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`[GEM-TRACKER] ✅ Saved gem discovery: ${gemData.tokenAddress} (Score: ${gemData.gemScore}/100)`);
    return { success: true, data };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception saving gem discovery:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark that an alert was sent for a gem
 */
export async function markAlertSent(tokenAddress, alertTier, score, message) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    // Update gem_discoveries
    await client
      .from('gem_discoveries')
      .update({ 
        alert_sent: true, 
        alert_tier: alertTier 
      })
      .eq('token_address', tokenAddress);
    
    // Log alert in gem_alerts_sent
    const { data, error } = await client
      .from('gem_alerts_sent')
      .insert({
        token_address: tokenAddress,
        alert_tier: alertTier,
        score: score,
        message: message
      })
      .select()
      .single();
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error marking alert sent:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`[GEM-TRACKER] ✅ Marked alert sent for ${tokenAddress}`);
    return { success: true, data };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception marking alert sent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update gem performance metrics
 */
export async function updateGemPerformance(tokenAddress, currentMetrics) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    // Get initial metrics from discovery
    const { data: discovery, error: discoveryError } = await client
      .from('gem_discoveries')
      .select('*')
      .eq('token_address', tokenAddress)
      .single();
    
    if (discoveryError || !discovery) {
      console.error(`[GEM-TRACKER] ❌ Could not find discovery for ${tokenAddress}`);
      return { success: false, error: 'Discovery not found' };
    }
    
    // Calculate performance changes
    const priceChange = discovery.initial_price && currentMetrics.price
      ? ((currentMetrics.price - discovery.initial_price) / discovery.initial_price) * 100
      : null;
    
    const liquidityChange = discovery.initial_liquidity && currentMetrics.liquidity
      ? ((currentMetrics.liquidity - discovery.initial_liquidity) / discovery.initial_liquidity) * 100
      : null;
    
    const volumeChange = discovery.initial_volume_24h && currentMetrics.volume24h
      ? ((currentMetrics.volume24h - discovery.initial_volume_24h) / discovery.initial_volume_24h) * 100
      : null;
    
    const holdersChange = discovery.initial_holders && currentMetrics.holders
      ? ((currentMetrics.holders - discovery.initial_holders) / discovery.initial_holders) * 100
      : null;
    
    // Calculate hours since discovery
    const hoursSinceDiscovery = Math.floor(
      (new Date() - new Date(discovery.discovered_at)) / (1000 * 60 * 60)
    );
    
    // Determine status
    let status = 'active';
    if (currentMetrics.liquidity === 0 || (priceChange && priceChange < -90)) {
      status = 'dead';
    } else if (priceChange && priceChange < -50) {
      status = 'rugged';
    } else if (priceChange && priceChange > 100) {
      status = 'mooning';
    }
    
    // Insert performance update
    const performanceData = {
      token_address: tokenAddress,
      current_price: currentMetrics.price || null,
      current_liquidity: currentMetrics.liquidity || 0,
      current_volume_24h: currentMetrics.volume24h || 0,
      current_holders: currentMetrics.holders || 0,
      current_market_cap: currentMetrics.marketCap || 0,
      price_change_percent: priceChange,
      liquidity_change_percent: liquidityChange,
      volume_change_percent: volumeChange,
      holders_change_percent: holdersChange,
      hours_since_discovery: hoursSinceDiscovery,
      status: status
    };
    
    const { data, error } = await client
      .from('gem_performance_updates')
      .insert(performanceData)
      .select()
      .single();
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error updating performance:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`[GEM-TRACKER] ✅ Updated performance for ${tokenAddress}: ${priceChange?.toFixed(2)}% change`);
    return { success: true, data, priceChange, status };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception updating performance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get top performing gems
 */
export async function getTopPerformers(timeWindowHours = 24, limit = 10) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { data, error } = await client
      .rpc('get_top_performers', { 
        time_window_hours: timeWindowHours, 
        limit_count: limit 
      });
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error getting top performers:', error.message);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception getting top performers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get worst performing gems (rug pulls)
 */
export async function getWorstPerformers(timeWindowHours = 24, limit = 10) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { data, error } = await client
      .rpc('get_worst_performers', { 
        time_window_hours: timeWindowHours, 
        limit_count: limit 
      });
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error getting worst performers:', error.message);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception getting worst performers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get performance summary
 */
export async function getPerformanceSummary(timeWindowHours = 24) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { data, error } = await client
      .rpc('get_performance_summary', { 
        time_window_hours: timeWindowHours 
      });
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error getting performance summary:', error.message);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data[0] };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception getting performance summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all discovered gems with optional filters
 */
export async function getDiscoveredGems(filters = {}) {
  const client = getSupabaseClient();
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    let query = client
      .from('gem_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false });
    
    if (filters.minScore) {
      query = query.gte('discovery_score', filters.minScore);
    }
    
    if (filters.tier) {
      query = query.eq('discovery_tier', filters.tier);
    }
    
    if (filters.source) {
      query = query.eq('source', filters.source);
    }
    
    if (filters.alertSent !== undefined) {
      query = query.eq('alert_sent', filters.alertSent);
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[GEM-TRACKER] ❌ Error getting discovered gems:', error.message);
      return { success: false, error: error.message };
    }
    
    return { success: true, data, count: data.length };
    
  } catch (error) {
    console.error('[GEM-TRACKER] ❌ Exception getting discovered gems:', error);
    return { success: false, error: error.message };
  }
}
