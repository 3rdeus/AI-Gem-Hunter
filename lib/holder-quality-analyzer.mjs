/**
 * Holder Quality Analyzer
 * Analyzes token holders to differentiate bots from real investors
 */

import { query } from './postgres.js';
import { getWalletQualityMetrics, calculateWalletQualityScore } from './whale-tracker.mjs';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

/**
 * Get token holders from Helius API
 */
async function getTokenHolders(tokenAddress, limit = 100) {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mintAccounts: [tokenAddress]
        })
      }
    );

    if (!response.ok) {
      console.error(`[HOLDER-QUALITY] Helius API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Try to get holder list from token accounts
    // Note: Helius doesn't directly provide holder list in token-metadata
    // We'll need to use a different approach or API endpoint
    
    return null; // Placeholder - need to implement proper holder fetching
    
  } catch (error) {
    console.error('[HOLDER-QUALITY] Error fetching token holders:', error.message);
    return null;
  }
}

/**
 * Analyze a single holder's quality
 */
async function analyzeHolderQuality(holderAddress) {
  try {
    // Get wallet metrics
    const metrics = await getWalletQualityMetrics(holderAddress);
    if (!metrics) return null;

    // Calculate quality score
    const qualityScore = calculateWalletQualityScore({
      walletAgeDays: metrics.walletAgeDays,
      successRate: 0.5, // Default - would need historical analysis
      portfolioValueUsd: 5000, // Default - would need balance check
      monthlyTxCount: metrics.monthlyTxCount
    });

    return {
      address: holderAddress,
      walletAgeDays: metrics.walletAgeDays,
      monthlyTxCount: metrics.monthlyTxCount,
      qualityScore,
      isBot: metrics.walletAgeDays < 7 && metrics.monthlyTxCount < 5,
      isWhale: false // Would need balance check
    };

  } catch (error) {
    console.error('[HOLDER-QUALITY] Error analyzing holder:', error.message);
    return null;
  }
}

/**
 * Analyze all holders of a token and calculate aggregate quality score
 */
export async function analyzeTokenHolderQuality(tokenAddress, holderCount) {
  try {
    console.log(`[HOLDER-QUALITY] 🔍 Analyzing holder quality for ${tokenAddress}...`);

    // For now, use a simplified scoring based on holder count
    // In production, we'd analyze actual holder wallets
    
    let qualityScore = 50; // Base score
    let botPercentage = 30; // Estimated
    let whaleCount = 0;

    // Adjust score based on holder count
    if (holderCount < 10) {
      qualityScore = 20; // Very few holders = low quality
      botPercentage = 50;
    } else if (holderCount < 50) {
      qualityScore = 40;
      botPercentage = 40;
    } else if (holderCount < 200) {
      qualityScore = 60;
      botPercentage = 30;
    } else if (holderCount < 1000) {
      qualityScore = 75;
      botPercentage = 20;
      whaleCount = Math.floor(holderCount * 0.05); // Estimate 5% whales
    } else {
      qualityScore = 85;
      botPercentage = 15;
      whaleCount = Math.floor(holderCount * 0.08); // Estimate 8% whales
    }

    // Save to database using direct SQL with UPSERT
    try {
      await query(
        `INSERT INTO token_holder_quality 
         (token_address, total_holders, quality_score, avg_wallet_age_days, avg_success_rate, 
          avg_portfolio_value_usd, bot_percentage, whale_count, analyzed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (token_address) DO UPDATE SET
           total_holders = EXCLUDED.total_holders,
           quality_score = EXCLUDED.quality_score,
           avg_wallet_age_days = EXCLUDED.avg_wallet_age_days,
           avg_success_rate = EXCLUDED.avg_success_rate,
           avg_portfolio_value_usd = EXCLUDED.avg_portfolio_value_usd,
           bot_percentage = EXCLUDED.bot_percentage,
           whale_count = EXCLUDED.whale_count,
           analyzed_at = EXCLUDED.analyzed_at`,
        [tokenAddress, holderCount, qualityScore, 180, 0.5, 5000, botPercentage, whaleCount, new Date().toISOString()]
      );
    } catch (saveError) {
      console.error('[HOLDER-QUALITY] Error saving holder quality:', saveError.message);
    }

    console.log(`[HOLDER-QUALITY] ✅ Quality Score: ${qualityScore}/100`);
    console.log(`[HOLDER-QUALITY] 📊 Holders: ${holderCount} (${botPercentage}% estimated bots)`);
    console.log(`[HOLDER-QUALITY] 🐋 Whales: ${whaleCount}`);

    return {
      qualityScore,
      totalHolders: holderCount,
      botPercentage,
      whaleCount,
      avgWalletAgeDays: 180,
      avgSuccessRate: 0.5,
      avgPortfolioValueUsd: 5000
    };

  } catch (error) {
    console.error('[HOLDER-QUALITY] Error in analyzeTokenHolderQuality:', error);
    return { qualityScore: 50, reason: error.message };
  }
}

/**
 * Enhanced holder scoring that integrates with existing token scoring
 */
export function calculateEnhancedHolderScore(holderCount, holderQualityData) {
  // Base holder count score (0-100)
  let countScore = 0;
  if (holderCount < 10) countScore = 10;
  else if (holderCount < 50) countScore = 30;
  else if (holderCount < 200) countScore = 50;
  else if (holderCount < 1000) countScore = 70;
  else if (holderCount < 5000) countScore = 85;
  else countScore = 95;

  // Quality multiplier (0.5 - 1.5)
  const qualityMultiplier = holderQualityData?.qualityScore 
    ? (holderQualityData.qualityScore / 100) * 0.5 + 0.5 
    : 1.0;

  // Bot penalty
  const botPenalty = holderQualityData?.botPercentage 
    ? (holderQualityData.botPercentage / 100) * 20 
    : 0;

  // Whale bonus
  const whaleBonus = holderQualityData?.whaleCount 
    ? Math.min(holderQualityData.whaleCount * 2, 15) 
    : 0;

  // Final score
  const finalScore = Math.max(0, Math.min(100, 
    (countScore * qualityMultiplier) - botPenalty + whaleBonus
  ));

  return Math.round(finalScore);
}

/**
 * Batch analyze holder quality for multiple tokens
 */
export async function batchAnalyzeHolderQuality(tokens) {
  console.log(`[HOLDER-QUALITY] 📊 Batch analyzing ${tokens.length} tokens...`);
  
  const results = [];
  
  for (const token of tokens) {
    const quality = await analyzeTokenHolderQuality(
      token.token_address, 
      token.holder_count || 0
    );
    
    results.push({
      tokenAddress: token.token_address,
      ...quality
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`[HOLDER-QUALITY] ✅ Analyzed ${results.length} tokens`);
  
  return results;
}
