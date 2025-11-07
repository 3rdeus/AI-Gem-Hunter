/**
 * Real-Time Position Monitoring
 * Tracks all active positions and monitors for profit targets / stop losses
 */

import { getAllPositions, updatePosition, checkPositionExit } from './bonk-bot.js';
import { sellViaBonkBot } from './bonk-bot.js';
import { sendProfitTargetAlert, sendVolatilityWarning, sendExitSignal } from './telegram-bot.js';

/**
 * Monitoring configuration
 */
const MONITOR_CONFIG = {
  updateInterval: 5000,      // Update every 5 seconds
  priceCheckInterval: 2000,  // Check prices every 2 seconds
  volatilityThreshold: 50,   // 50% price swing = high volatility
  volatilityWindow: 300000   // 5 minutes
};

/**
 * Monitoring state
 */
let monitoringInterval = null;
let priceHistory = new Map(); // Track price history for volatility

/**
 * Start position monitoring
 */
export function startPositionMonitoring() {
  if (monitoringInterval) {
    console.log('⚠️ Position monitoring already running');
    return;
  }

  console.log('👁️ Starting real-time position monitoring...');
  console.log(`📊 Update interval: ${MONITOR_CONFIG.updateInterval}ms`);

  // Monitor positions at regular intervals
  monitoringInterval = setInterval(async () => {
    await monitorAllPositions();
  }, MONITOR_CONFIG.updateInterval);

  // Also start price checking (more frequent)
  setInterval(async () => {
    await checkPrices();
  }, MONITOR_CONFIG.priceCheckInterval);

  console.log('✅ Position monitoring started');
}

/**
 * Stop position monitoring
 */
export function stopPositionMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('⏸️ Position monitoring stopped');
  }
}

/**
 * Monitor all active positions
 */
async function monitorAllPositions() {
  try {
    const positions = getAllPositions();
    const activePositions = positions.filter(p => p.status === 'ACTIVE');

    if (activePositions.length === 0) {
      return; // No active positions to monitor
    }

    console.log(`👁️ Monitoring ${activePositions.length} active positions...`);

    for (const position of activePositions) {
      await monitorPosition(position);
    }
  } catch (error) {
    console.error('Error monitoring positions:', error.message);
  }
}

/**
 * Monitor a single position
 */
async function monitorPosition(position) {
  try {
    const { tokenAddress, tokenName, tokenSymbol } = position;

    // Fetch current price data
    const priceData = await fetchCurrentPrice(tokenAddress);
    
    if (!priceData) {
      return; // Failed to fetch price
    }

    // Update position with current data
    updatePosition(tokenAddress, priceData);

    // Track price history for volatility detection
    trackPriceHistory(tokenAddress, priceData.currentPrice);

    // Check for volatility spikes
    const volatility = calculateVolatility(tokenAddress);
    if (volatility && volatility.isHigh) {
      await handleHighVolatility(position, volatility);
    }

    // Check if position should exit (profit target or stop loss)
    const exitSignal = checkPositionExit(tokenAddress);
    
    if (exitSignal && exitSignal.shouldExit) {
      await handlePositionExit(position, exitSignal);
    }

  } catch (error) {
    console.error(`Error monitoring position ${position.tokenAddress}:`, error.message);
  }
}

/**
 * Fetch current price for a token
 */
async function fetchCurrentPrice(tokenAddress) {
  try {
    // Try pump.fun API first
    const pumpFunData = await fetchPumpFunPrice(tokenAddress);
    if (pumpFunData) return pumpFunData;

    // Fallback to Birdeye
    const birdeyeData = await fetchBirdeyePrice(tokenAddress);
    if (birdeyeData) return birdeyeData;

    return null;
  } catch (error) {
    console.error('Error fetching current price:', error.message);
    return null;
  }
}

/**
 * Fetch price from pump.fun
 */
async function fetchPumpFunPrice(tokenAddress) {
  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenAddress}`);
    
    if (!response.ok) return null;

    const data = await response.json();

    return {
      currentPrice: data.price_usd || 0,
      marketCap: data.usd_market_cap || 0,
      liquidity: data.virtual_sol_reserves * 150 || 0,
      volume24h: data.volume_24h_usd || 0
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch price from Birdeye
 */
async function fetchBirdeyePrice(tokenAddress) {
  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${tokenAddress}`,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || 'demo'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      currentPrice: data.data?.value || 0,
      marketCap: 0, // Not provided by this endpoint
      liquidity: 0,
      volume24h: 0
    };
  } catch (error) {
    return null;
  }
}

/**
 * Track price history for volatility calculation
 */
function trackPriceHistory(tokenAddress, price) {
  if (!priceHistory.has(tokenAddress)) {
    priceHistory.set(tokenAddress, []);
  }

  const history = priceHistory.get(tokenAddress);
  
  history.push({
    price,
    timestamp: Date.now()
  });

  // Keep only last 5 minutes of data
  const cutoff = Date.now() - MONITOR_CONFIG.volatilityWindow;
  priceHistory.set(
    tokenAddress,
    history.filter(h => h.timestamp > cutoff)
  );
}

/**
 * Calculate volatility for a token
 */
function calculateVolatility(tokenAddress) {
  const history = priceHistory.get(tokenAddress);
  
  if (!history || history.length < 2) {
    return null;
  }

  const prices = history.map(h => h.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const currentPrice = prices[prices.length - 1];

  const priceSwing = ((maxPrice - minPrice) / minPrice) * 100;
  const currentSwing = ((currentPrice - minPrice) / minPrice) * 100;

  const isHigh = priceSwing > MONITOR_CONFIG.volatilityThreshold;

  return {
    isHigh,
    priceSwing,
    currentSwing,
    maxPrice,
    minPrice,
    currentPrice,
    timeframe: `${Math.floor((history[history.length - 1].timestamp - history[0].timestamp) / 60000)} minutes`
  };
}

/**
 * Handle high volatility
 */
async function handleHighVolatility(position, volatility) {
  try {
    const { tokenAddress, tokenName, tokenSymbol, pnlPercent } = position;

    console.log(`⚡ High volatility detected: ${tokenSymbol} - ${volatility.priceSwing.toFixed(1)}%`);

    // Determine recommendation based on P&L and volatility
    let recommendation = 'MONITOR';
    
    if (pnlPercent > 100 && volatility.priceSwing > 80) {
      recommendation = 'EXIT'; // Take profits, volatility too high
    } else if (pnlPercent > 50 && volatility.priceSwing > 60) {
      recommendation = 'REDUCE'; // Take partial profits
    }

    // Send volatility warning alert
    await sendVolatilityWarning({
      tokenAddress,
      tokenName: tokenName || 'Unknown',
      tokenSymbol: tokenSymbol || 'UNKNOWN',
      volatilityPercent: volatility.priceSwing,
      priceSwing: volatility.currentSwing,
      timeframe: volatility.timeframe,
      recommendation
    });

    // Auto-exit if recommendation is EXIT
    if (recommendation === 'EXIT') {
      await sellViaBonkBot({
        tokenAddress,
        percentage: 50, // Sell 50% to reduce risk
        reason: `High volatility (${volatility.priceSwing.toFixed(1)}%)`
      });
    }

  } catch (error) {
    console.error('Error handling high volatility:', error.message);
  }
}

/**
 * Handle position exit (profit target or stop loss)
 */
async function handlePositionExit(position, exitSignal) {
  try {
    const { tokenAddress, tokenName, tokenSymbol, entryPrice, currentPrice, pnlPercent } = position;
    const { reason, target, percentage, message } = exitSignal;

    console.log(`🎯 Exit signal: ${tokenSymbol} - ${message}`);

    if (reason === 'PROFIT_TARGET') {
      // Send profit target alert
      await sendProfitTargetAlert({
        tokenAddress,
        tokenName: tokenName || 'Unknown',
        tokenSymbol: tokenSymbol || 'UNKNOWN',
        entryPrice,
        currentPrice,
        profitPercent: pnlPercent,
        targetMultiple: target,
        totalGainUsd: null // Would calculate from position size
      });

      // Execute sell via Bonk Bot
      await sellViaBonkBot({
        tokenAddress,
        percentage,
        reason: `Profit target ${target}x hit`
      });

    } else if (reason === 'STOP_LOSS') {
      // Send exit signal alert
      await sendExitSignal({
        tokenAddress,
        tokenName: tokenName || 'Unknown',
        tokenSymbol: tokenSymbol || 'UNKNOWN',
        signalType: 'Stop Loss Triggered',
        currentPrice,
        entryPrice,
        profitPercent: pnlPercent
      });

      // Execute sell via Bonk Bot
      await sellViaBonkBot({
        tokenAddress,
        percentage: 100, // Sell all on stop loss
        reason: 'Stop loss triggered'
      });
    }

  } catch (error) {
    console.error('Error handling position exit:', error.message);
  }
}

/**
 * Check prices (more frequent than full monitoring)
 */
async function checkPrices() {
  try {
    const positions = getAllPositions();
    const activePositions = positions.filter(p => p.status === 'ACTIVE');

    for (const position of activePositions) {
      const priceData = await fetchCurrentPrice(position.tokenAddress);
      if (priceData) {
        updatePosition(position.tokenAddress, priceData);
      }
    }
  } catch (error) {
    // Silent error - don't spam logs
  }
}

/**
 * Get monitoring stats
 */
export function getMonitoringStats() {
  const positions = getAllPositions();
  const activePositions = positions.filter(p => p.status === 'ACTIVE');

  return {
    isRunning: monitoringInterval !== null,
    activePositions: activePositions.length,
    totalPositions: positions.length,
    updateInterval: MONITOR_CONFIG.updateInterval,
    priceCheckInterval: MONITOR_CONFIG.priceCheckInterval,
    volatilityThreshold: MONITOR_CONFIG.volatilityThreshold
  };
}

/**
 * Update monitoring configuration
 */
export function updateMonitorConfig(newConfig) {
  Object.assign(MONITOR_CONFIG, newConfig);
  console.log('✅ Monitoring config updated:', MONITOR_CONFIG);
  
  // Restart monitoring with new config
  if (monitoringInterval) {
    stopPositionMonitoring();
    startPositionMonitoring();
  }
}
