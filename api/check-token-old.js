/**
 * Main API Endpoint: Token Safety Check
 * Handles requests from Chrome extension with parallel API calls
 */

import 'dotenv/config';
import { fetchBirdeyeData, analyzeBirdeyeData } from '../lib/birdeye.js';
import { fetchSolscanMetadata, fetchSolscanHolders, fetchSolscanTransactions, analyzeSolscanData } from '../lib/solscan.js';
import { checkBlacklist, getCachedTokenData, cacheTokenData, getCommunityReports, analyzeSupabaseData } from '../lib/supabase.js';
import { analyzeWithAI } from '../lib/anthropic-ai.js';

const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS) || 4500;

/**
 * Main handler for serverless function
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify API key
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.EXTENSION_API_KEY;

  // Debug logging (remove in production)
  console.log('API Key from request:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
  console.log('Valid key from env:', validKey ? `${validKey.substring(0, 10)}...` : 'NOT_SET');

  // Temporarily disabled for debugging - REMOVE THIS IN PRODUCTION
  // if (validKey && (!apiKey || apiKey !== validKey)) {
  //   return res.status(401).json({
  //     success: false,
  //     error: 'Unauthorized - Invalid or missing API key',
  //   });
  // }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  const startTime = Date.now();

  try {
    // Extract token address from request
    const tokenAddress = req.body?.tokenAddress || req.body?.body?.tokenAddress;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing tokenAddress in request body',
      });
    }

    // Validate Solana address format
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana address format',
      });
    }

    console.log(`[${new Date().toISOString()}] Checking token: ${tokenAddress}`);

    // Check cache first
    const cached = await getCachedTokenData(tokenAddress);
    if (cached.success && cached.data.cached) {
      console.log(`Cache hit for ${tokenAddress}`);
      return res.status(200).json({
        success: true,
        data: {
          ...cached.data,
          from_cache: true,
          response_time_ms: Date.now() - startTime,
        },
      });
    }

    // Parallel API calls with timeout
    const apiPromises = [
      fetchBirdeyeData(tokenAddress),
      fetchSolscanMetadata(tokenAddress),
      fetchSolscanHolders(tokenAddress),
      fetchSolscanTransactions(tokenAddress),
      checkBlacklist(tokenAddress),
      getCommunityReports(tokenAddress),
    ];

    // Race against timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), API_TIMEOUT_MS);
    });

    const results = await Promise.race([
      Promise.allSettled(apiPromises),
      timeoutPromise,
    ]);

    // Check if we timed out
    if (results.timeout) {
      console.error(`Timeout after ${API_TIMEOUT_MS}ms`);
      return res.status(504).json({
        success: false,
        error: 'Request timed out. APIs taking too long to respond.',
      });
    }

    // Extract results
    const [
      birdeyeResult,
      metadataResult,
      holdersResult,
      transactionsResult,
      blacklistResult,
      communityReportsResult,
    ] = results;

    // Build token data object
    const tokenData = {
      birdeye: birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null,
      metadata: metadataResult.status === 'fulfilled' ? metadataResult.value : null,
      holders: holdersResult.status === 'fulfilled' ? holdersResult.value : null,
      transactions: transactionsResult.status === 'fulfilled' ? transactionsResult.value : null,
      blacklist: blacklistResult.status === 'fulfilled' ? blacklistResult.value : null,
      communityReports: communityReportsResult.status === 'fulfilled' ? communityReportsResult.value : null,
    };

    // Run AI analysis in parallel with data processing
    const aiAnalysisPromise = analyzeWithAI(tokenData);

    // Analyze data from each source
    const birdeyeAnalysis = analyzeBirdeyeData(tokenData.birdeye);
    const solscanAnalysis = analyzeSolscanData(
      tokenData.metadata,
      tokenData.holders,
      tokenData.transactions
    );
    const supabaseAnalysis = analyzeSupabaseData(
      tokenData.blacklist,
      tokenData.communityReports
    );

    // Wait for AI analysis (with timeout)
    const aiResult = await Promise.race([
      aiAnalysisPromise,
      new Promise((resolve) => setTimeout(() => resolve({ success: false, error: 'AI timeout' }), 3000)),
    ]);

    // Aggregate all warnings
    const allWarnings = [
      ...birdeyeAnalysis.warnings,
      ...solscanAnalysis.warnings,
      ...supabaseAnalysis.warnings,
    ];

    if (aiResult.success && aiResult.data.warnings) {
      allWarnings.push(...aiResult.data.warnings);
    }

    // Calculate combined risk score
    let combinedRiskScore = 0;
    let scoreCount = 0;

    if (birdeyeAnalysis.riskScore > 0) {
      combinedRiskScore += birdeyeAnalysis.riskScore;
      scoreCount++;
    }

    if (solscanAnalysis.riskScore > 0) {
      combinedRiskScore += solscanAnalysis.riskScore;
      scoreCount++;
    }

    if (supabaseAnalysis.riskScore > 0) {
      combinedRiskScore += supabaseAnalysis.riskScore;
      scoreCount++;
    }

    if (aiResult.success && aiResult.data.riskScore > 0) {
      combinedRiskScore += aiResult.data.riskScore;
      scoreCount++;
    }

    // Average risk score (or use max if blacklisted)
    let finalRiskScore = scoreCount > 0 ? Math.round(combinedRiskScore / scoreCount) : 50;
    
    if (supabaseAnalysis.riskScore >= 100) {
      finalRiskScore = 100; // Blacklisted = max risk
    }

    // Convert risk score to safety score (inverse)
    const safetyScore = Math.max(0, 100 - finalRiskScore);

    // Determine if honeypot based on AI and data
    const isHoneypot = (aiResult.success && aiResult.data.isHoneypot) || false;
    const isRugPull = (aiResult.success && aiResult.data.isRugPull) || false;

    // Build response
    const responseData = {
      token_address: tokenAddress,
      token_name: tokenData.metadata?.data?.name || 'Unknown Token',
      token_symbol: tokenData.metadata?.data?.symbol || 'UNKNOWN',
      decimals: tokenData.metadata?.data?.decimals || 9,
      safety_score: safetyScore,
      risk_score: finalRiskScore,
      is_honeypot: isHoneypot,
      is_mintable: false, // TODO: Add mint authority check
      has_blacklist: tokenData.blacklist?.data?.isBlacklisted || false,
      top_holder_percent: tokenData.holders?.data?.topHolderPercent || 0,
      liquidity_usd: tokenData.birdeye?.data?.liquidity || 0,
      market_cap_usd: tokenData.birdeye?.data?.marketCap || 0,
      price_usd: tokenData.birdeye?.data?.price || 0,
      volume_24h_usd: tokenData.birdeye?.data?.volume24h || 0,
      price_change_24h: tokenData.birdeye?.data?.priceChange24h || 0,
      holder_count: tokenData.holders?.data?.totalHolders || tokenData.metadata?.data?.holder || 0,
      warnings: allWarnings,
      ai_analysis: aiResult.success ? aiResult.data.analysis : null,
      ai_confidence: aiResult.success ? aiResult.data.confidence : null,
      recommendation: aiResult.success ? aiResult.data.recommendation : getRecommendation(safetyScore),
      checked_at: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      apis_used: {
        birdeye: birdeyeResult.status === 'fulfilled',
        solscan: metadataResult.status === 'fulfilled',
        supabase: blacklistResult.status === 'fulfilled',
        ai: aiResult.success,
      },
    };

    // Cache the result (don't wait for it)
    cacheTokenData(tokenAddress, responseData).catch(err => {
      console.error('Cache save failed:', err);
    });

    // Log completion
    console.log(`[${new Date().toISOString()}] Completed ${tokenAddress} in ${responseData.response_time_ms}ms - Safety: ${safetyScore}`);

    // Return response
    return res.status(200).json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Error in check-token:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      response_time_ms: Date.now() - startTime,
    });
  }
}

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

/**
 * Get recommendation based on safety score
 */
function getRecommendation(safetyScore) {
  if (safetyScore >= 80) return 'SAFE';
  if (safetyScore >= 60) return 'CAUTION';
  if (safetyScore >= 40) return 'DANGER';
  return 'EXTREME_DANGER';
}
