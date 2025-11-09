/**
 * AI Gem Hunter Service with Token Scoring Engine
 * Integrates real-time discovery with AI scoring and Telegram notifications
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
import { shouldAlert } from '../lib/token-scorer.mjs';

/**
 * Service state
 */
let isRunning = false;
let serviceStats = {
  gemsDiscovered: 0,
  alertsSent: 0,
  tokensFiltered: 0,
  liquidityCheckErrors: 0,
  startTime: null,
  topGems: []
};

/**
 * Start the Gem Hunter service
 */
export async function startGemHunterService() {
  if (isRunning) {
    console.log('[GEM-HUNTER] Service already running');
    return;
  }
  
  console.log('[GEM-HUNTER] 🚀 Starting AI Gem Hunter Service with Scoring Engine...');
  serviceStats.startTime = new Date();
  isRunning = true;
  
  // Start token discovery with scoring
  await startTokenDiscovery(handleGemDiscovered);
  
  // Schedule daily summary
  scheduleDailySummary();
  
  console.log('[GEM-HUNTER] ✅ Gem Hunter service started');
}

/**
 * Handle newly discovered and scored gem
 */
async function handleGemDiscovered(gemData) {
  try {
    console.log(`[GEM-HUNTER] Processing gem: ${gemData.tokenAddress}`);
    console.log(`[GEM-HUNTER] Score: ${gemData.gemScore}/100 - ${gemData.interpretation}`);
    
    // Step 1: Liquidity filter (already have liquidity from scoring data)
    const liquidityUSD = gemData.metrics.liquidity || 0;
    
    if (liquidityUSD < 150) {
      console.log(`[GEM-HUNTER] ❌ Token filtered: Liquidity too low ($${liquidityUSD.toFixed(2)})`);
      serviceStats.tokensFiltered++;
      return;
    }
    
    console.log(`[GEM-HUNTER] ✅ Liquidity check passed: $${liquidityUSD.toFixed(2)}`);
    
    // Step 2: Check if score is high enough for alert
    if (!shouldAlert(gemData.gemScore)) {
      console.log(`[GEM-HUNTER] ⚠️ Score too low for alert (${gemData.gemScore}/100)`);
      serviceStats.tokensFiltered++;
      return;
    }
    
    // Step 3: This is a high-quality gem! Record it
    serviceStats.gemsDiscovered++;
    
    // Add to top gems list
    serviceStats.topGems.push({
      address: gemData.tokenAddress,
      score: gemData.gemScore,
      name: gemData.basicData.name,
      symbol: gemData.basicData.symbol,
      liquidity: liquidityUSD,
      discoveredAt: gemData.discoveredAt
    });
    
    // Keep only top 10 gems
    serviceStats.topGems.sort((a, b) => b.score - a.score);
    if (serviceStats.topGems.length > 10) {
      serviceStats.topGems = serviceStats.topGems.slice(0, 10);
    }
    
    // Step 4: Send Telegram alert
    await sendGemAlertWithScore(gemData);
    serviceStats.alertsSent++;
    
    console.log(`[GEM-HUNTER] 🎉 High-quality gem alert sent for ${gemData.tokenAddress}`);
    
  } catch (error) {
    console.error('[GEM-HUNTER] Error handling gem discovery:', error);
  }
}

/**
 * Send Telegram alert with scoring information
 */
async function sendGemAlertWithScore(gemData) {
  const message = `
🔥 *HIGH-QUALITY GEM DETECTED* 🔥

*Score:* ${gemData.gemScore}/100
${gemData.interpretation}

*Token Info:*
• Name: ${gemData.basicData.name}
• Symbol: ${gemData.basicData.symbol}
• Address: \`${gemData.tokenAddress}\`
• Source: ${gemData.source.toUpperCase()}

*Score Breakdown:*
• Liquidity: ${gemData.scoreBreakdown.liquidity}/100
• Volume: ${gemData.scoreBreakdown.volume}/100
• Holders: ${gemData.scoreBreakdown.holders}/100
• Social: ${gemData.scoreBreakdown.social}/100
• Safety: ${gemData.scoreBreakdown.safety}/100

*Metrics:*
• Liquidity: $${gemData.metrics.liquidity.toLocaleString()}
• 24h Volume: $${gemData.metrics.volume24h.toLocaleString()}
• Holders: ${gemData.metrics.holders}
• Market Cap: $${gemData.metrics.marketCap.toLocaleString()}
• 24h Change: ${gemData.metrics.priceChange24h.toFixed(2)}%

*Social Links:*
${gemData.social.website ? `• Website: ${gemData.social.website}` : ''}
${gemData.social.twitter ? `• Twitter: ${gemData.social.twitter}` : ''}
${gemData.social.telegram ? `• Telegram: ${gemData.social.telegram}` : ''}

*View on:*
• [Birdeye](https://birdeye.so/token/${gemData.tokenAddress})
• [DexScreener](https://dexscreener.com/solana/${gemData.tokenAddress})

⚠️ *DYOR - Not Financial Advice*
`.trim();

  try {
    await sendGemAlert(message);
  } catch (error) {
    console.error('[GEM-HUNTER] Error sending Telegram alert:', error);
  }
}

/**
 * Schedule daily summary report
 */
function scheduleDailySummary() {
  // Send summary every 24 hours
  setInterval(async () => {
    const stats = getServiceStats();
    const message = `
📊 *Daily Gem Hunter Summary*

*Discovered:* ${stats.gemsDiscovered} high-quality gems
*Alerts Sent:* ${stats.alertsSent}
*Tokens Filtered:* ${stats.tokensFiltered}
*Filter Efficiency:* ${stats.filterEfficiency}

*Discovery Stats:*
• Tokens Discovered: ${stats.discoveryStats.tokensDiscovered}
• Tokens Scored: ${stats.discoveryStats.tokensScored}
• Average Score: ${stats.discoveryStats.averageScore}/100
• High Score Rate: ${stats.discoveryStats.highScoreRate}

*Top 5 Gems Today:*
${stats.topGems.slice(0, 5).map((gem, i) => 
  `${i + 1}. ${gem.name} (${gem.symbol}) - Score: ${gem.score}/100`
).join('\n')}

*Uptime:* ${stats.uptime}
`.trim();

    await sendDailySummary(message);
  }, 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Get service statistics
 */
export function getServiceStats() {
  const discoveryStats = getDiscoveryStats();
  const uptime = serviceStats.startTime 
    ? Math.floor((Date.now() - serviceStats.startTime) / 1000 / 60) + ' minutes'
    : 'N/A';
  
  const totalProcessed = serviceStats.gemsDiscovered + serviceStats.tokensFiltered;
  const filterEfficiency = totalProcessed > 0
    ? ((serviceStats.tokensFiltered / totalProcessed) * 100).toFixed(1) + '%'
    : '0%';
  
  return {
    ...serviceStats,
    discoveryStats,
    uptime,
    filterEfficiency,
    isRunning
  };
}

/**
 * Stop the service
 */
export function stopGemHunterService() {
  console.log('[GEM-HUNTER] Stopping service...');
  isRunning = false;
  console.log('[GEM-HUNTER] ✅ Service stopped');
}
