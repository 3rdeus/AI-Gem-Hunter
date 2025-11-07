/**
 * Birdeye Liquidity Monitoring
 * Real-time liquidity tracking for rug pull detection
 * Alert when liquidity drops 50%+ (rug pull warning)
 */

const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;

/**
 * Liquidity tracking state
 */
const liquidityTracking = new Map();
const liquidityCallbacks = new Map();

/**
 * Get token liquidity
 * @param {string} tokenAddress - Token address to query
 */
export async function getTokenLiquidity(tokenAddress) {
  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/defi/token_liquidity?address=${tokenAddress}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      liquidity: {
        liquidityUSD: data.data?.liquidityUSD || 0,
        liquiditySOL: data.data?.liquiditySOL || 0,
        liquidityChange24h: data.data?.liquidityChange24h || 0,
        volume24h: data.data?.volume24h || 0,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('Error fetching token liquidity:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Track liquidity changes
 * @param {string} tokenAddress - Token to track
 * @param {function} onLiquidityChange - Callback for liquidity changes
 * @param {Object} options - Tracking options
 */
export async function trackLiquidity(tokenAddress, onLiquidityChange, options = {}) {
  try {
    const {
      checkInterval = 5000, // Check every 5 seconds
      rugThreshold = 0.5, // Alert if liquidity drops 50%
      warningThreshold = 0.3 // Warn if liquidity drops 30%
    } = options;

    console.log(`💧 Tracking liquidity for ${tokenAddress.substring(0, 8)}...`);

    // Get initial liquidity
    const initialResult = await getTokenLiquidity(tokenAddress);
    
    if (!initialResult.success) {
      return { success: false, error: initialResult.error };
    }

    const initialLiquidity = initialResult.liquidity;

    // Store tracking state
    liquidityTracking.set(tokenAddress, {
      address: tokenAddress,
      initialLiquidity: initialLiquidity.liquidityUSD,
      currentLiquidity: initialLiquidity.liquidityUSD,
      previousLiquidity: initialLiquidity.liquidityUSD,
      rugThreshold,
      warningThreshold,
      lastCheck: Date.now(),
      alerts: []
    });

    // Store callback
    liquidityCallbacks.set(tokenAddress, onLiquidityChange);

    // Start monitoring
    const intervalId = setInterval(async () => {
      await checkLiquidityChanges(tokenAddress, onLiquidityChange, options);
    }, checkInterval);

    liquidityTracking.get(tokenAddress).intervalId = intervalId;

    console.log(`✅ Liquidity tracking started for ${tokenAddress.substring(0, 8)}`);
    console.log(`   Initial liquidity: $${initialLiquidity.liquidityUSD.toLocaleString()}`);

    return {
      success: true,
      initialLiquidity: initialLiquidity.liquidityUSD
    };
  } catch (error) {
    console.error('Error tracking liquidity:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check for liquidity changes
 */
async function checkLiquidityChanges(tokenAddress, onLiquidityChange, options) {
  try {
    const tracking = liquidityTracking.get(tokenAddress);
    if (!tracking) return;

    // Get current liquidity
    const result = await getTokenLiquidity(tokenAddress);
    
    if (!result.success) {
      console.error(`Failed to get liquidity for ${tokenAddress.substring(0, 8)}`);
      return;
    }

    const currentLiquidity = result.liquidity.liquidityUSD;
    const previousLiquidity = tracking.currentLiquidity;
    const initialLiquidity = tracking.initialLiquidity;

    // Update tracking
    tracking.previousLiquidity = tracking.currentLiquidity;
    tracking.currentLiquidity = currentLiquidity;
    tracking.lastCheck = Date.now();

    // Calculate changes
    const changePercent = ((currentLiquidity - previousLiquidity) / previousLiquidity) * 100;
    const changeFromInitial = ((currentLiquidity - initialLiquidity) / initialLiquidity) * 100;

    // Check for significant drops
    const rugThreshold = tracking.rugThreshold;
    const warningThreshold = tracking.warningThreshold;

    let alertType = null;
    let alertMessage = null;

    // Rug pull detection (50%+ drop from initial)
    if (currentLiquidity < initialLiquidity * rugThreshold) {
      alertType = 'RUG_PULL';
      alertMessage = `🚨 RUG PULL DETECTED: Liquidity dropped ${Math.abs(changeFromInitial).toFixed(1)}% from initial!`;
      
      tracking.alerts.push({
        type: alertType,
        message: alertMessage,
        timestamp: Date.now(),
        liquidityBefore: initialLiquidity,
        liquidityAfter: currentLiquidity,
        changePercent: changeFromInitial
      });

      console.error(alertMessage);
    }
    // Warning (30%+ drop)
    else if (currentLiquidity < previousLiquidity * (1 - warningThreshold)) {
      alertType = 'WARNING';
      alertMessage = `⚠️ LIQUIDITY WARNING: Dropped ${Math.abs(changePercent).toFixed(1)}% in last check`;
      
      tracking.alerts.push({
        type: alertType,
        message: alertMessage,
        timestamp: Date.now(),
        liquidityBefore: previousLiquidity,
        liquidityAfter: currentLiquidity,
        changePercent
      });

      console.warn(alertMessage);
    }
    // Significant increase (good sign)
    else if (changePercent > 50) {
      alertType = 'LIQUIDITY_ADD';
      alertMessage = `✅ LIQUIDITY ADDED: Increased ${changePercent.toFixed(1)}%`;
      
      console.log(alertMessage);
    }

    // Call callback if there's a change
    if (alertType) {
      const changeData = {
        tokenAddress,
        alertType,
        alertMessage,
        liquidityUSD: currentLiquidity,
        previousLiquidityUSD: previousLiquidity,
        initialLiquidityUSD: initialLiquidity,
        changePercent,
        changeFromInitial,
        timestamp: Date.now()
      };

      await onLiquidityChange(changeData);
    }
  } catch (error) {
    console.error('Error checking liquidity changes:', error.message);
  }
}

/**
 * Stop tracking liquidity
 */
export function stopTrackingLiquidity(tokenAddress) {
  const tracking = liquidityTracking.get(tokenAddress);
  
  if (tracking && tracking.intervalId) {
    clearInterval(tracking.intervalId);
    liquidityTracking.delete(tokenAddress);
    liquidityCallbacks.delete(tokenAddress);
    
    console.log(`🛑 Stopped liquidity tracking for ${tokenAddress.substring(0, 8)}`);
    
    return { success: true };
  }

  return { success: false, error: 'Token not tracked' };
}

/**
 * Get liquidity tracking status
 */
export function getLiquidityTrackingStatus(tokenAddress) {
  const tracking = liquidityTracking.get(tokenAddress);
  
  if (!tracking) {
    return { success: false, error: 'Token not tracked' };
  }

  return {
    success: true,
    status: {
      address: tracking.address.substring(0, 8) + '...',
      initialLiquidity: tracking.initialLiquidity,
      currentLiquidity: tracking.currentLiquidity,
      changePercent: ((tracking.currentLiquidity - tracking.initialLiquidity) / tracking.initialLiquidity * 100).toFixed(2) + '%',
      lastCheck: new Date(tracking.lastCheck).toISOString(),
      alertsCount: tracking.alerts.length,
      recentAlerts: tracking.alerts.slice(-5)
    }
  };
}

/**
 * Get all tracked tokens
 */
export function getAllTrackedLiquidity() {
  return Array.from(liquidityTracking.values()).map(tracking => ({
    address: tracking.address.substring(0, 8) + '...',
    initialLiquidity: tracking.initialLiquidity,
    currentLiquidity: tracking.currentLiquidity,
    changePercent: ((tracking.currentLiquidity - tracking.initialLiquidity) / tracking.initialLiquidity * 100).toFixed(2) + '%',
    alertsCount: tracking.alerts.length
  }));
}

/**
 * Emergency exit check
 * Returns true if liquidity dropped significantly (rug pull)
 */
export function shouldEmergencyExit(tokenAddress) {
  const tracking = liquidityTracking.get(tokenAddress);
  
  if (!tracking) {
    return false;
  }

  const currentLiquidity = tracking.currentLiquidity;
  const initialLiquidity = tracking.initialLiquidity;
  const rugThreshold = tracking.rugThreshold;

  // Check if liquidity dropped below rug threshold
  return currentLiquidity < initialLiquidity * rugThreshold;
}

/**
 * Get liquidity health score (0-100)
 */
export function getLiquidityHealthScore(tokenAddress) {
  const tracking = liquidityTracking.get(tokenAddress);
  
  if (!tracking) {
    return null;
  }

  const currentLiquidity = tracking.currentLiquidity;
  const initialLiquidity = tracking.initialLiquidity;
  const changePercent = ((currentLiquidity - initialLiquidity) / initialLiquidity) * 100;

  let score = 100;

  // Penalize for liquidity drops
  if (changePercent < 0) {
    score = Math.max(0, 100 + changePercent); // -50% = 50 score
  }
  // Bonus for liquidity increases
  else if (changePercent > 0) {
    score = Math.min(100, 100 + (changePercent * 0.2)); // +50% = 110 score (capped at 100)
  }

  // Penalize for alerts
  const alertPenalty = tracking.alerts.length * 5;
  score = Math.max(0, score - alertPenalty);

  return {
    score: Math.round(score),
    status: score >= 80 ? 'HEALTHY' : score >= 50 ? 'WARNING' : 'DANGER',
    currentLiquidity,
    initialLiquidity,
    changePercent: changePercent.toFixed(2) + '%'
  };
}

/**
 * Test Birdeye liquidity monitoring
 */
export async function testBirdeyeLiquidity() {
  try {
    console.log('🧪 Testing Birdeye liquidity monitoring...');

    // Test with USDC
    const testAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    const result = await getTokenLiquidity(testAddress);
    
    if (result.success) {
      console.log('✅ Liquidity monitoring test successful');
      console.log(`   Liquidity: $${result.liquidity.liquidityUSD.toLocaleString()}`);
      return {
        success: true,
        message: 'Liquidity monitoring working',
        liquidity: result.liquidity
      };
    } else {
      console.error('❌ Liquidity monitoring test failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Birdeye liquidity test error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  getTokenLiquidity,
  trackLiquidity,
  stopTrackingLiquidity,
  getLiquidityTrackingStatus,
  getAllTrackedLiquidity,
  shouldEmergencyExit,
  getLiquidityHealthScore,
  testBirdeyeLiquidity
};
