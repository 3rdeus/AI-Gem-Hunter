/**
 * Two-Tier Gem Hunter Service
 * Unified system combining Tier 1 (ultra-fast) and Tier 2 (quality)
 */

import { startPumpFunMonitoring, stopPumpFunMonitoring, getPumpFunStats } from '../lib/pumpfun-monitor.js';
import { buyViaBonkBot, getAllPositions, getBonkBotStats } from '../lib/bonk-bot.js';
import { startPositionMonitoring, stopPositionMonitoring, getMonitoringStats } from '../lib/position-monitor.js';
import { executeAutoExit } from '../lib/auto-exit.js';
import { sendGemAlert, sendEntrySignal, sendTelegramMessage } from '../lib/telegram-bot.js';

/**
 * Service state
 */
let isRunning = false;
let tier1Enabled = true;
let tier2Enabled = true;
let stats = {
  tier1: {
    discovered: 0,
    traded: 0,
    winners: 0,
    losers: 0,
    totalPnL: 0
  },
  tier2: {
    discovered: 0,
    traded: 0,
    winners: 0,
    losers: 0,
    totalPnL: 0
  },
  startTime: null
};

/**
 * Start the two-tier gem hunter
 */
export async function startTwoTierGemHunter() {
  if (isRunning) {
    return { success: false, message: 'Already running' };
  }

  console.log('🚀 Starting Two-Tier Gem Hunter...');
  console.log(`📊 Tier 1: ${tier1Enabled ? 'ENABLED' : 'DISABLED'} (Ultra-fast pump.fun)`);
  console.log(`📊 Tier 2: ${tier2Enabled ? 'ENABLED' : 'DISABLED'} (Quality gems)`);

  // Start Tier 1: Ultra-fast pump.fun monitoring
  if (tier1Enabled) {
    startPumpFunMonitoring(handleTier1Opportunity);
  }

  // Start Tier 2: Quality gem monitoring (existing system)
  if (tier2Enabled) {
    // Tier 2 uses existing gem-hunter-service.js
    // Just ensure it's running
  }

  // Start position monitoring for both tiers
  startPositionMonitoring();

  isRunning = true;
  stats.startTime = new Date();

  // Send startup notification
  await sendTelegramMessage({
    chatId: process.env.TELEGRAM_CHAT_ID,
    text: `🚀 *Two-Tier Gem Hunter Started*\n\n` +
          `✅ Tier 1: Ultra-fast ($2K-$10K mcap)\n` +
          `✅ Tier 2: Quality (score ≥ 80)\n` +
          `✅ Position monitoring active\n` +
          `✅ Auto-exit enabled\n\n` +
          `Ready to hunt gems! 💎`,
    parseMode: 'Markdown'
  });

  console.log('✅ Two-Tier Gem Hunter started successfully');

  return { success: true, message: 'Started successfully' };
}

/**
 * Stop the two-tier gem hunter
 */
export async function stopTwoTierGemHunter() {
  if (!isRunning) {
    return { success: false, message: 'Not running' };
  }

  console.log('⏸️ Stopping Two-Tier Gem Hunter...');

  // Stop Tier 1 monitoring
  stopPumpFunMonitoring();

  // Stop position monitoring
  stopPositionMonitoring();

  isRunning = false;

  // Send shutdown notification
  await sendTelegramMessage({
    chatId: process.env.TELEGRAM_CHAT_ID,
    text: `⏸️ *Two-Tier Gem Hunter Stopped*\n\n` +
          `📊 Session stats:\n` +
          `Tier 1: ${stats.tier1.discovered} discovered, ${stats.tier1.traded} traded\n` +
          `Tier 2: ${stats.tier2.discovered} discovered, ${stats.tier2.traded} traded\n\n` +
          `Service stopped.`,
    parseMode: 'Markdown'
  });

  console.log('✅ Two-Tier Gem Hunter stopped');

  return { success: true, message: 'Stopped successfully' };
}

/**
 * Handle Tier 1 opportunity (ultra-fast snipe)
 */
async function handleTier1Opportunity(opportunity) {
  try {
    stats.tier1.discovered++;

    const {
      tokenAddress,
      name,
      symbol,
      marketCap,
      liquidity,
      price,
      positionSize,
      slippage,
      profitTargets,
      stopLoss,
      autoTrade
    } = opportunity;

    console.log(`💎 Tier 1 Opportunity: ${symbol} at $${marketCap.toFixed(0)} mcap`);

    // Send Tier 1 alert to Telegram
    await sendTier1Alert(opportunity);

    // Auto-trade if enabled
    if (autoTrade) {
      console.log(`🤖 Auto-trading enabled - buying ${positionSize} SOL...`);

      const buyResult = await buyViaBonkBot({
        tokenAddress,
        amountSOL: positionSize,
        slippage,
        profitTargets,
        stopLoss
      });

      if (buyResult.success) {
        stats.tier1.traded++;
        console.log(`✅ Tier 1 trade executed: ${symbol}`);

        // Send entry confirmation
        await sendEntrySignal({
          tokenAddress,
          tokenName: name,
          tokenSymbol: symbol,
          entryPrice: price,
          marketCap,
          liquidity,
          positionSize: `${positionSize} SOL`,
          tier: 1
        });
      } else {
        console.error(`❌ Tier 1 trade failed: ${buyResult.error}`);
      }
    }

  } catch (error) {
    console.error('Error handling Tier 1 opportunity:', error.message);
  }
}

/**
 * Handle Tier 2 opportunity (quality gem)
 */
export async function handleTier2Opportunity(opportunity) {
  try {
    stats.tier2.discovered++;

    const {
      tokenAddress,
      name,
      symbol,
      gemScore,
      marketCap,
      liquidity,
      price
    } = opportunity;

    console.log(`💎 Tier 2 Opportunity: ${symbol} (score: ${gemScore}/100) at $${marketCap.toFixed(0)} mcap`);

    // Send Tier 2 alert to Telegram (existing gem alert)
    await sendGemAlert(opportunity);

    // Tier 2 is semi-automated - user decides whether to trade
    // Could add auto-trade for very high scores (≥ 90)
    if (gemScore >= 90) {
      console.log(`🌟 Exceptional gem (score ${gemScore}) - consider auto-trading`);
      // Could implement auto-buy here
    }

  } catch (error) {
    console.error('Error handling Tier 2 opportunity:', error.message);
  }
}

/**
 * Send Tier 1 alert
 */
async function sendTier1Alert(opportunity) {
  const {
    tokenAddress,
    name,
    symbol,
    marketCap,
    liquidity,
    holders,
    price,
    contractAge,
    discoveryLatency,
    positionSize,
    profitTargets,
    stopLoss
  } = opportunity;

  const message = `🚀 *TIER 1: ULTRA-FAST SNIPE*\n\n` +
    `💎 *${name}* (${symbol})\n` +
    `📍 CA: \`${tokenAddress}\`\n\n` +
    `📊 *Metrics:*\n` +
    `• Market Cap: $${marketCap.toLocaleString()}\n` +
    `• Liquidity: $${liquidity.toLocaleString()}\n` +
    `• Holders: ${holders}\n` +
    `• Price: $${price.toFixed(10)}\n` +
    `• Age: ${contractAge.toFixed(0)}s\n\n` +
    `⚡ *Discovery: ${discoveryLatency}ms*\n\n` +
    `🤖 *Auto-Trading:*\n` +
    `• Position: ${positionSize} SOL\n` +
    `• Targets: ${profitTargets.join('x, ')}x\n` +
    `• Stop Loss: ${stopLoss}%\n\n` +
    `🔗 [Birdeye](https://birdeye.so/token/${tokenAddress}) | ` +
    `[Solscan](https://solscan.io/token/${tokenAddress}) | ` +
    `[DexScreener](https://dexscreener.com/solana/${tokenAddress}) | ` +
    `[Axiom](https://axiom.trade/token/${tokenAddress})\n\n` +
    `⚠️ *EXTREME RISK* - Ultra-early snipe\n` +
    `🎯 Auto-buying via Bonk Bot...`;

  await sendTelegramMessage({
    chatId: process.env.TELEGRAM_CHAT_ID,
    text: message,
    parseMode: 'Markdown'
  });
}

/**
 * Get service status
 */
export function getTwoTierStatus() {
  const tier1Stats = getPumpFunStats();
  const bonkBotStats = getBonkBotStats();
  const monitorStats = getMonitoringStats();
  const positions = getAllPositions();

  return {
    isRunning,
    tier1Enabled,
    tier2Enabled,
    stats,
    tier1Stats,
    bonkBotStats,
    monitorStats,
    positions: {
      total: positions.length,
      active: positions.filter(p => p.status === 'ACTIVE').length,
      pending: positions.filter(p => p.status === 'PENDING').length,
      closed: positions.filter(p => p.status === 'CLOSED').length
    },
    uptime: stats.startTime ? Date.now() - new Date(stats.startTime).getTime() : 0
  };
}

/**
 * Enable/disable tiers
 */
export function configureTiers(config) {
  if (config.tier1 !== undefined) {
    tier1Enabled = config.tier1;
    console.log(`Tier 1: ${tier1Enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  if (config.tier2 !== undefined) {
    tier2Enabled = config.tier2;
    console.log(`Tier 2: ${tier2Enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  return { success: true, tier1Enabled, tier2Enabled };
}

/**
 * Update position stats
 */
export function updatePositionStats(tier, result) {
  const tierStats = tier === 1 ? stats.tier1 : stats.tier2;

  if (result.pnlPercent > 0) {
    tierStats.winners++;
  } else {
    tierStats.losers++;
  }

  tierStats.totalPnL += result.pnlPercent || 0;
}

/**
 * Get performance summary
 */
export function getPerformanceSummary() {
  const tier1WinRate = stats.tier1.traded > 0
    ? (stats.tier1.winners / stats.tier1.traded) * 100
    : 0;

  const tier2WinRate = stats.tier2.traded > 0
    ? (stats.tier2.winners / stats.tier2.traded) * 100
    : 0;

  const tier1AvgPnL = stats.tier1.traded > 0
    ? stats.tier1.totalPnL / stats.tier1.traded
    : 0;

  const tier2AvgPnL = stats.tier2.traded > 0
    ? stats.tier2.totalPnL / stats.tier2.traded
    : 0;

  return {
    tier1: {
      discovered: stats.tier1.discovered,
      traded: stats.tier1.traded,
      winners: stats.tier1.winners,
      losers: stats.tier1.losers,
      winRate: tier1WinRate.toFixed(1) + '%',
      avgPnL: tier1AvgPnL.toFixed(1) + '%',
      totalPnL: stats.tier1.totalPnL.toFixed(1) + '%'
    },
    tier2: {
      discovered: stats.tier2.discovered,
      traded: stats.tier2.traded,
      winners: stats.tier2.winners,
      losers: stats.tier2.losers,
      winRate: tier2WinRate.toFixed(1) + '%',
      avgPnL: tier2AvgPnL.toFixed(1) + '%',
      totalPnL: stats.tier2.totalPnL.toFixed(1) + '%'
    },
    combined: {
      discovered: stats.tier1.discovered + stats.tier2.discovered,
      traded: stats.tier1.traded + stats.tier2.traded,
      winners: stats.tier1.winners + stats.tier2.winners,
      losers: stats.tier1.losers + stats.tier2.losers,
      totalPnL: (stats.tier1.totalPnL + stats.tier2.totalPnL).toFixed(1) + '%'
    }
  };
}
