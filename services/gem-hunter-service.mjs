/**
 * AI Gem Hunter Service
 * Integrates real-time discovery with Telegram notifications
 */

import { startTokenDiscovery, getDiscoveryStats } from '../lib/real-time-discovery.mjs';
import {
  sendGemAlert,
  sendCriticalWarning,
  sendSmartMoneyAlert,
  sendDailySummary,
  sendTestMessage
} from '../lib/telegram-bot.mjs';

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
  topGems: []
};

/**
 * Start the AI Gem Hunter service
 */
export async function startGemHunter() {
  if (isRunning) {
    console.log('Gem Hunter is already running');
    return { success: false, message: 'Already running' };
  }

  console.log('🚀 Starting AI Gem Hunter Service...');
  
  // Send test message to confirm Telegram is working
  const testResult = await sendTestMessage();
  if (!testResult.success) {
    console.error('❌ Telegram bot not configured properly');
    return {
      success: false,
      message: 'Telegram bot configuration error',
      error: testResult.error
    };
  }

  console.log('✅ Telegram bot connected');

  // Start token discovery with callback
  discoveryWebSocket = startTokenDiscovery(handleGemDiscovered);
  
  isRunning = true;
  stats.startTime = new Date();

  console.log('✅ AI Gem Hunter Service started');
  console.log('📡 Monitoring Raydium, Orca, and pump.fun for new launches...');

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

  console.log('⏸️ Stopping AI Gem Hunter Service...');

  if (discoveryWebSocket) {
    discoveryWebSocket.close();
    discoveryWebSocket = null;
  }

  isRunning = false;

  console.log('✅ AI Gem Hunter Service stopped');

  return {
    success: true,
    message: 'Service stopped',
    stats: getServiceStats()
  };
}

/**
 * Handle gem discovered callback
 * @param {Object} gemData - Discovered gem data
 */
async function handleGemDiscovered(gemData) {
  try {
    console.log(`💎 Gem discovered: ${gemData.tokenAddress}`);

    stats.gemsDiscovered++;

    // Add to top gems list
    stats.topGems.push({
      address: gemData.tokenAddress,
      name: gemData.basicData.name,
      symbol: gemData.basicData.symbol,
      score: gemData.gemScore,
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
        console.log(`✅ Gem alert sent: ${gemData.basicData.name}`);
      } else {
        console.error(`❌ Failed to send gem alert: ${alertResult.error}`);
      }
    } else {
      console.log(`📊 Gem score below threshold (${gemData.gemScore}/100 < 80) - no alert sent`);
    }

    // Check for critical warnings (bundled launch, deployer funding, etc.)
    await checkForCriticalWarnings(gemData);

  } catch (error) {
    console.error('Error handling gem discovery:', error.message);
  }
}

/**
 * Check for critical warnings and send alerts
 * @param {Object} gemData - Gem data
 */
async function checkForCriticalWarnings(gemData) {
  const warnings = [];

  // Check volume authenticity
  if (gemData.filters.volumeAuthenticity && !gemData.filters.volumeAuthenticity.isAuthentic) {
    warnings.push(`Wash trading detected: ${gemData.filters.volumeAuthenticity.reason}`);
  }

  // Check wallet clustering
  if (gemData.filters.walletClustering && gemData.filters.walletClustering.isSuspicious) {
    warnings.push(`Suspicious wallet clustering: ${(gemData.filters.walletClustering.clusteringScore * 100).toFixed(1)}%`);
  }

  // Check top holder concentration
  if (gemData.basicData.top_holder_percent > 40) {
    warnings.push(`High holder concentration: Top holder owns ${gemData.basicData.top_holder_percent.toFixed(1)}%`);
  }

  // Check liquidity
  if (gemData.basicData.liquidity_usd < 20000) {
    warnings.push(`Low liquidity: Only $${gemData.basicData.liquidity_usd.toFixed(0)}`);
  }

  // If we have critical warnings, send alert
  if (warnings.length >= 2) {
    const warningData = {
      tokenAddress: gemData.tokenAddress,
      tokenName: gemData.basicData.name,
      tokenSymbol: gemData.basicData.symbol,
      warningType: 'Multiple Risk Factors Detected',
      details: warnings
    };

    const result = await sendCriticalWarning(warningData);
    
    if (result.success) {
      stats.criticalWarnings++;
      console.log(`🚨 Critical warning sent: ${gemData.basicData.name}`);
    }
  }
}

/**
 * Send daily summary report
 */
async function sendDailySummaryReport() {
  try {
    const summaryData = {
      gemsDiscovered: stats.gemsDiscovered,
      alertsSent: stats.alertsSent,
      topGems: stats.topGems.slice(0, 5),
      performance: {
        avgScore: stats.topGems.length > 0
          ? stats.topGems.reduce((sum, gem) => sum + gem.score, 0) / stats.topGems.length
          : 0,
        accuracy: 0, // Would calculate from historical data
        bestPerformer: stats.topGems[0]?.name || 'N/A'
      }
    };

    await sendDailySummary(summaryData);
    console.log('📊 Daily summary sent');

    // Reset daily stats
    stats.gemsDiscovered = 0;
    stats.alertsSent = 0;
    stats.criticalWarnings = 0;
  } catch (error) {
    console.error('Error sending daily summary:', error.message);
  }
}

/**
 * Get service statistics
 */
export function getServiceStats() {
  return {
    isRunning,
    uptime: stats.startTime ? Date.now() - stats.startTime.getTime() : 0,
    gemsDiscovered: stats.gemsDiscovered,
    alertsSent: stats.alertsSent,
    criticalWarnings: stats.criticalWarnings,
    topGems: stats.topGems.slice(0, 5),
    discoveryStats: getDiscoveryStats()
  };
}

/**
 * Get service status
 */
export function getServiceStatus() {
  return {
    running: isRunning,
    startTime: stats.startTime,
    stats: getServiceStats()
  };
}
startGemHunter();
process.stdin.resume();

