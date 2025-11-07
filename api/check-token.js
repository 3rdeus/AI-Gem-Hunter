/**
 * Enhanced Token Safety Check API
 * Combines Birdeye, Solscan, CoinGecko, and AI analysis
 */

import { fetchBirdeyeData } from '../lib/birdeye.js';
import { fetchSolscanMetadata, fetchSolscanHolders } from '../lib/solscan.js';
import { fetchCoinGeckoData } from '../lib/coingecko.js';
import { fetchJupiterPrice } from '../lib/jupiter.js';
import { calculateSafetyScore, getRecommendation } from '../lib/risk-scoring.js';
import { getComprehensiveSecurityAnalysis } from '../lib/goplus.js';
import { generateEnhancedRiskAnalysis } from '../lib/openai-ai-analysis.js';

const API_TIMEOUT_MS = 4500;

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Risk scoring is now imported from risk-scoring.js

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

    // Fetch from all sources in parallel (including GoPlus security check)
    const [birdeyeResult, solscanMetaResult, solscanHoldersResult, coingeckoResult, jupiterResult, goplusResult] = 
      await Promise.allSettled([
        fetchBirdeyeData(tokenAddress),
        fetchSolscanMetadata(tokenAddress),
        fetchSolscanHolders(tokenAddress, 10),
        fetchCoinGeckoData(tokenAddress),
        fetchJupiterPrice(tokenAddress),
        getComprehensiveSecurityAnalysis(tokenAddress),
      ]);

    // Extract data
    const birdeyeData = birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null;
    const solscanMeta = solscanMetaResult.status === 'fulfilled' ? solscanMetaResult.value : null;
    const solscanHolders = solscanHoldersResult.status === 'fulfilled' ? solscanHoldersResult.value : null;
    const coingeckoData = coingeckoResult.status === 'fulfilled' ? coingeckoResult.value : null;
    const jupiterData = jupiterResult.status === 'fulfilled' ? jupiterResult.value : null;
    const goplusData = goplusResult.status === 'fulfilled' ? goplusResult.value : null;

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

    // Calculate safety score with improved algorithm (including GoPlus data)
    const scoringResult = calculateSafetyScore(tokenAddress, birdeyeData, solscanMeta, coingeckoData, goplusData);
    let score = scoringResult.score;
    const warnings = scoringResult.warnings;
    const isWhitelisted = scoringResult.isWhitelisted;
    
    // Apply GoPlus security penalties
    if (goplusData?.available) {
      score = Math.max(0, score - goplusData.total_score_penalty);
      
      // Add GoPlus warnings
      if (goplusData.honeypot.is_honeypot) {
        warnings.unshift(`🚨 HONEYPOT DETECTED: ${goplusData.honeypot.reason}`);
      }
      
      if (goplusData.mint_authority.has_mint_authority) {
        const severity = goplusData.mint_authority.is_malicious ? '🚨 CRITICAL' : '⚠️';
        warnings.push(`${severity} Mint authority active: ${goplusData.mint_authority.warning}`);
      }
      
      goplusData.other_risks.forEach(risk => {
        const icon = risk.severity === 'critical' ? '🚨' : risk.severity === 'high' ? '⚠️' : 'ℹ️';
        warnings.push(`${icon} ${risk.message}`);
      });
    }
    
    const recommendation = getRecommendation(score);

    // Generate AI-powered risk analysis (optional, with timeout)
    let aiAnalysis = null;
    try {
      const aiPromise = generateEnhancedRiskAnalysis({
        token_name: name,
        token_symbol: symbol,
        price_usd: price,
        market_cap_usd: marketCap,
        liquidity_usd: liquidity,
        volume_24h_usd: volume24h,
        price_change_24h: priceChange24h,
        holder_count: holders
      }, goplusData);
      
      // Wait max 3 seconds for AI analysis
      aiAnalysis = await Promise.race([
        aiPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 3000))
      ]);
    } catch (error) {
      console.warn('AI analysis skipped:', error.message);
    }

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
        is_honeypot: goplusData?.honeypot?.is_honeypot || false,
        honeypot_confidence: goplusData?.honeypot?.confidence || 0,
        is_mintable: goplusData?.mint_authority?.has_mint_authority || false,
        mint_authority_address: goplusData?.mint_authority?.authority_address || null,
        has_blacklist: false, // Not yet implemented
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
        ai_analysis: aiAnalysis?.reasoning || null,
        ai_confidence: aiAnalysis?.confidence || null,
        ai_risk_level: aiAnalysis?.risk_level || null,
        ai_primary_concern: aiAnalysis?.primary_concern || null,
        ai_scam_patterns: aiAnalysis?.scam_patterns_detected || [],
        ai_key_findings: aiAnalysis?.key_findings || [],
        recommendation: aiAnalysis?.recommendation || recommendation,
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
          goplus: goplusData?.available || false,
          ai: aiAnalysis !== null,
        },
        goplus_security: goplusData?.available ? {
          honeypot: goplusData.honeypot,
          mint_authority: goplusData.mint_authority,
          other_risks: goplusData.other_risks,
          trusted_token: goplusData.trusted_token
        } : null,
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
