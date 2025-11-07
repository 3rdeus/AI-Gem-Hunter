/**
 * Token Safety Check API - Version 2 (Using Free APIs)
 * Uses CoinGecko and Jupiter instead of paid Birdeye/Solscan
 */

import { fetchCoinGeckoData, fetchSimplePrice } from '../lib/coingecko.js';
import { fetchJupiterPrice } from '../lib/jupiter.js';

const API_TIMEOUT_MS = 4500;

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Calculate safety score based on available data
 */
function calculateSafetyScore(data) {
  let score = 100; // Start with perfect score
  const warnings = [];

  // Check market cap
  if (data.marketCap === 0) {
    score -= 30;
    warnings.push('No market cap data available');
  } else if (data.marketCap < 10000) {
    score -= 40;
    warnings.push('Very low market cap (<$10K) - High risk');
  } else if (data.marketCap < 100000) {
    score -= 20;
    warnings.push('Low market cap (<$100K) - Moderate risk');
  }

  // Check volume
  if (data.volume24h === 0) {
    score -= 20;
    warnings.push('No trading volume');
  } else if (data.volume24h < 1000) {
    score -= 15;
    warnings.push('Very low trading volume (<$1K)');
  }

  // Check price volatility
  if (Math.abs(data.priceChange24h) > 50) {
    score -= 25;
    warnings.push(`Extreme price volatility (${data.priceChange24h.toFixed(2)}% in 24h)`);
  } else if (Math.abs(data.priceChange24h) > 20) {
    score -= 10;
    warnings.push(`High price volatility (${data.priceChange24h.toFixed(2)}% in 24h)`);
  }

  // Check social presence
  if (!data.website && !data.twitter) {
    score -= 20;
    warnings.push('No social media or website found');
  }

  // Check if token is recognized by CoinGecko
  if (!data.coingeckoRank) {
    score -= 10;
    warnings.push('Token not ranked on CoinGecko - may be very new or unlisted');
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return { score, warnings };
}

/**
 * Determine recommendation based on safety score
 */
function getRecommendation(score) {
  if (score >= 80) return 'SAFE';
  if (score >= 60) return 'CAUTION';
  if (score >= 40) return 'DANGER';
  return 'EXTREME_DANGER';
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // CORS headers
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
      error: 'Method not allowed. Use POST.',
    });
  }

  const startTime = Date.now();

  try {
    const tokenAddress = req.body?.tokenAddress;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing tokenAddress in request body',
      });
    }

    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana address format',
      });
    }

    console.log(`Checking token: ${tokenAddress}`);

    // Fetch data from free APIs in parallel
    const [coingeckoData, jupiterData] = await Promise.allSettled([
      fetchCoinGeckoData(tokenAddress),
      fetchJupiterPrice(tokenAddress),
    ]);

    // Extract data
    const cgData = coingeckoData.status === 'fulfilled' && coingeckoData.value.success
      ? coingeckoData.value
      : null;

    const jupData = jupiterData.status === 'fulfilled' && jupiterData.value.success
      ? jupiterData.value
      : null;

    // Combine data (prefer CoinGecko, fallback to Jupiter for price)
    const combinedData = {
      name: cgData?.name || 'Unknown Token',
      symbol: cgData?.symbol || 'UNKNOWN',
      price: cgData?.price || jupData?.price || 0,
      marketCap: cgData?.marketCap || 0,
      volume24h: cgData?.volume24h || 0,
      priceChange24h: cgData?.priceChange24h || 0,
      website: cgData?.website || '',
      twitter: cgData?.twitter || '',
      coingeckoRank: cgData?.coingeckoRank || null,
      coingeckoScore: cgData?.coingeckoScore || null,
      circulatingSupply: cgData?.circulatingSupply || 0,
      totalSupply: cgData?.totalSupply || 0,
    };

    // Calculate safety score
    const { score, warnings } = calculateSafetyScore(combinedData);
    const recommendation = getRecommendation(score);

    // Build response
    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: {
        token_address: tokenAddress,
        token_name: combinedData.name,
        token_symbol: combinedData.symbol,
        decimals: 9, // Standard for most Solana tokens
        safety_score: score,
        risk_score: 100 - score,
        is_honeypot: false, // Can't determine without on-chain analysis
        is_mintable: false, // Can't determine without on-chain analysis
        has_blacklist: false, // Can't determine without on-chain analysis
        top_holder_percent: 0, // Would need holder data
        liquidity_usd: combinedData.marketCap * 0.1, // Rough estimate
        market_cap_usd: combinedData.marketCap,
        price_usd: combinedData.price,
        volume_24h_usd: combinedData.volume24h,
        price_change_24h: combinedData.priceChange24h,
        holder_count: 0, // Would need on-chain data
        circulating_supply: combinedData.circulatingSupply,
        total_supply: combinedData.totalSupply,
        warnings: warnings,
        ai_analysis: null, // Could add AI analysis here
        ai_confidence: null,
        recommendation: recommendation,
        social_links: {
          website: combinedData.website || null,
          twitter: combinedData.twitter ? `https://twitter.com/${combinedData.twitter}` : null,
        },
        coingecko_rank: combinedData.coingeckoRank,
        checked_at: new Date().toISOString(),
        response_time_ms: responseTime,
        apis_used: {
          coingecko: cgData !== null,
          jupiter: jupData !== null,
          supabase: false,
          ai: false,
        },
      },
    };

    console.log(`Token check completed in ${responseTime}ms - Score: ${score}`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error processing request:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      response_time_ms: Date.now() - startTime,
    });
  }
}
