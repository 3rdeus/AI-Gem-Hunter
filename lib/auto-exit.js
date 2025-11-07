/**
 * Auto-Exit System
 * Smart profit-taking and stop-loss execution
 */

import { sellViaBonkBot, getPosition } from './bonk-bot.js';
import { sendProfitTargetAlert, sendExitSignal } from './telegram-bot.js';

/**
 * Exit strategies
 */
const EXIT_STRATEGIES = {
  // Tier 1: Ultra-early snipes (high risk, aggressive exits)
  TIER1: {
    profitTargets: [
      { multiplier: 2, percentage: 25, description: '2x - Take initial' },
      { multiplier: 5, percentage: 25, description: '5x - Secure profits' },
      { multiplier: 10, percentage: 25, description: '10x - Major win' },
      { multiplier: 20, percentage: 15, description: '20x - Exceptional' },
      { multiplier: 50, percentage: 10, description: '50x - Moon' }
    ],
    stopLoss: -50,           // -50% stop loss
    trailingStop: {
      enabled: true,
      activation: 3,         // Activate at 3x
      distance: 30           // Trail 30% below peak
    },
    timeBasedExit: {
      enabled: true,
      maxHoldTime: 86400000, // 24 hours max
      partialExitTime: 43200000 // 12 hours = sell 50%
    }
  },

  // Tier 2: Quality gems (medium risk, patient exits)
  TIER2: {
    profitTargets: [
      { multiplier: 2, percentage: 33, description: '2x - Take profits' },
      { multiplier: 5, percentage: 33, description: '5x - Secure gains' },
      { multiplier: 10, percentage: 34, description: '10x - Exit remaining' }
    ],
    stopLoss: -30,           // -30% stop loss
    trailingStop: {
      enabled: true,
      activation: 2,         // Activate at 2x
      distance: 20           // Trail 20% below peak
    },
    timeBasedExit: {
      enabled: false         // No time-based exit for quality gems
    }
  }
};

/**
 * Trailing stop state
 */
const trailingStops = new Map();

/**
 * Execute auto-exit for a position
 * @param {Object} position - Position data
 * @param {string} tier - 'TIER1' or 'TIER2'
 */
export async function executeAutoExit(position, tier = 'TIER1') {
  try {
    const strategy = EXIT_STRATEGIES[tier];
    if (!strategy) {
      console.error(`Invalid tier: ${tier}`);
      return { success: false, error: 'Invalid tier' };
    }

    const { tokenAddress, multiplier, pnlPercent, entryPrice, currentPrice } = position;

    // Check stop loss
    const stopLossResult = await checkStopLoss(position, strategy);
    if (stopLossResult.triggered) {
      return stopLossResult;
    }

    // Check trailing stop
    const trailingStopResult = await checkTrailingStop(position, strategy);
    if (trailingStopResult.triggered) {
      return trailingStopResult;
    }

    // Check profit targets
    const profitTargetResult = await checkProfitTargets(position, strategy);
    if (profitTargetResult.triggered) {
      return profitTargetResult;
    }

    // Check time-based exit
    const timeBasedResult = await checkTimeBasedExit(position, strategy);
    if (timeBasedResult.triggered) {
      return timeBasedResult;
    }

    return { success: true, triggered: false };

  } catch (error) {
    console.error('Error executing auto-exit:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check stop loss
 */
async function checkStopLoss(position, strategy) {
  const { tokenAddress, pnlPercent, entryPrice, currentPrice } = position;
  const { stopLoss } = strategy;

  if (pnlPercent <= stopLoss) {
    console.log(`🛑 Stop loss triggered: ${pnlPercent.toFixed(1)}% (target: ${stopLoss}%)`);

    // Send exit alert
    await sendExitSignal({
      tokenAddress,
      tokenName: position.tokenName || 'Unknown',
      tokenSymbol: position.tokenSymbol || 'UNKNOWN',
      signalType: 'Stop Loss Triggered',
      currentPrice,
      entryPrice,
      profitPercent: pnlPercent
    });

    // Execute sell
    const sellResult = await sellViaBonkBot({
      tokenAddress,
      percentage: 100,
      reason: `Stop loss triggered (${pnlPercent.toFixed(1)}%)`
    });

    return {
      triggered: true,
      reason: 'STOP_LOSS',
      percentage: 100,
      sellResult
    };
  }

  return { triggered: false };
}

/**
 * Check trailing stop
 */
async function checkTrailingStop(position, strategy) {
  const { tokenAddress, multiplier, currentPrice, entryPrice } = position;
  const { trailingStop } = strategy;

  if (!trailingStop.enabled) {
    return { triggered: false };
  }

  // Activate trailing stop after reaching activation multiplier
  if (multiplier >= trailingStop.activation) {
    // Get or initialize trailing stop state
    if (!trailingStops.has(tokenAddress)) {
      trailingStops.set(tokenAddress, {
        peakPrice: currentPrice,
        activated: true
      });
      console.log(`📈 Trailing stop activated at ${trailingStop.activation}x`);
    }

    const state = trailingStops.get(tokenAddress);

    // Update peak price
    if (currentPrice > state.peakPrice) {
      state.peakPrice = currentPrice;
      console.log(`📈 New peak: $${currentPrice.toFixed(10)}`);
    }

    // Calculate trailing stop price
    const stopPrice = state.peakPrice * (1 - trailingStop.distance / 100);

    // Check if current price fell below trailing stop
    if (currentPrice <= stopPrice) {
      const dropPercent = ((state.peakPrice - currentPrice) / state.peakPrice) * 100;
      
      console.log(`🛑 Trailing stop triggered: ${dropPercent.toFixed(1)}% from peak`);

      // Send exit alert
      await sendExitSignal({
        tokenAddress,
        tokenName: position.tokenName || 'Unknown',
        tokenSymbol: position.tokenSymbol || 'UNKNOWN',
        signalType: 'Trailing Stop Triggered',
        currentPrice,
        entryPrice,
        profitPercent: position.pnlPercent
      });

      // Execute sell
      const sellResult = await sellViaBonkBot({
        tokenAddress,
        percentage: 100,
        reason: `Trailing stop triggered (${dropPercent.toFixed(1)}% from peak)`
      });

      // Clean up trailing stop state
      trailingStops.delete(tokenAddress);

      return {
        triggered: true,
        reason: 'TRAILING_STOP',
        percentage: 100,
        sellResult
      };
    }
  }

  return { triggered: false };
}

/**
 * Check profit targets
 */
async function checkProfitTargets(position, strategy) {
  const { tokenAddress, multiplier, pnlPercent, entryPrice, currentPrice, profitTargetsHit = [] } = position;
  const { profitTargets } = strategy;

  for (const target of profitTargets) {
    if (multiplier >= target.multiplier && !profitTargetsHit.includes(target.multiplier)) {
      console.log(`🎯 Profit target hit: ${target.multiplier}x - ${target.description}`);

      // Mark target as hit
      profitTargetsHit.push(target.multiplier);
      position.profitTargetsHit = profitTargetsHit;

      // Send profit target alert
      await sendProfitTargetAlert({
        tokenAddress,
        tokenName: position.tokenName || 'Unknown',
        tokenSymbol: position.tokenSymbol || 'UNKNOWN',
        entryPrice,
        currentPrice,
        profitPercent: pnlPercent,
        targetMultiple: target.multiplier,
        totalGainUsd: null
      });

      // Execute sell
      const sellResult = await sellViaBonkBot({
        tokenAddress,
        percentage: target.percentage,
        reason: `Profit target ${target.multiplier}x hit`
      });

      return {
        triggered: true,
        reason: 'PROFIT_TARGET',
        target: target.multiplier,
        percentage: target.percentage,
        sellResult
      };
    }
  }

  return { triggered: false };
}

/**
 * Check time-based exit
 */
async function checkTimeBasedExit(position, strategy) {
  const { tokenAddress, buyTime, pnlPercent } = position;
  const { timeBasedExit } = strategy;

  if (!timeBasedExit.enabled) {
    return { triggered: false };
  }

  const holdTime = Date.now() - new Date(buyTime).getTime();

  // Partial exit after partial exit time
  if (holdTime >= timeBasedExit.partialExitTime && !position.partialTimeExit) {
    console.log(`⏰ Partial time-based exit: ${(holdTime / 3600000).toFixed(1)} hours held`);

    position.partialTimeExit = true;

    // Execute partial sell
    const sellResult = await sellViaBonkBot({
      tokenAddress,
      percentage: 50,
      reason: `Time-based partial exit (${(holdTime / 3600000).toFixed(1)}h held)`
    });

    return {
      triggered: true,
      reason: 'TIME_BASED_PARTIAL',
      percentage: 50,
      sellResult
    };
  }

  // Full exit after max hold time
  if (holdTime >= timeBasedExit.maxHoldTime) {
    console.log(`⏰ Max hold time reached: ${(holdTime / 3600000).toFixed(1)} hours`);

    // Send exit alert
    await sendExitSignal({
      tokenAddress,
      tokenName: position.tokenName || 'Unknown',
      tokenSymbol: position.tokenSymbol || 'UNKNOWN',
      signalType: 'Max Hold Time Reached',
      currentPrice: position.currentPrice,
      entryPrice: position.entryPrice,
      profitPercent: pnlPercent
    });

    // Execute sell
    const sellResult = await sellViaBonkBot({
      tokenAddress,
      percentage: 100,
      reason: `Max hold time reached (${(holdTime / 3600000).toFixed(1)}h)`
    });

    return {
      triggered: true,
      reason: 'TIME_BASED_FULL',
      percentage: 100,
      sellResult
    };
  }

  return { triggered: false };
}

/**
 * Get exit strategy for a tier
 */
export function getExitStrategy(tier) {
  return EXIT_STRATEGIES[tier];
}

/**
 * Update exit strategy
 */
export function updateExitStrategy(tier, newStrategy) {
  if (!EXIT_STRATEGIES[tier]) {
    return { success: false, error: 'Invalid tier' };
  }

  Object.assign(EXIT_STRATEGIES[tier], newStrategy);
  console.log(`✅ ${tier} exit strategy updated`);

  return { success: true, strategy: EXIT_STRATEGIES[tier] };
}

/**
 * Get trailing stop state for a position
 */
export function getTrailingStopState(tokenAddress) {
  return trailingStops.get(tokenAddress);
}

/**
 * Clear trailing stop state
 */
export function clearTrailingStop(tokenAddress) {
  trailingStops.delete(tokenAddress);
}

/**
 * Get all exit strategies
 */
export function getAllExitStrategies() {
  return EXIT_STRATEGIES;
}
