/**
 * Token Scoring Engine
 * Evaluates Solana tokens across multiple factors and assigns a quality score (0-100)
 */

import { fetchTokenDataFromHeliusWithRetry } from './helius-data-fetcher.mjs';

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const API_TIMEOUT_MS = 5000;

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
  liquidity: 0.25,    // How much money is in the pool
  volume: 0.20,       // How much trading activity
  holders: 0.15,      // How many people own it
  social: 0.15,       // Social media presence
  safety: 0.25        // Security and risk factors
};

/**
 * Calculate comprehensive gem score for a token
 * @param {string} tokenAddress - Solana token address
 * @param {Object} tokenData - Token data from Birdeye (optional, will fetch if not provided)
 * @returns {Promise<{score: number, breakdown: Object, data: Object}>}
 */
export async function calculateGemScore(tokenAddress, tokenData = null) {
  try {
    console.log(`[SCORER] Calculating gem score for: ${tokenAddress}`);
    
    // Fetch token data if not provided
    if (!tokenData) {
      tokenData = await fetchTokenData(tokenAddress);
    }
    
    if (!tokenData) {
      console.error(`[SCORER] ⚠️ NO DATA AVAILABLE for ${tokenAddress}`);
      console.error(`[SCORER] ⚠️ This means the API call failed or returned empty data`);
      console.error(`[SCORER] ⚠️ Token will be scored with default values (likely 35/100)`);
      return {
        score: 0,
        breakdown: {},
        data: null,
        error: 'No data available'
      };
    }
    
    // Calculate individual scores
    const liquidityScore = calculateLiquidityScore(tokenData);
    const volumeScore = calculateVolumeScore(tokenData);
    const holderScore = calculateHolderScore(tokenData);
    const socialScore = calculateSocialScore(tokenData);
    const safetyScore = calculateSafetyScore(tokenData);
    
    // Calculate weighted final score
    const finalScore = Math.round(
      (liquidityScore * WEIGHTS.liquidity) +
      (volumeScore * WEIGHTS.volume) +
      (holderScore * WEIGHTS.holders) +
      (socialScore * WEIGHTS.social) +
      (safetyScore * WEIGHTS.safety)
    );
    
    // NEW: Calculate potential score for early-stage tokens
    // Emphasizes liquidity + safety over volume + holders for brand-new tokens
    const volumePlusHoldersScore = volumeScore + holderScore;
    const potentialScore = Math.round(
      0.4 * liquidityScore +
      0.4 * safetyScore +
      0.2 * volumePlusHoldersScore
    );
    
    // Flag tokens as "early" if they have very low volume + holders
    const isEarlyToken = volumePlusHoldersScore < 40;
    
    const breakdown = {
      liquidity: liquidityScore,
      volume: volumeScore,
      holders: holderScore,
      social: socialScore,
      safety: safetyScore,
      // NEW fields
      potential: potentialScore,
      volumePlusHolders: volumePlusHoldersScore,
      isEarly: isEarlyToken
    };
    
    console.log(`[SCORER] ${tokenAddress} - Final Score: ${finalScore}/100`);
    console.log(`[SCORER] Breakdown:`, breakdown);
    
    return {
      score: finalScore,
      breakdown,
      data: tokenData,
      error: null
    };
    
  } catch (error) {
    console.error(`[SCORER] Error calculating score for ${tokenAddress}:`, error.message);
    return {
      score: 0,
      breakdown: {},
      data: null,
      error: error.message
    };
  }
}

/**
 * Check if token data is valid (not all zeros)
 */
function isValidTokenData(data) {
  if (!data) return false;
  
  // Check if we have any meaningful data
  const hasLiquidity = data.liquidity && data.liquidity > 0;
  const hasVolume = data.v24hUSD && data.v24hUSD > 0;
  const hasHolders = data.holder && data.holder > 0;
  
  // At least one metric should be non-zero
  return hasLiquidity || hasVolume || hasHolders;
}

/**
 * Fetch comprehensive token data from Birdeye with retry logic
 */
async function fetchTokenData(tokenAddress, retryCount = 0, maxRetries = 3) {
  console.log(`[SCORER] 🔍 Fetching data for token: ${tokenAddress} (Attempt ${retryCount + 1}/${maxRetries + 1})`);
  
  // Try Helius first (better for brand new tokens)
  if (retryCount === 0) {
    console.log(`[SCORER] 🎯 Trying Helius API first...`);
    const heliusData = await fetchTokenDataFromHeliusWithRetry(tokenAddress, 2);
    
    if (heliusData && (heliusData.liquidity > 0 || heliusData.volume24h > 0 || heliusData.holders > 0)) {
      console.log(`[SCORER] ✅ Got meaningful data from Helius!`);
      // Convert Helius data format to Birdeye format for compatibility
      return {
        liquidity: heliusData.liquidity,
        v24hUSD: heliusData.volume24h,
        holder: heliusData.holders,
        mc: heliusData.marketCap,
        price: heliusData.price,
        supply: heliusData.supply,
        extensions: {
          website: heliusData.website
        }
      };
    }
    
    console.log(`[SCORER] ⚠️ Helius returned no data, trying Birdeye as fallback...`);
  }
  
  // Fallback to Birdeye
  const url = `${BIRDEYE_API_URL}/defi/token_overview?address=${tokenAddress}`;
  console.log(`[SCORER] 📡 API URL: ${url}`);
  console.log(`[SCORER] 🔑 API Key configured: ${BIRDEYE_API_KEY ? 'YES' : 'NO'}`);
  console.log(`[SCORER] ⏱️ Timeout: ${API_TIMEOUT_MS}ms`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[SCORER] ⏰ REQUEST TIMEOUT after ${API_TIMEOUT_MS}ms`);
    controller.abort();
  }, API_TIMEOUT_MS);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    const elapsed = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`[SCORER] ✅ Response received in ${elapsed}ms`);
    console.log(`[SCORER] 📊 Status: ${response.status} ${response.statusText}`);
    console.log(`[SCORER] 📋 Headers:`, JSON.stringify(Object.fromEntries(response.headers)));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SCORER] ❌ Birdeye API error: ${response.status}`);
      console.error(`[SCORER] ❌ Error body:`, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log(`[SCORER] 📦 Response data:`, JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.error(`[SCORER] ❌ API returned success: false`);
      console.error(`[SCORER] ❌ Full response:`, JSON.stringify(data));
      return null;
    }
    
    if (!data.data) {
      console.error(`[SCORER] ❌ API returned no data object`);
      console.error(`[SCORER] ❌ Full response:`, JSON.stringify(data));
      return null;
    }
    
    console.log(`[SCORER] ✅ Successfully fetched token data`);
    console.log(`[SCORER] 💰 Liquidity: $${data.data.liquidity || 0}`);
    console.log(`[SCORER] 📈 Volume 24h: $${data.data.v24hUSD || 0}`);
    console.log(`[SCORER] 👥 Holders: ${data.data.holder || 0}`);
    
    // Check if data is valid (not all zeros)
    if (!isValidTokenData(data.data)) {
      console.warn(`[SCORER] ⚠️ Data returned but all metrics are zero`);
      console.warn(`[SCORER] ⚠️ Token may be too new for Birdeye to index`);
      
      // Don't retry Birdeye if it returns zeros, just return what we have
      console.error(`[SCORER] ❌ Birdeye returned zero data, no more retries`);
      return data.data;
    }
    
    console.log(`[SCORER] ✅ Valid data confirmed (not all zeros)`);
    return data.data;
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`[SCORER] ⏰ TIMEOUT: Request aborted after ${elapsed}ms`);
    } else {
      console.error(`[SCORER] ❌ FETCH ERROR after ${elapsed}ms:`, error.message);
      console.error(`[SCORER] ❌ Error type:`, error.name);
      console.error(`[SCORER] ❌ Error stack:`, error.stack);
    }
    
    return null;
  }
}

/**
 * Score based on liquidity depth
 * Higher liquidity = more stable, less manipulation risk
 */
function calculateLiquidityScore(data) {
  const liquidity = data.liquidity || 0;
  
  // Scoring thresholds (in USD)
  if (liquidity >= 100000) return 100;  // $100k+ = excellent
  if (liquidity >= 50000) return 90;    // $50k+ = very good
  if (liquidity >= 25000) return 80;    // $25k+ = good
  if (liquidity >= 10000) return 70;    // $10k+ = decent
  if (liquidity >= 5000) return 60;     // $5k+ = acceptable
  if (liquidity >= 1000) return 40;     // $1k+ = risky
  if (liquidity >= 500) return 20;      // $500+ = very risky
  return 10;                             // < $500 = extremely risky
}

/**
 * Score based on trading volume
 * Higher volume = more interest and activity
 */
function calculateVolumeScore(data) {
  const volume24h = data.v24hUSD || 0;
  const liquidity = data.liquidity || 1; // Avoid division by zero
  
  // Volume to liquidity ratio is important
  const volumeRatio = volume24h / liquidity;
  
  // Absolute volume thresholds
  let volumeScore = 0;
  if (volume24h >= 500000) volumeScore = 100;      // $500k+ = excellent
  else if (volume24h >= 100000) volumeScore = 90;  // $100k+ = very good
  else if (volume24h >= 50000) volumeScore = 80;   // $50k+ = good
  else if (volume24h >= 10000) volumeScore = 70;   // $10k+ = decent
  else if (volume24h >= 5000) volumeScore = 60;    // $5k+ = acceptable
  else if (volume24h >= 1000) volumeScore = 40;    // $1k+ = low
  else volumeScore = 20;
  
  // Bonus for good volume/liquidity ratio (healthy trading)
  if (volumeRatio >= 2.0) volumeScore = Math.min(100, volumeScore + 10);
  else if (volumeRatio >= 1.0) volumeScore = Math.min(100, volumeScore + 5);
  
  return Math.round(volumeScore);
}

/**
 * Score based on holder count and distribution
 * More holders = more distributed, less concentration risk
 */
function calculateHolderScore(data) {
  const holders = data.holder || 0;
  
  // Holder count thresholds
  if (holders >= 10000) return 100;    // 10k+ = excellent distribution
  if (holders >= 5000) return 90;      // 5k+ = very good
  if (holders >= 2000) return 80;      // 2k+ = good
  if (holders >= 1000) return 70;      // 1k+ = decent
  if (holders >= 500) return 60;       // 500+ = acceptable
  if (holders >= 200) return 50;       // 200+ = risky
  if (holders >= 100) return 40;       // 100+ = very risky
  if (holders >= 50) return 30;        // 50+ = extremely risky
  return 20;                            // < 50 = red flag
}

/**
 * Score based on social media presence and metadata
 * Better metadata = more legitimate project
 */
function calculateSocialScore(data) {
  let score = 50; // Start at neutral
  
  // Check for website
  if (data.extensions?.website) {
    score += 15;
  }
  
  // Check for Twitter
  if (data.extensions?.twitter) {
    score += 15;
  }
  
  // Check for Telegram
  if (data.extensions?.telegram) {
    score += 10;
  }
  
  // Check for Discord
  if (data.extensions?.discord) {
    score += 10;
  }
  
  // Penalty for no social presence at all
  if (!data.extensions || Object.keys(data.extensions).length === 0) {
    score = 20; // Major red flag
  }
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Score based on safety and risk factors
 * Checks for common scam indicators
 */
function calculateSafetyScore(data) {
  let score = 100; // Start optimistic, deduct for risks
  
  // Check token age (newer = riskier)
  const createdAt = data.createdAt;
  if (createdAt) {
    const ageInHours = (Date.now() - createdAt) / (1000 * 60 * 60);
    if (ageInHours < 1) score -= 30;        // < 1 hour = very new
    else if (ageInHours < 24) score -= 20;  // < 1 day = new
    else if (ageInHours < 168) score -= 10; // < 1 week = fairly new
  }
  
  // Check for price volatility (extreme changes = risky)
  const priceChange24h = Math.abs(data.v24hChangePercent || 0);
  if (priceChange24h > 500) score -= 30;      // > 500% change = extreme volatility
  else if (priceChange24h > 200) score -= 20; // > 200% change = high volatility
  else if (priceChange24h > 100) score -= 10; // > 100% change = moderate volatility
  
  // Check for suspicious supply
  const supply = data.supply || 0;
  if (supply > 1000000000000) score -= 20; // Trillion+ supply = suspicious
  
  // Check for low decimals (common in scams)
  const decimals = data.decimals || 0;
  if (decimals < 6) score -= 10; // Low decimals can indicate scam
  
  // Ensure score stays in valid range
  return Math.min(100, Math.max(0, score));
}

/**
 * Get human-readable score interpretation
 */
export function getScoreInterpretation(score) {
  if (score >= 90) return '🔥 EXCELLENT - High-quality gem';
  if (score >= 80) return '💎 VERY GOOD - Strong potential';
  if (score >= 70) return '✅ GOOD - Worth watching';
  if (score >= 60) return '⚠️ DECENT - Moderate potential';
  if (score >= 50) return '⚡ RISKY - High risk/reward';
  if (score >= 40) return '🚨 VERY RISKY - Proceed with caution';
  return '❌ AVOID - Too many red flags';
}

/**
 * Determine if token should trigger an alert based on score
 */
/**
 * Determine if a token score warrants an alert
 * Multi-tier system:
 * - 50-69: Risky/Speculative (⚠️ yellow alert)
 * - 70-79: Good quality (💎 green alert)
 * - 80-100: Excellent (🔥 red alert)
 */
export function shouldAlert(score) {
  return score >= 70; // Only alert for Good (70-79) and Excellent (80-100) tokens
}

/**
 * Get alert tier based on score
 */
export function getAlertTier(score) {
  if (score >= 80) return { tier: 'excellent', emoji: '🔥', color: 'red', label: 'EXCELLENT GEM' };
  if (score >= 70) return { tier: 'good', emoji: '💎', color: 'green', label: 'GOOD GEM' };
  if (score >= 50) return { tier: 'risky', emoji: '⚠️', color: 'yellow', label: 'RISKY/SPECULATIVE' };
  return { tier: 'avoid', emoji: '❌', color: 'gray', label: 'AVOID' };
}

/**
 * Get detailed scoring report for a token
 */
export async function getDetailedReport(tokenAddress) {
  const result = await calculateGemScore(tokenAddress);
  
  if (result.error) {
    return {
      success: false,
      error: result.error
    };
  }
  
  return {
    success: true,
    tokenAddress,
    score: result.score,
    interpretation: getScoreInterpretation(result.score),
    shouldAlert: shouldAlert(result.score),
    breakdown: result.breakdown,
    tokenData: {
      name: result.data.name || 'Unknown',
      symbol: result.data.symbol || 'N/A',
      liquidity: result.data.liquidity || 0,
      volume24h: result.data.v24hUSD || 0,
      holders: result.data.holder || 0,
      priceChange24h: result.data.v24hChangePercent || 0,
      marketCap: result.data.mc || 0
    }
  };
}

// Export scoring weights for transparency
export const SCORING_WEIGHTS = WEIGHTS;
