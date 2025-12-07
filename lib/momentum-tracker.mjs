/**
 * Momentum Tracking System
 * Catches tokens BEFORE they moon by tracking score velocity
 */

import { calculateGemScore } from './token-scorer.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

const RESCORE_INTERVAL_HOURS = 6;
const MOMENTUM_THRESHOLD = 10; // Points gained in 6 hours
const MOMENTUM_SCORE_MIN = 40;
const MOMENTUM_SCORE_MAX = 69;
const UPGRADE_THRESHOLD = 70;

/**
 * Re-score all tokens in database
 * Called every 6 hours automatically
 */
export async function rescoreAllTokens() {
  console.log('[MOMENTUM] 🔄 Starting auto re-scoring of all tokens...');
  
  try {
    // Initialize Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[MOMENTUM] ❌ Supabase client not initialized');
      return { success: false, error: 'Supabase not configured' };
    }

    // Get all tokens from gem_discoveries
    const { data: tokens, error } = await supabase
      .from('gem_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false });

    if (error) {
      console.error('[MOMENTUM] ❌ Error fetching tokens:', error);
      return { success: false, error };
    }

    if (!tokens || tokens.length === 0) {
      console.log('[MOMENTUM] ℹ️ No tokens to re-score');
      return { success: true, rescored: 0 };
    }

    console.log(`[MOMENTUM] 📊 Re-scoring ${tokens.length} tokens...`);

    let rescored = 0;
    let momentumAlerts = [];
    let upgradeAlerts = [];

    for (const token of tokens) {
      try {
        // Re-score the token
        const newScoreData = await calculateGemScore(token.token_address);
        const newScore = newScoreData.score;
        const oldScore = token.initial_score;

        // Calculate score change
        const scoreChange = newScore - oldScore;
        const hoursElapsed = (Date.now() - new Date(token.discovered_at).getTime()) / (1000 * 60 * 60);
        const scoreVelocity = hoursElapsed > 0 ? scoreChange / hoursElapsed : 0;

        // Update gem_performance_updates
        await supabase
          .from('gem_performance_updates')
          .insert({
            token_address: token.token_address,
            score: newScore,
            score_breakdown: newScoreData.breakdown,
            liquidity_usd: newScoreData.metrics?.liquidity || 0,
            volume_24h_usd: newScoreData.metrics?.volume24h || 0,
            holder_count: newScoreData.metrics?.holders || 0,
            score_change: scoreChange,
            score_velocity: scoreVelocity
          });

        rescored++;

        // Check for momentum alerts (40-69 + gaining ≥10 points in 6 hours)
        if (
          newScore >= MOMENTUM_SCORE_MIN &&
          newScore <= MOMENTUM_SCORE_MAX &&
          scoreChange >= MOMENTUM_THRESHOLD &&
          hoursElapsed <= RESCORE_INTERVAL_HOURS + 1 // Allow some buffer
        ) {
          momentumAlerts.push({
            token: token.token_address,
            oldScore,
            newScore,
            scoreChange,
            hoursElapsed: Math.round(hoursElapsed * 10) / 10,
            velocity: Math.round(scoreVelocity * 10) / 10
          });
        }

        // Check for upgrade alerts (crossed from <70 to 70+)
        if (oldScore < UPGRADE_THRESHOLD && newScore >= UPGRADE_THRESHOLD) {
          upgradeAlerts.push({
            token: token.token_address,
            oldScore,
            newScore,
            scoreChange,
            hoursElapsed: Math.round(hoursElapsed * 10) / 10
          });
        }

        console.log(`[MOMENTUM] ✅ Re-scored ${token.token_address}: ${oldScore} → ${newScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange})`);

      } catch (error) {
        console.error(`[MOMENTUM] ❌ Error re-scoring ${token.token_address}:`, error.message);
      }
    }

    console.log(`[MOMENTUM] ✅ Re-scoring complete: ${rescored}/${tokens.length} tokens`);
    console.log(`[MOMENTUM] 🚀 Momentum alerts: ${momentumAlerts.length}`);
    console.log(`[MOMENTUM] 💎 Upgrade alerts: ${upgradeAlerts.length}`);

    return {
      success: true,
      rescored,
      momentumAlerts,
      upgradeAlerts
    };

  } catch (error) {
    console.error('[MOMENTUM] ❌ Error in rescoreAllTokens:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get momentum statistics for a token
 */
export async function getTokenMomentum(tokenAddress) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // Get all performance updates for this token
    const { data: updates, error } = await supabase
      .from('gem_performance_updates')
      .select('*')
      .eq('token_address', tokenAddress)
      .order('updated_at', { ascending: true });

    if (error || !updates || updates.length === 0) {
      return null;
    }

    const first = updates[0];
    const latest = updates[updates.length - 1];
    
    const totalScoreChange = latest.score - first.score;
    const hoursElapsed = (new Date(latest.updated_at) - new Date(first.updated_at)) / (1000 * 60 * 60);
    const avgVelocity = hoursElapsed > 0 ? totalScoreChange / hoursElapsed : 0;

    return {
      currentScore: latest.score,
      initialScore: first.score,
      totalScoreChange,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      avgVelocity: Math.round(avgVelocity * 10) / 10,
      updateCount: updates.length,
      trend: totalScoreChange > 0 ? 'up' : totalScoreChange < 0 ? 'down' : 'flat'
    };

  } catch (error) {
    console.error('[MOMENTUM] Error getting token momentum:', error);
    return null;
  }
}

/**
 * Get top momentum tokens (fastest movers)
 */
export async function getTopMomentumTokens(limit = 5, timeframeHours = 168) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    const { data: updates, error } = await supabase
      .from('gem_performance_updates')
      .select('*')
      .gte('updated_at', cutoffTime)
      .order('score_velocity', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MOMENTUM] Error getting top momentum tokens:', error);
      return [];
    }

    return updates || [];

  } catch (error) {
    console.error('[MOMENTUM] Error in getTopMomentumTokens:', error);
    return [];
  }
}

/**
 * Get tokens that recently crossed 70+ threshold
 */
export async function getRecentUpgrades(timeframeHours = 168) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    // Get all tokens from discoveries
    const { data: tokens, error: tokensError } = await supabase
      .from('gem_discoveries')
      .select('*')
      .lt('initial_score', UPGRADE_THRESHOLD);

    if (tokensError || !tokens) {
      return [];
    }

    const upgrades = [];

    for (const token of tokens) {
      // Get latest performance update
      const { data: latestUpdate, error: updateError } = await supabase
        .from('gem_performance_updates')
        .select('*')
        .eq('token_address', token.token_address)
        .gte('updated_at', cutoffTime)
        .gte('score', UPGRADE_THRESHOLD)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!updateError && latestUpdate && latestUpdate.length > 0) {
        upgrades.push({
          token_address: token.token_address,
          oldScore: token.initial_score,
          newScore: latestUpdate[0].score,
          scoreChange: latestUpdate[0].score - token.initial_score,
          upgradedAt: latestUpdate[0].updated_at
        });
      }
    }

    return upgrades;

  } catch (error) {
    console.error('[MOMENTUM] Error in getRecentUpgrades:', error);
    return [];
  }
}

/**
 * Generate weekly momentum digest
 */
export async function generateWeeklyDigest() {
  console.log('[MOMENTUM] 📊 Generating weekly momentum digest...');

  try {
    const topMovers = await getTopMomentumTokens(5, 168); // Top 5 in past week
    const upgrades = await getRecentUpgrades(168); // Upgrades in past week

    const digest = {
      period: 'Past 7 days',
      topMovers: topMovers.map(t => ({
        token: t.token_address,
        score: t.score,
        velocity: t.score_velocity,
        change: t.score_change
      })),
      upgrades: upgrades.map(u => ({
        token: u.token_address,
        oldScore: u.oldScore,
        newScore: u.newScore,
        change: u.scoreChange
      })),
      summary: {
        totalTopMovers: topMovers.length,
        totalUpgrades: upgrades.length,
        fastestGainer: topMovers.length > 0 ? topMovers[0].token_address : null,
        fastestVelocity: topMovers.length > 0 ? topMovers[0].score_velocity : 0
      }
    };

    console.log('[MOMENTUM] ✅ Weekly digest generated');
    console.log(`[MOMENTUM] 📈 Top movers: ${digest.topMovers.length}`);
    console.log(`[MOMENTUM] 💎 Upgrades: ${digest.upgrades.length}`);

    return digest;

  } catch (error) {
    console.error('[MOMENTUM] Error generating weekly digest:', error);
    return null;
  }
}

/**
 * Start automatic re-scoring interval
 */
export function startMomentumTracking(intervalHours = RESCORE_INTERVAL_HOURS) {
  console.log(`[MOMENTUM] 🚀 Starting momentum tracking (re-scoring every ${intervalHours} hours)`);
  
  // Run immediately on start (async, don't wait)
  rescoreAndAlert();
  
  // Then run every N hours
  const intervalMs = intervalHours * 60 * 60 * 1000;
  setInterval(rescoreAndAlert, intervalMs);
  
  console.log('[MOMENTUM] ✅ Momentum tracking started');
}

/**
 * Re-score all tokens and process alerts
 */
async function rescoreAndAlert() {
  const result = await rescoreAllTokens();
  
  if (result.success && (result.momentumAlerts?.length > 0 || result.upgradeAlerts?.length > 0)) {
    // Import here to avoid circular dependency
    const { processMomentumAlerts } = await import('./momentum-alerts.mjs');
    await processMomentumAlerts(result.momentumAlerts || [], result.upgradeAlerts || []);
  }
}

export default {
  rescoreAllTokens,
  getTokenMomentum,
  getTopMomentumTokens,
  getRecentUpgrades,
  generateWeeklyDigest,
  startMomentumTracking
};
