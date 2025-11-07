/**
 * Enhanced Risk Scoring Algorithm
 * Properly recognizes established tokens and calculates accurate safety scores
 */

// Known safe tokens (whitelisted)
const SAFE_TOKENS = {
  // Stablecoins
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USDC', baseScore: 95 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'USDT', baseScore: 95 },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'mSOL', baseScore: 92 },
  
  // Major tokens
  'So11111111111111111111111111111111111111112': { name: 'Wrapped SOL', baseScore: 95 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { name: 'Bonk', baseScore: 85 },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { name: 'Jupiter', baseScore: 88 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { name: 'Ether (Portal)', baseScore: 90 },
};

/**
 * Calculate comprehensive safety score
 */
export function calculateSafetyScore(tokenAddress, birdeyeData, solscanData, coingeckoData) {
  // Check if token is whitelisted
  if (SAFE_TOKENS[tokenAddress]) {
    const whitelisted = SAFE_TOKENS[tokenAddress];
    console.log(`Token ${whitelisted.name} is whitelisted with base score ${whitelisted.baseScore}`);
    
    return {
      score: whitelisted.baseScore,
      warnings: [],
      isWhitelisted: true,
      whitelistedName: whitelisted.name,
    };
  }

  // Start with perfect score
  let score = 100;
  const warnings = [];
  const riskFactors = [];

  // Extract data
  const liquidity = birdeyeData?.data?.liquidity || 0;
  const marketCap = birdeyeData?.data?.marketCap || coingeckoData?.marketCap || 0;
  const volume24h = birdeyeData?.data?.volume24h || coingeckoData?.volume24h || 0;
  const priceChange24h = birdeyeData?.data?.priceChange24h || coingeckoData?.priceChange24h || 0;
  const holders = birdeyeData?.data?.holders || solscanData?.data?.holder || 0;
  const coingeckoRank = coingeckoData?.coingeckoRank;

  // === LIQUIDITY ANALYSIS ===
  if (liquidity === 0 && marketCap === 0) {
    score -= 40;
    warnings.push('No liquidity or market data available - extremely high risk');
    riskFactors.push({ factor: 'no_data', severity: 'critical', impact: -40 });
  } else if (liquidity > 0) {
    if (liquidity < 1000) {
      score -= 35;
      warnings.push(`Extremely low liquidity ($${liquidity.toFixed(0)}) - very high slippage risk`);
      riskFactors.push({ factor: 'very_low_liquidity', severity: 'critical', impact: -35 });
    } else if (liquidity < 10000) {
      score -= 25;
      warnings.push(`Very low liquidity ($${(liquidity / 1000).toFixed(1)}K) - high slippage risk`);
      riskFactors.push({ factor: 'low_liquidity', severity: 'high', impact: -25 });
    } else if (liquidity < 50000) {
      score -= 15;
      warnings.push(`Low liquidity ($${(liquidity / 1000).toFixed(1)}K) - moderate slippage risk`);
      riskFactors.push({ factor: 'moderate_liquidity', severity: 'medium', impact: -15 });
    } else if (liquidity < 100000) {
      score -= 5;
      riskFactors.push({ factor: 'acceptable_liquidity', severity: 'low', impact: -5 });
    }
    // Liquidity > $100K is good, no penalty
  }

  // === MARKET CAP ANALYSIS ===
  if (marketCap > 0) {
    if (marketCap > 1000000000) { // > $1B
      score += 5; // Bonus for large market cap
      riskFactors.push({ factor: 'large_market_cap', severity: 'positive', impact: +5 });
    } else if (marketCap > 100000000) { // > $100M
      score += 3; // Bonus for established project
      riskFactors.push({ factor: 'established_market_cap', severity: 'positive', impact: +3 });
    } else if (marketCap < 10000) { // < $10K
      score -= 30;
      warnings.push(`Extremely low market cap ($${(marketCap / 1000).toFixed(1)}K) - very high risk`);
      riskFactors.push({ factor: 'micro_cap', severity: 'critical', impact: -30 });
    } else if (marketCap < 100000) { // < $100K
      score -= 20;
      warnings.push(`Very low market cap ($${(marketCap / 1000).toFixed(1)}K) - high volatility risk`);
      riskFactors.push({ factor: 'low_market_cap', severity: 'high', impact: -20 });
    } else if (marketCap < 1000000) { // < $1M
      score -= 10;
      warnings.push(`Low market cap ($${(marketCap / 1000).toFixed(0)}K) - moderate risk`);
      riskFactors.push({ factor: 'small_cap', severity: 'medium', impact: -10 });
    }
  }

  // === VOLUME ANALYSIS ===
  if (volume24h > 0 && marketCap > 0) {
    const volumeToMcRatio = volume24h / marketCap;
    
    if (volumeToMcRatio > 10) {
      // Very high volume relative to market cap - possible wash trading
      score -= 20;
      warnings.push(`Abnormally high trading volume (${volumeToMcRatio.toFixed(1)}x market cap) - possible wash trading`);
      riskFactors.push({ factor: 'wash_trading_suspected', severity: 'high', impact: -20 });
    } else if (volumeToMcRatio > 5) {
      score -= 10;
      warnings.push(`Very high trading volume (${volumeToMcRatio.toFixed(1)}x market cap) - unusual activity`);
      riskFactors.push({ factor: 'high_volume_ratio', severity: 'medium', impact: -10 });
    } else if (volumeToMcRatio < 0.001) {
      // Very low volume
      score -= 15;
      warnings.push('Very low trading volume - low liquidity and interest');
      riskFactors.push({ factor: 'low_volume', severity: 'medium', impact: -15 });
    } else if (volumeToMcRatio >= 0.1 && volumeToMcRatio <= 2) {
      // Healthy volume range
      score += 2;
      riskFactors.push({ factor: 'healthy_volume', severity: 'positive', impact: +2 });
    }
  } else if (volume24h === 0) {
    score -= 15;
    warnings.push('No trading volume detected');
    riskFactors.push({ factor: 'no_volume', severity: 'medium', impact: -15 });
  }

  // === PRICE VOLATILITY ===
  if (priceChange24h !== 0) {
    const absChange = Math.abs(priceChange24h);
    
    if (absChange > 100) {
      score -= 25;
      warnings.push(`Extreme price volatility (${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(1)}% in 24h)`);
      riskFactors.push({ factor: 'extreme_volatility', severity: 'critical', impact: -25 });
    } else if (absChange > 50) {
      score -= 15;
      warnings.push(`Very high price volatility (${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(1)}% in 24h)`);
      riskFactors.push({ factor: 'high_volatility', severity: 'high', impact: -15 });
    } else if (absChange > 20) {
      score -= 8;
      warnings.push(`High price volatility (${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(1)}% in 24h)`);
      riskFactors.push({ factor: 'moderate_volatility', severity: 'medium', impact: -8 });
    } else if (absChange < 2) {
      // Stable price is good
      score += 2;
      riskFactors.push({ factor: 'price_stability', severity: 'positive', impact: +2 });
    }
  }

  // === HOLDER ANALYSIS ===
  if (holders > 0) {
    if (holders > 1000000) { // > 1M holders
      score += 5;
      riskFactors.push({ factor: 'massive_adoption', severity: 'positive', impact: +5 });
    } else if (holders > 100000) { // > 100K holders
      score += 3;
      riskFactors.push({ factor: 'wide_adoption', severity: 'positive', impact: +3 });
    } else if (holders > 10000) { // > 10K holders
      score += 2;
      riskFactors.push({ factor: 'good_adoption', severity: 'positive', impact: +2 });
    } else if (holders < 100) {
      score -= 20;
      warnings.push(`Very few holders (${holders}) - high centralization risk`);
      riskFactors.push({ factor: 'low_holders', severity: 'high', impact: -20 });
    } else if (holders < 1000) {
      score -= 10;
      warnings.push(`Few holders (${holders}) - moderate centralization risk`);
      riskFactors.push({ factor: 'moderate_holders', severity: 'medium', impact: -10 });
    }
  }

  // === COINGECKO VERIFICATION ===
  if (coingeckoRank) {
    if (coingeckoRank <= 100) {
      score += 5;
      riskFactors.push({ factor: 'top_100_token', severity: 'positive', impact: +5 });
    } else if (coingeckoRank <= 500) {
      score += 3;
      riskFactors.push({ factor: 'top_500_token', severity: 'positive', impact: +3 });
    } else if (coingeckoRank <= 1000) {
      score += 2;
      riskFactors.push({ factor: 'ranked_token', severity: 'positive', impact: +2 });
    }
  } else if (coingeckoData && !coingeckoData.success) {
    score -= 8;
    warnings.push('Token not found on CoinGecko - may be very new or unlisted');
    riskFactors.push({ factor: 'not_on_coingecko', severity: 'medium', impact: -8 });
  }

  // === SOCIAL PRESENCE ===
  const hasWebsite = coingeckoData?.website || solscanData?.data?.website;
  const hasTwitter = coingeckoData?.twitter || solscanData?.data?.twitter;
  
  if (!hasWebsite && !hasTwitter) {
    score -= 15;
    warnings.push('No website or social media presence found');
    riskFactors.push({ factor: 'no_social', severity: 'medium', impact: -15 });
  } else if (hasWebsite && hasTwitter) {
    score += 2;
    riskFactors.push({ factor: 'verified_social', severity: 'positive', impact: +2 });
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    warnings: warnings,
    riskFactors: riskFactors,
    isWhitelisted: false,
  };
}

/**
 * Get recommendation based on score
 */
export function getRecommendation(score) {
  if (score >= 85) return 'SAFE';
  if (score >= 70) return 'LOW_RISK';
  if (score >= 50) return 'MODERATE_RISK';
  if (score >= 30) return 'HIGH_RISK';
  return 'EXTREME_DANGER';
}

/**
 * Get color code for UI
 */
export function getScoreColor(score) {
  if (score >= 85) return 'green';
  if (score >= 70) return 'lightgreen';
  if (score >= 50) return 'yellow';
  if (score >= 30) return 'orange';
  return 'red';
}
