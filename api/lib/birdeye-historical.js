/**
 * Birdeye Historical Data
 * OHLCV charts and pattern analysis
 * Optimize entry times and identify pump/dump patterns
 */

const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;

/**
 * Get token price history (OHLCV)
 * @param {string} tokenAddress - Token address to query
 * @param {string} timeframe - '1m', '5m', '15m', '1h', '4h', '1d'
 * @param {number} limit - Number of candles to fetch
 */
export async function getPriceHistory(tokenAddress, timeframe = '5m', limit = 100) {
  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/defi/ohlcv?address=${tokenAddress}&type=${timeframe}&time_from=${Date.now() - (limit * getTimeframeMs(timeframe))}&time_to=${Date.now()}`,
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
      candles: data.data?.items || []
    };
  } catch (error) {
    console.error('Error fetching price history:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert timeframe to milliseconds
 */
function getTimeframeMs(timeframe) {
  const map = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  return map[timeframe] || 5 * 60 * 1000;
}

/**
 * Detect parabolic pump pattern
 * Returns true if token is in parabolic pump (high risk of dump)
 */
export async function detectParabolicPump(tokenAddress) {
  try {
    // Get 5-minute candles for last hour
    const result = await getPriceHistory(tokenAddress, '5m', 12);
    
    if (!result.success || result.candles.length < 5) {
      return { success: false, error: 'Insufficient data' };
    }

    const candles = result.candles;
    
    // Check if every candle closes higher than it opens (strong uptrend)
    const allGreen = candles.every(c => c.close > c.open);
    
    // Check if each candle closes 50%+ higher than previous
    const parabolic = candles.slice(1).every((c, i) => {
      const prevClose = candles[i].close;
      return c.close > prevClose * 1.5;
    });

    const isParabolic = allGreen && parabolic;

    return {
      success: true,
      isParabolic,
      risk: isParabolic ? 'HIGH' : 'NORMAL',
      message: isParabolic
        ? '🚨 Parabolic pump detected - high risk of dump'
        : '✅ Normal price action',
      candles: candles.length
    };
  } catch (error) {
    console.error('Error detecting parabolic pump:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze best entry times
 * Returns optimal hours of day for token launches
 */
export async function analyzeBestEntryTimes(tokenAddresses) {
  try {
    console.log(`📊 Analyzing entry times for ${tokenAddresses.length} tokens...`);

    const hourlyPerformance = new Array(24).fill(0).map(() => ({
      trades: 0,
      totalMultiplier: 0,
      avgMultiplier: 0
    }));

    for (const address of tokenAddresses) {
      // Get 1-hour candles for last 7 days
      const result = await getPriceHistory(address, '1h', 168); // 7 days * 24 hours
      
      if (!result.success) continue;

      const candles = result.candles;
      
      // Analyze each candle
      for (const candle of candles) {
        const hour = new Date(candle.time * 1000).getHours();
        const multiplier = candle.high / candle.open;
        
        hourlyPerformance[hour].trades++;
        hourlyPerformance[hour].totalMultiplier += multiplier;
      }
    }

    // Calculate averages
    for (let hour = 0; hour < 24; hour++) {
      const perf = hourlyPerformance[hour];
      if (perf.trades > 0) {
        perf.avgMultiplier = perf.totalMultiplier / perf.trades;
      }
    }

    // Find best hours
    const bestHours = hourlyPerformance
      .map((perf, hour) => ({ hour, ...perf }))
      .filter(h => h.trades >= 10) // Minimum 10 trades
      .sort((a, b) => b.avgMultiplier - a.avgMultiplier)
      .slice(0, 5);

    return {
      success: true,
      bestHours: bestHours.map(h => ({
        hour: h.hour,
        avgMultiplier: h.avgMultiplier.toFixed(2) + 'x',
        trades: h.trades
      })),
      recommendation: bestHours.length > 0
        ? `Best entry times: ${bestHours.map(h => `${h.hour}:00`).join(', ')}`
        : 'Insufficient data'
    };
  } catch (error) {
    console.error('Error analyzing entry times:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate time to peak
 * Returns average time from launch to peak price
 */
export async function calculateTimeToPeak(tokenAddress) {
  try {
    // Get 5-minute candles for last 24 hours
    const result = await getPriceHistory(tokenAddress, '5m', 288); // 24 hours * 12 (5-min intervals)
    
    if (!result.success || result.candles.length < 10) {
      return { success: false, error: 'Insufficient data' };
    }

    const candles = result.candles;
    
    // Find peak price
    let peakPrice = 0;
    let peakIndex = 0;
    
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].high > peakPrice) {
        peakPrice = candles[i].high;
        peakIndex = i;
      }
    }

    // Calculate time to peak (in minutes)
    const timeToPeakMinutes = peakIndex * 5; // 5-minute candles
    const timeToPeakHours = (timeToPeakMinutes / 60).toFixed(1);

    // Calculate time from peak to current (dump time)
    const timeSincePeakMinutes = (candles.length - peakIndex - 1) * 5;
    const timeSincePeakHours = (timeSincePeakMinutes / 60).toFixed(1);

    // Calculate peak multiplier
    const openPrice = candles[0].open;
    const peakMultiplier = (peakPrice / openPrice).toFixed(2);

    // Calculate current price vs peak
    const currentPrice = candles[candles.length - 1].close;
    const currentVsPeak = ((currentPrice / peakPrice) * 100).toFixed(1);

    return {
      success: true,
      timeToPeakHours: parseFloat(timeToPeakHours),
      timeSincePeakHours: parseFloat(timeSincePeakHours),
      peakMultiplier: parseFloat(peakMultiplier),
      currentVsPeak: parseFloat(currentVsPeak),
      recommendation: timeSincePeakHours > 1
        ? '⚠️ Token peaked >1 hour ago - consider exiting'
        : '✅ Still within peak window'
    };
  } catch (error) {
    console.error('Error calculating time to peak:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Detect pump and dump pattern
 * Returns true if token shows pump-dump characteristics
 */
export async function detectPumpAndDump(tokenAddress) {
  try {
    // Get 5-minute candles for last 2 hours
    const result = await getPriceHistory(tokenAddress, '5m', 24);
    
    if (!result.success || result.candles.length < 10) {
      return { success: false, error: 'Insufficient data' };
    }

    const candles = result.candles;
    
    // Find peak
    let peakPrice = 0;
    let peakIndex = 0;
    
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].high > peakPrice) {
        peakPrice = candles[i].high;
        peakIndex = i;
      }
    }

    const openPrice = candles[0].open;
    const currentPrice = candles[candles.length - 1].close;
    
    // Calculate pump multiplier
    const pumpMultiplier = peakPrice / openPrice;
    
    // Calculate dump percentage
    const dumpPercent = ((peakPrice - currentPrice) / peakPrice) * 100;

    // Pump and dump criteria:
    // 1. Pumped 5x+ in short time
    // 2. Dumped 50%+ from peak
    const isPumpAndDump = pumpMultiplier >= 5 && dumpPercent >= 50;

    return {
      success: true,
      isPumpAndDump,
      pumpMultiplier: pumpMultiplier.toFixed(2) + 'x',
      dumpPercent: dumpPercent.toFixed(1) + '%',
      peakIndex,
      currentIndex: candles.length - 1,
      warning: isPumpAndDump
        ? '🚨 PUMP AND DUMP DETECTED - EXIT NOW'
        : dumpPercent > 30
        ? '⚠️ Significant dump detected'
        : '✅ Normal price action'
    };
  } catch (error) {
    console.error('Error detecting pump and dump:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get volatility score (0-100)
 * Higher score = more volatile (riskier)
 */
export async function getVolatilityScore(tokenAddress) {
  try {
    // Get 5-minute candles for last hour
    const result = await getPriceHistory(tokenAddress, '5m', 12);
    
    if (!result.success || result.candles.length < 5) {
      return { success: false, error: 'Insufficient data' };
    }

    const candles = result.candles;
    
    // Calculate price changes
    const priceChanges = [];
    for (let i = 1; i < candles.length; i++) {
      const change = Math.abs((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
      priceChanges.push(change);
    }

    // Calculate average volatility
    const avgVolatility = priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length;
    
    // Convert to 0-100 score
    // 10% avg change = 100 score
    const volatilityScore = Math.min(100, (avgVolatility / 0.1) * 100);

    return {
      success: true,
      volatilityScore: Math.round(volatilityScore),
      avgChangePercent: (avgVolatility * 100).toFixed(2) + '%',
      risk: volatilityScore > 70 ? 'HIGH' : volatilityScore > 40 ? 'MEDIUM' : 'LOW',
      recommendation: volatilityScore > 70
        ? '🚨 Extremely volatile - reduce position size'
        : volatilityScore > 40
        ? '⚠️ Moderate volatility - use tight stop loss'
        : '✅ Low volatility'
    };
  } catch (error) {
    console.error('Error calculating volatility:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Comprehensive pattern analysis
 * Combines all pattern detection methods
 */
export async function analyzePatterns(tokenAddress) {
  try {
    console.log(`📊 Analyzing patterns for ${tokenAddress.substring(0, 8)}...`);

    const [
      parabolic,
      pumpDump,
      timeToPeak,
      volatility
    ] = await Promise.all([
      detectParabolicPump(tokenAddress),
      detectPumpAndDump(tokenAddress),
      calculateTimeToPeak(tokenAddress),
      getVolatilityScore(tokenAddress)
    ]);

    // Calculate overall risk score
    let riskScore = 0;
    
    if (parabolic.success && parabolic.isParabolic) riskScore += 30;
    if (pumpDump.success && pumpDump.isPumpAndDump) riskScore += 40;
    if (volatility.success && volatility.volatilityScore > 70) riskScore += 20;
    if (timeToPeak.success && timeToPeak.timeSincePeakHours > 2) riskScore += 10;

    const overallRisk = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW';

    return {
      success: true,
      patterns: {
        parabolic: parabolic.success ? parabolic : null,
        pumpDump: pumpDump.success ? pumpDump : null,
        timeToPeak: timeToPeak.success ? timeToPeak : null,
        volatility: volatility.success ? volatility : null
      },
      riskScore,
      overallRisk,
      recommendation: riskScore > 60
        ? '🚨 HIGH RISK - EXIT IMMEDIATELY'
        : riskScore > 30
        ? '⚠️ MEDIUM RISK - Consider reducing position'
        : '✅ LOW RISK - Continue monitoring'
    };
  } catch (error) {
    console.error('Error analyzing patterns:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test Birdeye historical data
 */
export async function testBirdeyeHistorical() {
  try {
    console.log('🧪 Testing Birdeye historical data...');

    // Test with USDC
    const testAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    const result = await getPriceHistory(testAddress, '1h', 24);
    
    if (result.success) {
      console.log('✅ Historical data test successful');
      console.log(`   Candles fetched: ${result.candles.length}`);
      return {
        success: true,
        message: 'Historical data working',
        candles: result.candles.length
      };
    } else {
      console.error('❌ Historical data test failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Birdeye historical test error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  getPriceHistory,
  detectParabolicPump,
  analyzeBestEntryTimes,
  calculateTimeToPeak,
  detectPumpAndDump,
  getVolatilityScore,
  analyzePatterns,
  testBirdeyeHistorical
};
