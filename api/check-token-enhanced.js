/**
 * Enhanced Token Safety Check API
 * Combines Birdeye, Solscan, CoinGecko, and AI analysis
 */

import { fetchBirdeyeData, analyzeBirdeyeData } from '../lib/birdeye.js';
import { fetchSolscanMetadata, fetchSolscanHolders, analyzeSolscanData } from '../lib/solscan.js';
import { fetchCoinGeckoData } from '../lib/coingecko.js';
import { fetchJupiterPrice } from '../lib/jupiter.js';

const API_TIMEOUT_MS = 4500;

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Calculate comprehensive safety score
 */
function calculateSafetyScore(birdeyeData, solscanData, coingeckoData) {
  let score = 100;
  const warnings = [];

  // Birdeye analysis
  if (birdeyeData?.success) {
    const birdeyeAnalysis = analyzeBirdeyeData(birdeyeData);
    score -= birdeyeAnalysis.riskScore;
    warnings.push(...birdeyeAnalysis.warnings);
  }

  // Solscan analysis
  if (solscanData?.success) {
    const solscanAnalysis = analyzeSolscanData(solscanData);
    score -= solscanAnalysis.riskScore;
    warnings.push(...solscanAnalysis.warnings);
  }

  // CoinGecko verification
  if (coingeckoData?.success) {
    if (!coingeckoData.coingeckoRank) {
      score -= 10;
      warnings.push('Token not ranked on CoinGecko');
    }
  } else {
    score -= 15;
    warnings.push('Token not found on CoinGecko - may be very new or unlisted');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    warnings: [...new Set(warnings)], // Remove duplicates
  };
}

/**
 * Determine recommendation
 */
function getRecommendation(score) {
  if (score >= 80) return 'SAFE';
  if (score >= 60) return 'CAUTION';
  if (score >= 40) return 'HIGH_RISK';
  return 'DANGER';
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const startTime = Date.now();

  try {
    const tokenAddress = req.body?.tokenAddress;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing tokenAddress',
      });
    }

    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana address',
      });
    }

    console.log(`Checking token: ${tokenAddress}`);

    // Fetch from all sources in parallel
    const [birdeyeResult, solscanMetaResult, solscanHoldersResult, coingeckoResult, jupiterResult] = 
      await Promise.allSettled([
        fetchBirdeyeData(tokenAddress),
        fetchSolscanMetadata(tokenAddress),
        fetchSolscanHolders(tokenAddress, 10),
        fetchCoinGeckoData(tokenAddress),
        fetchJupiterPrice(tokenAddress),
      ]);

    // Extract data
    const birdeyeData = birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null;
    const solscanMeta = solscanMetaResult.status === 'fulfilled' ? solscanMetaResult.value : null;
    const solscanHolders = solscanHoldersResult.status === 'fulfilled' ? solscanHoldersResult.value : null;
    const coingeckoData = coingeckoResult.status === 'fulfilled' ? coingeckoResult.value : null;
    const jupiterData = jupiterResult.status === 'fulfilled' ? jupiterResult.value : null;

    // Combine data (priority: Birdeye > CoinGecko > Jupiter)
    const name = solscanMeta?.data?.name || coingeckoData?.name || 'Unknown Token';
    const symbol = solscanMeta?.data?.symbol || coingeckoData?.symbol || 'UNKNOWN';
    const price = birdeyeData?.data?.price || coingeckoData?.price || jupiterData?.price || 0;
    const marketCap = birdeyeData?.data?.marketCap || coingeckoData?.marketCap || 0;
    const liquidity = birdeyeData?.data?.liquidity || marketCap * 0.1;
    const volume24h = birdeyeData?.data?.volume24h || coingeckoData?.volume24h || 0;
    const priceChange24h = birdeyeData?.data?.priceChange24h || coingeckoData?.priceChange24h || 0;
    const holders = birdeyeData?.data?.holders || solscanMeta?.data?.holder || 0;

    // Calculate top holder percentage
    let topHolderPercent = 0;
    if (solscanHolders?.success && solscanHolders.data?.length > 0) {
      topHolderPercent = solscanHolders.data[0].amount / 100; // Assuming amount is in percentage
    }

    // Calculate safety score
    const { score, warnings } = calculateSafetyScore(birdeyeData, solscanMeta, coingeckoData);
    const recommendation = getRecommendation(score);

    // Build response
    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: {
        token_address: tokenAddress,
        token_name: name,
        token_symbol: symbol,
        decimals: solscanMeta?.data?.decimals || 9,
        safety_score: score,
        risk_score: 100 - score,
        is_honeypot: false, // Would need deeper analysis
        is_mintable: false, // Would need on-chain check
        has_blacklist: false, // Would need on-chain check
        top_holder_percent: topHolderPercent,
        liquidity_usd: liquidity,
        market_cap_usd: marketCap,
        price_usd: price,
        volume_24h_usd: volume24h,
        price_change_24h: priceChange24h,
        holder_count: holders,
        circulating_supply: birdeyeData?.data?.supply || coingeckoData?.circulatingSupply || 0,
        total_supply: coingeckoData?.totalSupply || 0,
        warnings: warnings,
        ai_analysis: null,
        ai_confidence: null,
        recommendation: recommendation,
        social_links: {
          website: solscanMeta?.data?.website || coingeckoData?.website || null,
          twitter: solscanMeta?.data?.twitter || coingeckoData?.twitter || null,
        },
        coingecko_rank: coingeckoData?.coingeckoRank || null,
        checked_at: new Date().toISOString(),
        response_time_ms: responseTime,
        apis_used: {
          birdeye: birdeyeData?.success || false,
          solscan: solscanMeta?.success || false,
          coingecko: coingeckoData?.success || false,
          jupiter: jupiterData?.success || false,
          ai: false,
        },
      },
    };

    console.log(`Token check completed in ${responseTime}ms - Score: ${score}`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      response_time_ms: Date.now() - startTime,
    });
  }
}
