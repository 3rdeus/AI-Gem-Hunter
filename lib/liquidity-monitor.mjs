/**
 * Liquidity Inflection Monitor
 * Tracks liquidity changes over time and detects sudden inflections
 */

import { query } from './postgres.js';

/**
 * Record liquidity snapshot for a token
 */
export async function recordLiquiditySnapshot(tokenAddress, liquidityUsd, volume24hUsd, priceUsd) {
  try {
    await query(
      `INSERT INTO liquidity_history (token_address, liquidity_usd, volume_24h_usd, price_usd, recorded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenAddress, liquidityUsd, volume24hUsd, priceUsd, new Date().toISOString()]
    );

    return { success: true };

  } catch (error) {
    console.error('[LIQUIDITY-MONITOR] Error in recordLiquiditySnapshot:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get liquidity at a specific time in the past
 */
async function getLiquidityAt(tokenAddress, hoursAgo) {
  try {
    const targetTime = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000));

    const result = await query(
      `SELECT * FROM liquidity_history
       WHERE token_address = $1 AND recorded_at <= $2
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [tokenAddress, targetTime.toISOString()]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return result.rows[0];

  } catch (error) {
    console.error('[LIQUIDITY-MONITOR] Error getting historical liquidity:', error);
    return null;
  }
}

/**
 * Calculate liquidity change percentage
 */
function calculateLiquidityChange(currentLiq, previousLiq) {
  if (!previousLiq || previousLiq.liquidity_usd === 0) {
    return 0;
  }

  const changePct = ((currentLiq - previousLiq.liquidity_usd) / previousLiq.liquidity_usd) * 100;
  return Math.round(changePct * 10) / 10; // Round to 1 decimal
}

/**
 * Detect liquidity inflections for a token
 */
export async function detectLiquidityInflection(tokenAddress, currentLiquidityUsd) {
  try {
    // Get liquidity from 6 hours ago
    const liq6h = await getLiquidityAt(tokenAddress, 6);
    
    // Get liquidity from 24 hours ago
    const liq24h = await getLiquidityAt(tokenAddress, 24);

    const change6h = liq6h ? calculateLiquidityChange(currentLiquidityUsd, liq6h) : 0;
    const change24h = liq24h ? calculateLiquidityChange(currentLiquidityUsd, liq24h) : 0;

    // Inflection threshold: >50% increase in <6 hours
    const hasInflection6h = change6h >= 50;
    const hasInflection24h = change24h >= 100;

    if (hasInflection6h || hasInflection24h) {
      console.log(`[LIQUIDITY-MONITOR] 🚨 LIQUIDITY INFLECTION DETECTED!`);
      console.log(`[LIQUIDITY-MONITOR] Token: ${tokenAddress}`);
      console.log(`[LIQUIDITY-MONITOR] 6h change: +${change6h}%`);
      console.log(`[LIQUIDITY-MONITOR] 24h change: +${change24h}%`);
      console.log(`[LIQUIDITY-MONITOR] Current: $${currentLiquidityUsd.toLocaleString()}`);

      // Update gem_discoveries with liquidity changes
      await supabase
        .from('gem_discoveries')
        .update({
          liquidity_change_6h_pct: change6h,
          liquidity_change_24h_pct: change24h
        })
        .eq('token_address', tokenAddress);

      return {
        hasInflection: true,
        change6h,
        change24h,
        currentLiquidity: currentLiquidityUsd,
        previousLiquidity6h: liq6h?.liquidity_usd || 0,
        previousLiquidity24h: liq24h?.liquidity_usd || 0
      };
    }

    // Update gem_discoveries even if no inflection
    if (change6h !== 0 || change24h !== 0) {
      await supabase
        .from('gem_discoveries')
        .update({
          liquidity_change_6h_pct: change6h,
          liquidity_change_24h_pct: change24h
        })
        .eq('token_address', tokenAddress);
    }

    return {
      hasInflection: false,
      change6h,
      change24h,
      currentLiquidity: currentLiquidityUsd
    };

  } catch (error) {
    console.error('[LIQUIDITY-MONITOR] Error detecting inflection:', error);
    return { hasInflection: false, error: error.message };
  }
}

/**
 * Monitor liquidity for all active tokens
 */
export async function monitorAllTokenLiquidity() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[LIQUIDITY-MONITOR] Supabase client not initialized');
    return { success: false };
  }

  try {
    console.log('[LIQUIDITY-MONITOR] 📊 Monitoring liquidity for all active tokens...');

    // Get all tokens discovered in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

    const { data: tokens, error: tokensError } = await supabase
      .from('gem_discoveries')
      .select('token_address, liquidity_usd, volume_24h_usd, price_usd')
      .gte('discovered_at', sevenDaysAgo.toISOString())
      .order('discovered_at', { ascending: false });

    if (tokensError) {
      console.error('[LIQUIDITY-MONITOR] Error fetching tokens:', tokensError);
      return { success: false, error: tokensError };
    }

    if (!tokens || tokens.length === 0) {
      console.log('[LIQUIDITY-MONITOR] No active tokens to monitor');
      return { success: true, tokensMonitored: 0, inflectionsDetected: 0 };
    }

    console.log(`[LIQUIDITY-MONITOR] 🔍 Monitoring ${tokens.length} tokens...`);

    let inflectionsDetected = 0;
    const inflectionAlerts = [];

    for (const token of tokens) {
      // Record current snapshot
      await recordLiquiditySnapshot(
        token.token_address,
        token.liquidity_usd || 0,
        token.volume_24h_usd || 0,
        token.price_usd || 0
      );

      // Detect inflections
      const inflection = await detectLiquidityInflection(
        token.token_address,
        token.liquidity_usd || 0
      );

      if (inflection.hasInflection) {
        inflectionsDetected++;
        inflectionAlerts.push({
          tokenAddress: token.token_address,
          ...inflection
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[LIQUIDITY-MONITOR] ✅ Monitored ${tokens.length} tokens`);
    console.log(`[LIQUIDITY-MONITOR] 🎯 Detected ${inflectionsDetected} inflections`);

    return {
      success: true,
      tokensMonitored: tokens.length,
      inflectionsDetected,
      inflectionAlerts
    };

  } catch (error) {
    console.error('[LIQUIDITY-MONITOR] Error in monitorAllTokenLiquidity:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start automated liquidity monitoring (runs every hour)
 */
export function startLiquidityMonitoring() {
  console.log('[LIQUIDITY-MONITOR] 📊 Starting automated liquidity monitoring...');
  
  // Run immediately
  monitorAllTokenLiquidity();
  
  // Then run every hour
  const INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(monitorAllTokenLiquidity, INTERVAL);
  
  console.log('[LIQUIDITY-MONITOR] ✅ Liquidity monitoring scheduled (every 1 hour)');
}

/**
 * Get liquidity trend for a token
 */
export async function getLiquidityTrend(tokenAddress, hours = 24) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

    const { data, error } = await supabase
      .from('liquidity_history')
      .select('*')
      .eq('token_address', tokenAddress)
      .gte('recorded_at', startTime.toISOString())
      .order('recorded_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Calculate trend
    const first = data[0];
    const last = data[data.length - 1];
    const changePct = ((last.liquidity_usd - first.liquidity_usd) / first.liquidity_usd) * 100;

    return {
      dataPoints: data.length,
      firstLiquidity: first.liquidity_usd,
      lastLiquidity: last.liquidity_usd,
      changePct: Math.round(changePct * 10) / 10,
      trend: changePct > 10 ? 'INCREASING' : changePct < -10 ? 'DECREASING' : 'STABLE',
      history: data
    };

  } catch (error) {
    console.error('[LIQUIDITY-MONITOR] Error getting liquidity trend:', error);
    return null;
  }
}
