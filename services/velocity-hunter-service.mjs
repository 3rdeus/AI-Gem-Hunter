/**
 * Velocity Hunter Service - Munger/Musk Edition
 * 
 * Philosophy: Safety gate → Velocity score → Small bets, fast exits
 * 
 * No more trying to find "good" tokens.
 * Filter rugs, bet on velocity, exit fast.
 */

import 'dotenv/config';

import { startTokenDiscovery, getDiscoveryStats } from '../lib/real-time-discovery.mjs';
import { sendGemAlert, sendTestMessage } from '../lib/telegram-bot.mjs';
import { buyViaBonkBot } from '../lib/bonk-bot.mjs';
import { saveGemDiscovery } from '../lib/gem-tracker.mjs';
import { runSafetyGate, calculateVelocityScore, evaluateToken, POSITION_TIERS } from '../lib/velocity-gate.mjs';

/**
 * Configuration from environment
 */
const CONFIG = {
  // Master switch
  enabled: process.env.AUTO_TRADE_ENABLED === 'true',
  
  // Paper trading mode (log but don't execute)
  paperTradeOnly: process.env.PAPER_TRADE_ONLY === 'true',
  
  // Alert thresholds
  minVelocityForAlert: parseInt(process.env.MIN_VELOCITY_ALERT) || 30,
  minVelocityForTrade: parseInt(process.env.MIN_VELOCITY_TRADE) || 50,
  
  // Position limits
  maxConcurrentPositions: parseInt(process.env.MAX_POSITIONS) || 5,
  maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES) || 20,
};

/**
 * Service state
 */
let isRunning = false;
let stats = {
  tokensScanned: 0,
  safetyPassed: 0,
  safetyFailed: 0,
  alertsSent: 0,
  tradesExecuted: 0,
  paperTrades: 0,
  startTime: null,
  recentTokens: [], // Last 50 tokens with scores
  activePositions: [],
  dailyTradeCount: 0,
  lastDayReset: null,
};

/**
 * Start the velocity hunter
 */
export async function startVelocityHunter() {
  if (isRunning) {
    console.log('[VELOCITY-HUNTER] Already running');
    return { success: true, message: 'Already running' };
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🎯 VELOCITY HUNTER - Munger/Musk Edition 🎯          ║
╠══════════════════════════════════════════════════════════════╣
║  Philosophy: Filter rugs, bet on velocity, exit fast          ║
║                                                              ║
║  Mode: ${CONFIG.enabled ? (CONFIG.paperTradeOnly ? 'PAPER TRADING' : '🔴 LIVE TRADING') : 'ALERTS ONLY'}
║  Min Velocity (Alert): ${CONFIG.minVelocityForAlert}                                    
║  Min Velocity (Trade): ${CONFIG.minVelocityForTrade}                                    
║  Max Positions: ${CONFIG.maxConcurrentPositions}                                         
╚══════════════════════════════════════════════════════════════╝
`);
  
  stats.startTime = new Date();
  stats.lastDayReset = new Date();
  isRunning = true;
  
  // Start token discovery with our handler
  await startTokenDiscovery(handleNewToken);
  
  // Start health check endpoint
  startHealthServer();
  
  // Send startup notification
  await sendTestMessage(`🎯 Velocity Hunter started!\n\nMode: ${CONFIG.enabled ? (CONFIG.paperTradeOnly ? 'Paper' : 'LIVE') : 'Alerts'}\nMin Velocity: ${CONFIG.minVelocityForAlert}`);
  
  console.log('[VELOCITY-HUNTER] 🚀 Service started, listening for new tokens...');
  
  return { success: true, message: 'Velocity Hunter started' };
}

/**
 * Handle new token discovered from DEX monitors
 */
async function handleNewToken(tokenData) {
  const tokenAddress = tokenData.tokenAddress || tokenData.address;
  const poolCreationTime = tokenData.createdAt || tokenData.timestamp || Date.now();
  
  stats.tokensScanned++;
  
  console.log(`\n[VELOCITY-HUNTER] 🔍 New token: ${tokenAddress.slice(0, 8)}...`);
  
  try {
    // Reset daily counter if new day
    const now = new Date();
    if (now.getDate() !== stats.lastDayReset?.getDate()) {
      stats.dailyTradeCount = 0;
      stats.lastDayReset = now;
      console.log('[VELOCITY-HUNTER] 📅 New day - reset trade counter');
    }
    
    // STEP 1: Run safety gate (binary pass/fail)
    // Use liquidity from discovery data (Helius) if available
    const prefetchedLiquidity = tokenData.metrics?.liquidity || tokenData.liquidity || null;
    const safety = await runSafetyGate(tokenAddress, prefetchedLiquidity);
    
    if (!safety.passed) {
      stats.safetyFailed++;
      console.log(`[VELOCITY-HUNTER] ❌ Safety gate failed: ${safety.reason}`);
      return;
    }
    
    stats.safetyPassed++;
    console.log(`[VELOCITY-HUNTER] ✅ Safety gate passed`);
    
    // STEP 2: Calculate velocity score
    const velocity = await calculateVelocityScore(tokenAddress, poolCreationTime, tokenData);
    
    // Save to recent tokens
    stats.recentTokens.unshift({
      address: tokenAddress,
      velocity: velocity.score,
      tier: velocity.tier.name,
      timestamp: new Date().toISOString(),
      safety: safety.checks,
    });
    if (stats.recentTokens.length > 50) stats.recentTokens.pop();
    
    // STEP 3: Decide action based on velocity
    if (velocity.score < CONFIG.minVelocityForAlert) {
      console.log(`[VELOCITY-HUNTER] ⏭️ Velocity too low (${velocity.score}) - skipping`);
      return;
    }
    
    // Save discovery to Supabase
    await saveGemDiscovery({
      tokenAddress,
      gemScore: velocity.score,
      interpretation: `Velocity ${velocity.tier.name}`,
      scoreBreakdown: velocity.breakdown,
      basicData: tokenData.basicData || {},
      metrics: tokenData.metrics || {},
      discoveredAt: new Date().toISOString(),
    });
    
    // STEP 4: Send alert
    const alertMessage = formatVelocityAlert(tokenAddress, tokenData, velocity, safety);
    await sendGemAlert(alertMessage);
    stats.alertsSent++;
    console.log(`[VELOCITY-HUNTER] 📢 Alert sent (velocity: ${velocity.score})`);
    
    // STEP 5: Execute trade if conditions met
    if (CONFIG.enabled && velocity.score >= CONFIG.minVelocityForTrade) {
      await executeTrade(tokenAddress, velocity, tokenData);
    }
    
  } catch (error) {
    console.error(`[VELOCITY-HUNTER] Error processing token:`, error.message);
  }
}

/**
 * Format alert message for Telegram
 */
function formatVelocityAlert(tokenAddress, tokenData, velocity, safety) {
  const tier = velocity.tier;
  const name = tokenData.basicData?.name || 'Unknown';
  const symbol = tokenData.basicData?.symbol || '???';
  
  return `
${tier.emoji} *VELOCITY ALERT: ${tier.name}* ${tier.emoji}

*Token:* ${name} (${symbol})
*Address:* \`${tokenAddress}\`

📊 *Velocity Score:* ${velocity.score}/100
${Object.entries(velocity.breakdown).map(([k, v]) => `• ${k}: ${v}/100`).join('\n')}

${tier.size > 0 ? `
💰 *Suggested Trade:*
• Size: ${tier.size} SOL
• Take Profit: ${tier.takeProfit.map(x => x + 'x').join(', ')}
• Stop Loss: ${tier.stopLoss}%
• Max Hold: ${tier.maxHoldMins} mins
` : '👀 *Watch only - no trade suggested*'}

🔗 *Links:*
• [Birdeye](https://birdeye.so/token/${tokenAddress})
• [DexScreener](https://dexscreener.com/solana/${tokenAddress})
• [RugCheck](https://rugcheck.xyz/tokens/${tokenAddress})
`.trim();
}

/**
 * Execute trade via BonkBot
 */
async function executeTrade(tokenAddress, velocity, tokenData) {
  const tier = velocity.tier;
  
  // Check limits
  if (stats.activePositions.length >= CONFIG.maxConcurrentPositions) {
    console.log(`[VELOCITY-HUNTER] ⚠️ Max positions reached (${CONFIG.maxConcurrentPositions})`);
    return;
  }
  
  if (stats.dailyTradeCount >= CONFIG.maxDailyTrades) {
    console.log(`[VELOCITY-HUNTER] ⚠️ Daily trade limit reached (${CONFIG.maxDailyTrades})`);
    return;
  }
  
  if (tier.size === 0) {
    console.log(`[VELOCITY-HUNTER] 👀 Watch tier - no trade`);
    return;
  }
  
  // Paper trade mode
  if (CONFIG.paperTradeOnly) {
    console.log(`[VELOCITY-HUNTER] 📝 PAPER TRADE: Would buy ${tier.size} SOL of ${tokenAddress.slice(0,8)}`);
    stats.paperTrades++;
    
    // Track paper position
    stats.activePositions.push({
      tokenAddress,
      size: tier.size,
      entryTime: new Date().toISOString(),
      tier: tier.name,
      paperTrade: true,
    });
    
    await sendGemAlert(`📝 *PAPER TRADE EXECUTED*\n\nToken: \`${tokenAddress}\`\nSize: ${tier.size} SOL\nTier: ${tier.name}`);
    return;
  }
  
  // Real trade
  console.log(`[VELOCITY-HUNTER] 🎯 Executing ${tier.name} trade: ${tier.size} SOL`);
  
  try {
    const result = await buyViaBonkBot({
      tokenAddress,
      amountSOL: tier.size,
      slippage: 25,
      profitTargets: tier.takeProfit,
      stopLoss: tier.stopLoss,
    });
    
    if (result.success) {
      stats.tradesExecuted++;
      stats.dailyTradeCount++;
      
      stats.activePositions.push({
        tokenAddress,
        size: tier.size,
        entryTime: new Date().toISOString(),
        tier: tier.name,
        messageId: result.messageId,
        paperTrade: false,
      });
      
      console.log(`[VELOCITY-HUNTER] ✅ Trade executed!`);
      
      await sendGemAlert(`🎯 *TRADE EXECUTED*\n\nToken: \`${tokenAddress}\`\nSize: ${tier.size} SOL\nTier: ${tier.name}\nTP: ${tier.takeProfit.map(x => x + 'x').join(', ')}\nSL: ${tier.stopLoss}%`);
    } else {
      console.log(`[VELOCITY-HUNTER] ❌ Trade failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`[VELOCITY-HUNTER] Trade error:`, error.message);
  }
}

/**
 * Health check HTTP server
 */
async function startHealthServer() {
  const http = await import('http');
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'Velocity Hunter',
        uptime: Math.round((Date.now() - stats.startTime) / 1000),
        stats: {
          tokensScanned: stats.tokensScanned,
          safetyPassed: stats.safetyPassed,
          safetyFailed: stats.safetyFailed,
          alertsSent: stats.alertsSent,
          tradesExecuted: stats.tradesExecuted,
          paperTrades: stats.paperTrades,
          activePositions: stats.activePositions.length,
        },
        timestamp: new Date().toISOString(),
      }));
    } else if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(3000, () => {
    console.log('[VELOCITY-HUNTER] Health server listening on :3000');
  });
}

/**
 * Get service stats
 */
export function getVelocityHunterStats() {
  return {
    ...stats,
    uptimeSeconds: stats.startTime ? Math.round((Date.now() - stats.startTime) / 1000) : 0,
    config: CONFIG,
  };
}

// Auto-start if run directly
if (process.argv[1]?.includes('velocity-hunter')) {
  startVelocityHunter().catch(console.error);
}

export default startVelocityHunter;
