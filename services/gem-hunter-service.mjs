/**
 * AI Gem Hunter Service with Token Scoring Engine and BoNK Bot Integration
 * Integrates real-time discovery with AI scoring, Telegram notifications, and automatic trading
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
import { buyViaBonkBot } from '../lib/bonk-bot.js';

/**
 * Trading configuration
 */
const TRADING_CONFIG = {
  enabled: process.env.AUTO_TRADE_ENABLED === 'true' || false,
  amountSOL: parseFloat(process.env.TRADE_AMOUNT_SOL) || 0.1,
  slippage: parseFloat(process.env.TRADE_SLIPPAGE) || 25,
  profitTargets: [2, 5, 10, 20], // 2x, 5x, 10x, 20x multipliers
  stopLoss: -50 // -50% stop loss
};

/**
 * Service state
 */
let isRunning = false;
let serviceStats = {
  gemsDiscovered: 0,
  alertsSent: 0,
  tokensFiltered: 0,
  tradesExecuted: 0,
  tradesFailed: 0,
  liquidityCheckErrors: 0,
  startTime: null,
  topGems: []
};

/**
 * Start the Gem Hunter service
 */
export async function startGemHunter() {
  return startGemHunterService();
}

export async function startGemHunterService() {
  if (isRunning) {
    console.log('[GEM-HUNTER] Service already running');
    return { success: true, message: 'Service already running' };
  }
  
  console.log('[GEM-HUNTER] 🚀 Starting AI Gem Hunter Service with Scoring Engine and BoNK Bot...');
  console.log(`[GEM-HUNTER] Auto-trading: ${TRADING_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
  
  if (TRADING_CONFIG.enabled) {
    console.log(`[GEM-HUNTER] Trade amount: ${TRADING_CONFIG.amountSOL} SOL`);
    console.log(`[GEM-HUNTER] Slippage: ${TRADING_CONFIG.slippage}%`);
    console.log(`[GEM-HUNTER] Profit targets: ${TRADING_CONFIG.profitTargets.join('x, ')}x`);
    console.log(`[GEM-HUNTER] Stop loss: ${TRADING_CONFIG.stopLoss}%`);
  }
  
  serviceStats.startTime = new Date();
  isRunning = true;
  
  // Start token discovery with scoring
  await startTokenDiscovery(handleGemDiscovered);
  
  // Schedule daily summary
  scheduleDailySummary();
  
  console.log('[GEM-HUNTER] ✅ Gem Hunter service started');
  console.log('[GEM-HUNTER] 🔍 WebSocket connections will keep the process alive');
  
  // Return success immediately - the WebSocket connections will keep the event loop active
  return { success: true, message: 'AI Gem Hunter Service started successfully' };
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
    
    // Step 5: Execute automatic trade via BoNK Bot (if enabled)
    if (TRADING_CONFIG.enabled) {
      await executeAutomaticTrade(gemData);
    } else {
      console.log(`[GEM-HUNTER] ⚠️ Auto-trading disabled - skipping trade execution`);
    }
    
  } catch (error) {
    console.error('[GEM-HUNTER] Error handling gem discovery:', error);
  }
}

/**
 * Execute automatic trade via BoNK Bot
 */
async function executeAutomaticTrade(gemData) {
  try {
    console.log(`[GEM-HUNTER] 🤖 Executing automatic trade for ${gemData.tokenAddress}`);
    
    const tradeParams = {
      tokenAddress: gemData.tokenAddress,
      amountSOL: TRADING_CONFIG.amountSOL,
      slippage: TRADING_CONFIG.slippage,
      profitTargets: TRADING_CONFIG.profitTargets,
      stopLoss: TRADING_CONFIG.stopLoss
    };
    
    const result = await buyViaBonkBot(tradeParams);
    
    if (result.success) {
      serviceStats.tradesExecuted++;
      console.log(`[GEM-HUNTER] ✅ Trade executed successfully: ${result.messageId}`);
      
      // Send trade confirmation to Telegram
      await sendTradeConfirmation(gemData, tradeParams, result);
    } else {
      serviceStats.tradesFailed++;
      console.error(`[GEM-HUNTER] ❌ Trade execution failed: ${result.error}`);
      
      // Send trade failure alert to Telegram
      await sendTradeFailureAlert(gemData, result.error);
    }
    
  } catch (error) {
    serviceStats.tradesFailed++;
    console.error('[GEM-HUNTER] Error executing automatic trade:', error);
    await sendTradeFailureAlert(gemData, error.message);
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

${TRADING_CONFIG.enabled ? '🤖 *Auto-trade executing...*' : '⚠️ *Auto-trade disabled - manual action required*'}

⚠️ *DYOR - Not Financial Advice*
`.trim();

  try {
    await sendGemAlert(message);
  } catch (error) {
    console.error('[GEM-HUNTER] Error sending Telegram alert:', error);
  }
}

/**
 * Send trade confirmation to Telegram
 */
async function sendTradeConfirmation(gemData, tradeParams, result) {
  const message = `
✅ *TRADE EXECUTED*

*Token:* ${gemData.basicData.name} (${gemData.basicData.symbol})
*Address:* \`${gemData.tokenAddress}\`

*Trade Details:*
• Amount: ${tradeParams.amountSOL} SOL
• Slippage: ${tradeParams.slippage}%
• Entry Score: ${gemData.gemScore}/100

*Profit Targets:*
${tradeParams.profitTargets.map(target => `• ${target}x`).join('\n')}

*Stop Loss:* ${tradeParams.stopLoss}%

*Position ID:* ${result.position?.tokenAddress || 'N/A'}

🤖 BoNK Bot is now monitoring this position
`.trim();

  try {
    await sendGemAlert(message);
  } catch (error) {
    console.error('[GEM-HUNTER] Error sending trade confirmation:', error);
  }
}

/**
 * Send trade failure alert to Telegram
 */
async function sendTradeFailureAlert(gemData, errorMessage) {
  const message = `
❌ *TRADE EXECUTION FAILED*

*Token:* ${gemData.basicData.name} (${gemData.basicData.symbol})
*Address:* \`${gemData.tokenAddress}\`
*Score:* ${gemData.gemScore}/100

*Error:* ${errorMessage}

⚠️ Manual intervention required
`.trim();

  try {
    await sendCriticalWarning(message);
  } catch (error) {
    console.error('[GEM-HUNTER] Error sending trade failure alert:', error);
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

${TRADING_CONFIG.enabled ? `
*Trading Stats:*
• Trades Executed: ${stats.tradesExecuted}
• Trades Failed: ${stats.tradesFailed}
• Success Rate: ${stats.tradeSuccessRate}
` : ''}

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
  
  const totalTrades = serviceStats.tradesExecuted + serviceStats.tradesFailed;
  const tradeSuccessRate = totalTrades > 0
    ? ((serviceStats.tradesExecuted / totalTrades) * 100).toFixed(1) + '%'
    : 'N/A';
  
  return {
    ...serviceStats,
    discoveryStats,
    uptime,
    filterEfficiency,
    tradeSuccessRate,
    tradingEnabled: TRADING_CONFIG.enabled,
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
