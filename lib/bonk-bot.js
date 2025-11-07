/**
 * Bonk Bot Integration
 * Automated buy/sell execution via Telegram bot commands
 */

const BONK_BOT_CHAT_ID = process.env.BONK_BOT_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Bonk Bot command templates
 */
const COMMANDS = {
  BUY: '/buy {ca} {amount} {slippage}',
  SELL: '/sell {ca} {percentage}',
  SELL_ALL: '/sell {ca} 100',
  LIMIT_SELL: '/limit {ca} {multiplier}',
  STOP_LOSS: '/sl {ca} {percentage}',
  POSITION: '/pos {ca}',
  BALANCE: '/balance'
};

/**
 * Active positions tracking
 */
const activePositions = new Map();

/**
 * Buy token via Bonk Bot
 * @param {Object} params - Buy parameters
 */
export async function buyViaBonkBot(params) {
  const {
    tokenAddress,
    amountSOL,
    slippage = 25,
    profitTargets = [2, 5, 10, 20],
    stopLoss = -50
  } = params;

  try {
    console.log(`🤖 Bonk Bot: Buying ${tokenAddress.substring(0, 8)}...`);
    console.log(`💰 Amount: ${amountSOL} SOL, Slippage: ${slippage}%`);

    // Send buy command to Bonk Bot
    const command = `/buy ${tokenAddress} ${amountSOL} ${slippage}`;
    const result = await sendBonkBotCommand(command);

    if (result.success) {
      // Store position for tracking
      const position = {
        tokenAddress,
        entryPrice: null, // Will be updated from confirmation
        amountSOL,
        profitTargets,
        stopLoss,
        status: 'PENDING',
        buyTime: new Date(),
        profitTargetsHit: []
      };

      activePositions.set(tokenAddress, position);

      console.log(`✅ Buy command sent successfully`);
      
      // Set up profit targets and stop loss
      await setupProfitTargets(tokenAddress, profitTargets);
      await setupStopLoss(tokenAddress, stopLoss);

      return {
        success: true,
        position,
        messageId: result.messageId
      };
    } else {
      console.error(`❌ Failed to send buy command: ${result.error}`);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Bonk Bot buy error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sell token via Bonk Bot
 * @param {Object} params - Sell parameters
 */
export async function sellViaBonkBot(params) {
  const {
    tokenAddress,
    percentage = 100,
    reason = 'Manual sell'
  } = params;

  try {
    console.log(`🤖 Bonk Bot: Selling ${percentage}% of ${tokenAddress.substring(0, 8)}...`);
    console.log(`📝 Reason: ${reason}`);

    // Send sell command to Bonk Bot
    const command = `/sell ${tokenAddress} ${percentage}`;
    const result = await sendBonkBotCommand(command);

    if (result.success) {
      // Update position
      const position = activePositions.get(tokenAddress);
      if (position) {
        if (percentage === 100) {
          position.status = 'CLOSED';
          position.closeTime = new Date();
          position.closeReason = reason;
        } else {
          position.partialSells = position.partialSells || [];
          position.partialSells.push({
            percentage,
            reason,
            time: new Date()
          });
        }
      }

      console.log(`✅ Sell command sent successfully`);

      return {
        success: true,
        position,
        messageId: result.messageId
      };
    } else {
      console.error(`❌ Failed to send sell command: ${result.error}`);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Bonk Bot sell error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set up profit targets for a position
 */
async function setupProfitTargets(tokenAddress, targets) {
  try {
    const position = activePositions.get(tokenAddress);
    if (!position) return;

    // Calculate percentage to sell at each target
    const percentagePerTarget = Math.floor(100 / targets.length);

    for (const target of targets) {
      // Send limit sell command to Bonk Bot
      // Note: Not all bots support limit orders, may need to monitor manually
      const command = `/limit ${tokenAddress} ${target}x ${percentagePerTarget}%`;
      
      console.log(`🎯 Setting profit target: ${target}x (sell ${percentagePerTarget}%)`);
      
      // Some bots may not support this, so we'll track manually
      // and execute sells when monitoring detects targets hit
    }

    return { success: true };
  } catch (error) {
    console.error('Error setting profit targets:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Set up stop loss for a position
 */
async function setupStopLoss(tokenAddress, stopLossPercent) {
  try {
    console.log(`🛑 Setting stop loss: ${stopLossPercent}%`);

    // Send stop loss command to Bonk Bot
    // Note: Not all bots support stop loss, may need to monitor manually
    const command = `/sl ${tokenAddress} ${Math.abs(stopLossPercent)}`;
    
    // Some bots may not support this, so we'll track manually
    // and execute sells when monitoring detects stop loss hit

    return { success: true };
  } catch (error) {
    console.error('Error setting stop loss:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send command to Bonk Bot via Telegram
 */
async function sendBonkBotCommand(command) {
  try {
    if (!BONK_BOT_CHAT_ID) {
      console.error('❌ BONK_BOT_CHAT_ID not configured');
      return {
        success: false,
        error: 'BONK_BOT_CHAT_ID not configured'
      };
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BONK_BOT_CHAT_ID,
        text: command,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description
      };
    }

    return {
      success: true,
      messageId: data.result.message_id
    };
  } catch (error) {
    console.error('Error sending Bonk Bot command:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get position status
 */
export function getPosition(tokenAddress) {
  return activePositions.get(tokenAddress);
}

/**
 * Get all active positions
 */
export function getAllPositions() {
  return Array.from(activePositions.values());
}

/**
 * Update position with current price data
 */
export function updatePosition(tokenAddress, priceData) {
  const position = activePositions.get(tokenAddress);
  if (!position) return null;

  const {
    currentPrice,
    marketCap,
    liquidity
  } = priceData;

  // Calculate entry price if not set
  if (!position.entryPrice && currentPrice) {
    position.entryPrice = currentPrice;
    position.status = 'ACTIVE';
    console.log(`📊 Position entry price set: $${currentPrice.toFixed(10)}`);
  }

  // Update current data
  position.currentPrice = currentPrice;
  position.currentMarketCap = marketCap;
  position.currentLiquidity = liquidity;
  position.lastUpdate = new Date();

  // Calculate P&L
  if (position.entryPrice && currentPrice) {
    position.pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    position.multiplier = currentPrice / position.entryPrice;
  }

  return position;
}

/**
 * Check if position should be closed (profit target or stop loss)
 */
export function checkPositionExit(tokenAddress) {
  const position = activePositions.get(tokenAddress);
  if (!position || position.status !== 'ACTIVE') return null;

  const { multiplier, pnlPercent, profitTargets, stopLoss, profitTargetsHit } = position;

  if (!multiplier || !pnlPercent) return null;

  // Check stop loss
  if (pnlPercent <= stopLoss) {
    return {
      shouldExit: true,
      reason: 'STOP_LOSS',
      percentage: 100,
      message: `Stop loss hit: ${pnlPercent.toFixed(1)}% (target: ${stopLoss}%)`
    };
  }

  // Check profit targets
  for (const target of profitTargets) {
    if (multiplier >= target && !profitTargetsHit.includes(target)) {
      profitTargetsHit.push(target);
      
      // Calculate percentage to sell
      const remainingTargets = profitTargets.filter(t => !profitTargetsHit.includes(t)).length;
      const percentage = remainingTargets > 0 ? 25 : 100; // Sell 25% or all if last target

      return {
        shouldExit: true,
        reason: 'PROFIT_TARGET',
        target,
        percentage,
        message: `Profit target ${target}x hit! (${pnlPercent.toFixed(1)}% gain)`
      };
    }
  }

  return null;
}

/**
 * Close position
 */
export function closePosition(tokenAddress, reason = 'Manual close') {
  const position = activePositions.get(tokenAddress);
  if (position) {
    position.status = 'CLOSED';
    position.closeTime = new Date();
    position.closeReason = reason;
    console.log(`🔒 Position closed: ${tokenAddress.substring(0, 8)} - ${reason}`);
  }
  return position;
}

/**
 * Get Bonk Bot stats
 */
export function getBonkBotStats() {
  const positions = Array.from(activePositions.values());
  
  return {
    totalPositions: positions.length,
    activePositions: positions.filter(p => p.status === 'ACTIVE').length,
    closedPositions: positions.filter(p => p.status === 'CLOSED').length,
    pendingPositions: positions.filter(p => p.status === 'PENDING').length,
    totalPnL: positions
      .filter(p => p.pnlPercent)
      .reduce((sum, p) => sum + p.pnlPercent, 0),
    avgPnL: positions.filter(p => p.pnlPercent).length > 0
      ? positions.filter(p => p.pnlPercent).reduce((sum, p) => sum + p.pnlPercent, 0) / positions.filter(p => p.pnlPercent).length
      : 0,
    winRate: calculateWinRate(positions)
  };
}

/**
 * Calculate win rate
 */
function calculateWinRate(positions) {
  const closedPositions = positions.filter(p => p.status === 'CLOSED' && p.pnlPercent !== undefined);
  if (closedPositions.length === 0) return 0;

  const winners = closedPositions.filter(p => p.pnlPercent > 0).length;
  return (winners / closedPositions.length) * 100;
}

/**
 * Test Bonk Bot connection
 */
export async function testBonkBotConnection() {
  try {
    const command = '/balance';
    const result = await sendBonkBotCommand(command);
    
    if (result.success) {
      console.log('✅ Bonk Bot connection test successful');
      return { success: true, message: 'Connected to Bonk Bot' };
    } else {
      console.error('❌ Bonk Bot connection test failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Bonk Bot connection test error:', error.message);
    return { success: false, error: error.message };
  }
}
