/**
 * AI Gem Hunter Service
 * Integrates real-time discovery with Telegram notifications
 * NOW WITH LIQUIDITY FILTERING
 */

import { startTokenDiscovery, getDiscoveryStats } from '../lib/real-time-discovery.mjs';
import {
  sendGemAlert,
  sendCriticalWarning,
  sendSmartMoneyAlert,
  sendDailySummary,
  sendTestMessage
} from '../lib/telegram-bot.mjs';
import { checkLiquidity } from '../lib/liquidity-checker.mjs';

/**
 * Service state
 */
let isRunning = false;
let discoveryWebSocket = null;
let stats = {
  gemsDiscovered: 0,
  alertsSent: 0,
  criticalWarnings: 0,
  startTime: null,
  topGems: [],
  tokensFiltered: 0,  // NEW: Track filtered tokens
  liquidityCheckErrors: 0  // NEW: Track API errors
};

/**
 * Start the AI Gem Hunter service
 */
export async function startGemHunter() {
  if (isRunning) {
    console.log('⚠️ Gem Hunter is already running');
    return { success: false, message: 'Already running' };
  }

  console.log('🚀 Starting AI Gem Hunter Service...');

  // Start token discovery with callback
  discoveryWebSocket = startTokenDiscovery(handleGemDiscovered);

  isRunning = true;
  stats.startTime = new Date();

  console.log('✅ AI Gem Hunter Service started');
  console.log('👀 Monitoring Raydium, Orca, and pump.fun for new launches...');

  // Schedule daily summary (every 24 hours)
  setInterval(sendDailySummaryReport, 24 * 60 * 60 * 1000);

  return {
    success: true,
    message: 'AI Gem Hunter started successfully',
    stats: getServiceStats()
  };
}

/**
 * Stop the AI Gem Hunter service
 */
export function stopGemHunter() {
  if (!isRunning) {
    return { success: false, message: 'Service not running' };
  }

  isRunning = false;

  console.log('🛑 Stopping AI Gem Hunter Service...');

  if (discoveryWebSocket) {
    discoveryWebSocket.close();
    discoveryWebSocket = null;
  }

  console.log('✅ AI Gem Hunter Service stopped');

  return {
    success: true,
    message: 'Service stopped',
    stats: getServiceStats()
  };
}

/**
 * Handle gem discovered callback
 * NOW WITH LIQUIDITY FILTERING
 * @param {Object} gemData - Discovered gem data
 */
async function handleGemDiscovered(gemData) {
  try {
    console.log(`💎 Gem discovered: ${gemData.tokenAddress}`);

    // ============================================
    // NEW: LIQUIDITY FILTER
    // ============================================
    const liquidityCheck = await checkLiquidity(gemData.tokenAddress);
    
    if (liquidityCheck.error) {
      // Track API errors but don't block the token
      stats.liquidityCheckErrors++;
      console.log(`⚠️ Liquidity check error for ${gemData.tokenAddress}: ${liquidityCheck.error}`);
    }
    
    if (!liquidityCheck.passed) {
      // Token failed liquidity check - filter it out
      stats.tokensFiltered++;
      console.log(`🚫 Token ${gemData.tokenAddress} filtered: liquidity too low ($${liquidityCheck.liquidity.toFixed(2)} < $150)`);
      return; // Skip this token
    }
    
    console.log(`✅ Token ${gemData.tokenAddress} passed liquidity filter: $${liquidityCheck.liquidity.toFixed(2)}`);
    // ============================================

    stats.gemsDiscovered++;

    // Add to top gems list
    stats.topGems.push({
      address: gemData.tokenAddress,
      name: gemData.basicData?.name,
      symbol: gemData.basicData?.symbol,
      score: gemData.gemScore,
      liquidity: liquidityCheck.liquidity,  // NEW: Include liquidity in gem data
      discoveredAt: new Date()
    });

    // Keep only top 10 gems
    stats.topGems.sort((a, b) => b.score - a.score);
    stats.topGems = stats.topGems.slice(0, 10);

    // Determine if we should send alert based on gem score
    // Only send alerts for high-quality gems (score >= 80)
    if (gemData.gemScore >= 80) {
      // High-quality gem - send alert
      const alertResult = await sendGemAlert(gemData);

      if (alertResult.success) {
        stats.alertsSent++;
        console.log(`✅ Alert sent for gem: ${gemData.tokenAddress}`);
      } else {
        console.error(`❌ Failed to send alert: ${alertResult.error}`);
      }
    } else {
      console.log(`ℹ️ Gem score (${gemData.gemScore}) below alert threshold (80) - skipping alert`);
    }

  } catch (error) {
    console.error('❌ Error handling gem discovery:', error);
  }
}

/**
 * Send daily summary report
 */
async function sendDailySummaryReport() {
  try {
    const summary = {
      gemsDiscovered: stats.gemsDiscovered,
      alertsSent: stats.alertsSent,
      tokensFiltered: stats.tokensFiltered,  // NEW: Include in summary
      liquidityCheckErrors: stats.liquidityCheckErrors,  // NEW: Include in summary
      topGems: stats.topGems.slice(0, 5), // Top 5 gems
      uptime: Date.now() - stats.startTime.getTime()
    };

    await sendDailySummary(summary);
    console.log('📊 Daily summary sent');

  } catch (error) {
    console.error('❌ Error sending daily summary:', error);
  }
}

/**
 * Get service statistics
 */
export function getServiceStats() {
  const discoveryStats = getDiscoveryStats();

  return {
    isRunning,
    uptime: isRunning ? Date.now() - stats.startTime.getTime() : 0,
    gemsDiscovered: stats.gemsDiscovered,
    alertsSent: stats.alertsSent,
    tokensFiltered: stats.tokensFiltered,  // NEW
    liquidityCheckErrors: stats.liquidityCheckErrors,  // NEW
    filterEfficiency: stats.gemsDiscovered > 0 
      ? ((stats.tokensFiltered / (stats.gemsDiscovered + stats.tokensFiltered)) * 100).toFixed(2) + '%'
      : '0%',  // NEW: Show what % of tokens are being filtered
    topGems: stats.topGems,
    discoveryStats
  };
}

/**
 * Health check endpoint
 */
export function healthCheck() {
  return {
    status: isRunning ? 'healthy' : 'stopped',
    uptime: isRunning ? Date.now() - stats.startTime.getTime() : 0,
    stats: getServiceStats()
  };
}
