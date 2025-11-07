/**
 * Advanced Token Safety Check API
 * Includes bundle detection, deployer funding, and smart wallet analysis
 */

import { fetchBirdeyeData } from '../lib/birdeye.js';
import { fetchSolscanMetadata } from '../lib/solscan.js';
import { fetchCoinGeckoData } from '../lib/coingecko.js';
import { calculateSafetyScore, getRecommendation } from '../lib/risk-scoring.js';
import { getComprehensiveSecurityAnalysis } from '../lib/goplus.js';
import { generateEnhancedRiskAnalysis } from '../lib/openai-ai-analysis.js';
import { detectBundledLaunch } from '../lib/bundle-detection.js';
import { analyzeDeployerFunding } from '../lib/deployer-funding.js';
import { getSmartWalletActivity } from '../lib/smart-wallet-index.js';

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Main handler for advanced token check
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

    console.log(`Advanced check for token: ${tokenAddress}`);

    // Fetch basic data in parallel
    const [birdeyeResult, solscanMetaResult, coingeckoResult, goplusResult] = 
      await Promise.allSettled([
        fetchBirdeyeData(tokenAddress),
        fetchSolscanMetadata(tokenAddress),
        fetchCoinGeckoData(tokenAddress),
        getComprehensiveSecurityAnalysis(tokenAddress),
      ]);

    // Extract basic data
    const birdeyeData = birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null;
    const solscanMeta = solscanMetaResult.status === 'fulfilled' ? solscanMetaResult.value : null;
    const coingeckoData = coingeckoResult.status === 'fulfilled' ? coingeckoResult.value : null;
    const goplusData = goplusResult.status === 'fulfilled' ? goplusResult.value : null;

    // Combine basic data
    const name = solscanMeta?.data?.name || coingeckoData?.name || 'Unknown Token';
    const symbol = solscanMeta?.data?.symbol || coingeckoData?.symbol || 'UNKNOWN';
    const price = birdeyeData?.data?.price || coingeckoData?.price || 0;
    const marketCap = birdeyeData?.data?.marketCap || coingeckoData?.marketCap || 0;
    const liquidity = birdeyeData?.data?.liquidity || marketCap * 0.1;
    const volume24h = birdeyeData?.data?.volume24h || coingeckoData?.volume24h || 0;
    const priceChange24h = birdeyeData?.data?.priceChange24h || coingeckoData?.priceChange24h || 0;
    const holders = birdeyeData?.data?.holders || solscanMeta?.data?.holder || 0;

    // Calculate basic safety score
    const scoringResult = calculateSafetyScore(tokenAddress, birdeyeData, solscanMeta, coingeckoData, goplusData);
    let score = scoringResult.score;
    const warnings = scoringResult.warnings;

    // Run advanced detection modules in parallel
    const [bundleResult, fundingResult, smartWalletResult, aiResult] = 
      await Promise.allSettled([
        detectBundledLaunch(tokenAddress),
        analyzeDeployerFunding(tokenAddress),
        getSmartWalletActivity(tokenAddress),
        generateEnhancedRiskAnalysis({
          token_name: name,
          token_symbol: symbol,
          price_usd: price,
          market_cap_usd: marketCap,
          liquidity_usd: liquidity,
          volume_24h_usd: volume24h,
          price_change_24h: priceChange24h,
          holder_count: holders
        }, goplusData)
      ]);

    // Extract advanced detection results
    const bundleData = bundleResult.status === 'fulfilled' ? bundleResult.value : null;
    const fundingData = fundingResult.status === 'fulfilled' ? fundingResult.value : null;
    const smartWalletData = smartWalletResult.status === 'fulfilled' ? smartWalletResult.value : null;
    const aiAnalysis = aiResult.status === 'fulfilled' ? aiResult.value : null;

    // Adjust safety score based on advanced detection
    if (bundleData?.is_bundled && bundleData.bundle_analysis?.risk_score >= 70) {
      score = Math.max(0, score - 40); // Major penalty for bundled launch
      warnings.unshift(`🚨 BUNDLED LAUNCH: ${bundleData.bundle_analysis.coordinated_wallets} coordinated buyers`);
    }

    if (fundingData?.insider_confidence >= 0.7) {
      score = Math.max(0, score - 30); // Major penalty for deployer funding
      warnings.unshift(`🚨 INSIDER TRADING: ${fundingData.total_funded} buyers funded by deployer`);
    }

    // Add smart wallet signals to warnings (positive signals)
    if (smartWalletData?.quorum?.quorum_met) {
      warnings.push(`💰 SMART MONEY: ${smartWalletData.quorum.elite_wallets_buying} elite wallets holding`);
    }

    if (smartWalletData?.second_wave?.second_wave_detected) {
      warnings.push(`📊 SECOND-WAVE: ${smartWalletData.second_wave.total_smart_wallets_accumulating} smart wallets re-accumulating`);
    }

    const recommendation = getRecommendation(score);
    const responseTime = Date.now() - startTime;

    // Build comprehensive response
    const response = {
      success: true,
      data: {
        // Basic info
        token_address: tokenAddress,
        token_name: name,
        token_symbol: symbol,
        decimals: solscanMeta?.data?.decimals || 9,
        
        // Safety scores
        safety_score: score,
        risk_score: 100 - score,
        recommendation: recommendation,
        warnings: warnings,
        
        // Market data
        price_usd: price,
        market_cap_usd: marketCap,
        liquidity_usd: liquidity,
        volume_24h_usd: volume24h,
        price_change_24h: priceChange24h,
        holder_count: holders,
        
        // GoPlus security
        is_honeypot: goplusData?.honeypot?.is_honeypot || false,
        honeypot_confidence: goplusData?.honeypot?.confidence || 0,
        is_mintable: goplusData?.mint_authority?.has_mint_authority || false,
        mint_authority_address: goplusData?.mint_authority?.authority_address || null,
        
        // AI analysis
        ai_analysis: aiAnalysis?.reasoning || null,
        ai_confidence: aiAnalysis?.confidence || null,
        ai_risk_level: aiAnalysis?.risk_level || null,
        ai_primary_concern: aiAnalysis?.primary_concern || null,
        ai_scam_patterns: aiAnalysis?.scam_patterns || [],
        ai_key_findings: aiAnalysis?.key_findings || [],
        
        // Advanced detection
        bundle_detection: bundleData?.is_bundled ? {
          is_bundled: true,
          coordinated_wallets: bundleData.bundle_analysis.coordinated_wallets,
          deployer_funded_wallets: bundleData.bundle_analysis.deployer_funded_wallets,
          risk_score: bundleData.bundle_analysis.risk_score,
          evidence: bundleData.bundle_analysis.evidence
        } : null,
        
        deployer_funding: fundingData?.total_funded > 0 ? {
          deployer_address: fundingData.deployer_address,
          funded_wallets: fundingData.total_funded,
          total_funding_sol: fundingData.total_funding_sol,
          insider_confidence: fundingData.insider_confidence,
          funded_percentage: fundingData.funded_percentage
        } : null,
        
        smart_wallet_activity: {
          quorum_met: smartWalletData?.quorum?.quorum_met || false,
          elite_wallets_holding: smartWalletData?.quorum?.elite_wallets_buying || 0,
          second_wave_detected: smartWalletData?.second_wave?.second_wave_detected || false,
          smart_wallets_accumulating: smartWalletData?.second_wave?.total_smart_wallets_accumulating || 0,
          overall_signal: smartWalletData?.overall_signal?.overall || 'NEUTRAL'
        },
        
        // Metadata
        social_links: {
          website: solscanMeta?.data?.website || coingeckoData?.website || null,
          twitter: solscanMeta?.data?.twitter || coingeckoData?.twitter || null,
        },
        checked_at: new Date().toISOString(),
        response_time_ms: responseTime,
        
        // API status
        apis_used: {
          birdeye: birdeyeData?.success || false,
          solscan: solscanMeta?.success || false,
          coingecko: coingeckoData?.success || false,
          goplus: goplusData?.available || false,
          ai: aiAnalysis !== null,
          bundle_detection: bundleData?.success || false,
          deployer_funding: fundingData?.success || false,
          smart_wallet_tracking: smartWalletData?.success || false
        }
      },
    };

    console.log(`Advanced check completed in ${responseTime}ms - Score: ${score}`);

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
