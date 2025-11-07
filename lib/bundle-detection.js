/**
 * Bundle Detection Module
 * Detects coordinated buying in token launch blocks (insider trading red flag)
 * Uses Solscan API + Helius RPC for transaction analysis
 */

import { fetchSolscanMetadata } from './solscan.js';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLSCAN_BASE_URL = 'https://api.solscan.io';

/**
 * Detect if a token launch was bundled (coordinated insider buying)
 * @param {string} tokenAddress - Token address to analyze
 * @returns {Promise<Object>} Bundle detection results
 */
export async function detectBundledLaunch(tokenAddress) {
  try {
    console.log(`Analyzing token for bundled launch: ${tokenAddress}`);

    // Step 1: Get token metadata and creation info
    const tokenMeta = await fetchSolscanMetadata(tokenAddress);
    if (!tokenMeta?.success) {
      return {
        success: false,
        error: 'Could not fetch token metadata'
      };
    }

    const creationTime = tokenMeta.data?.created_time;
    const deployerAddress = tokenMeta.data?.creator;

    if (!creationTime || !deployerAddress) {
      return {
        success: false,
        error: 'Missing creation time or deployer address'
      };
    }

    // Step 2: Get early transactions (first 100 after creation)
    const earlyTxs = await getEarlyTransactions(tokenAddress, creationTime);
    
    if (!earlyTxs || earlyTxs.length === 0) {
      return {
        success: true,
        is_bundled: false,
        reason: 'No early transactions found'
      };
    }

    // Step 3: Analyze transaction clustering (bundle detection)
    const bundleAnalysis = analyzeBundlePatterns(earlyTxs, creationTime);

    // Step 4: Check for deployer-funded wallets
    const deployerFunding = await analyzeDeployerFunding(
      deployerAddress,
      bundleAnalysis.early_buyers,
      creationTime
    );

    // Step 5: Calculate risk score
    const riskScore = calculateBundleRiskScore(bundleAnalysis, deployerFunding);

    // Step 6: Generate evidence
    const evidence = generateBundleEvidence(bundleAnalysis, deployerFunding);

    return {
      success: true,
      is_bundled: bundleAnalysis.is_likely_bundled,
      bundle_analysis: {
        creation_time: creationTime,
        deployer_address: deployerAddress,
        total_early_txs: earlyTxs.length,
        coordinated_wallets: bundleAnalysis.coordinated_wallets,
        total_bundled_buy_usd: bundleAnalysis.total_buy_amount_usd,
        deployer_funded_wallets: deployerFunding.funded_count,
        deployer_funding_sol: deployerFunding.total_funding_sol,
        first_block_buyers: bundleAnalysis.first_block_buyers,
        avg_time_between_buys_seconds: bundleAnalysis.avg_time_between_buys,
        risk_score: riskScore,
        evidence: evidence
      }
    };
  } catch (error) {
    console.error('Bundle detection error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get early transactions for a token (first 100 after creation)
 * @param {string} tokenAddress - Token address
 * @param {number} creationTime - Unix timestamp of token creation
 * @returns {Promise<Array>} Early transactions
 */
async function getEarlyTransactions(tokenAddress, creationTime) {
  try {
    // Use Solscan API to get token transfers
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/transactions?address=${tokenAddress}&limit=100`,
      {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('Solscan transactions API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Filter for transactions within first 5 minutes of creation
    const fiveMinutesAfterCreation = creationTime + (5 * 60);
    const earlyTxs = (data.data || []).filter(tx => {
      return tx.block_time <= fiveMinutesAfterCreation;
    });

    return earlyTxs.map(tx => ({
      signature: tx.tx_hash,
      block_time: tx.block_time,
      type: tx.type,
      from: tx.from,
      to: tx.to,
      amount: tx.amount || 0,
      decimals: tx.decimals || 9
    }));
  } catch (error) {
    console.error('Error fetching early transactions:', error.message);
    return [];
  }
}

/**
 * Analyze transaction patterns to detect bundled buying
 * @param {Array} transactions - Early transactions
 * @param {number} creationTime - Token creation timestamp
 * @returns {Object} Bundle pattern analysis
 */
function analyzeBundlePatterns(transactions, creationTime) {
  // Filter for buy transactions only
  const buyTxs = transactions.filter(tx => 
    tx.type === 'BUY' || tx.type === 'SWAP' || tx.amount > 0
  );

  if (buyTxs.length === 0) {
    return {
      is_likely_bundled: false,
      coordinated_wallets: 0,
      total_buy_amount_usd: 0,
      first_block_buyers: 0,
      avg_time_between_buys: 0
    };
  }

  // Group by time windows (1-second windows)
  const timeWindows = new Map();
  buyTxs.forEach(tx => {
    const windowKey = Math.floor(tx.block_time);
    if (!timeWindows.has(windowKey)) {
      timeWindows.set(windowKey, []);
    }
    timeWindows.get(windowKey).push(tx);
  });

  // Find largest cluster (likely bundle)
  let largestCluster = [];
  let largestClusterSize = 0;
  
  timeWindows.forEach((txs, time) => {
    if (txs.length > largestClusterSize) {
      largestClusterSize = txs.length;
      largestCluster = txs;
    }
  });

  // Count first block buyers (within 30 seconds of creation)
  const firstBlockBuyers = buyTxs.filter(tx => 
    tx.block_time <= creationTime + 30
  ).length;

  // Calculate average time between buys
  const sortedTimes = buyTxs.map(tx => tx.block_time).sort((a, b) => a - b);
  const timeDiffs = [];
  for (let i = 1; i < sortedTimes.length; i++) {
    timeDiffs.push(sortedTimes[i] - sortedTimes[i - 1]);
  }
  const avgTimeBetween = timeDiffs.length > 0 
    ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length 
    : 0;

  // Estimate total buy amount (simplified - would need price data)
  const totalBuyAmountUsd = 0; // Placeholder

  // Determine if likely bundled
  const isLikelyBundled = 
    largestClusterSize >= 5 || // 5+ buys in same second
    firstBlockBuyers >= 10 || // 10+ buys in first 30 seconds
    (avgTimeBetween < 2 && buyTxs.length >= 15); // Very fast coordinated buying

  return {
    is_likely_bundled: isLikelyBundled,
    coordinated_wallets: largestClusterSize,
    total_buy_amount_usd: totalBuyAmountUsd,
    first_block_buyers: firstBlockBuyers,
    avg_time_between_buys: avgTimeBetween,
    early_buyers: buyTxs.map(tx => tx.from).filter(Boolean)
  };
}

/**
 * Analyze if early buyers were funded by deployer
 * @param {string} deployerAddress - Token deployer address
 * @param {Array} earlyBuyers - List of early buyer addresses
 * @param {number} creationTime - Token creation timestamp
 * @returns {Promise<Object>} Deployer funding analysis
 */
async function analyzeDeployerFunding(deployerAddress, earlyBuyers, creationTime) {
  try {
    // Get deployer's recent SOL transfers (24 hours before launch)
    const oneDayBefore = creationTime - (24 * 60 * 60);
    
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/transfer?address=${deployerAddress}&limit=100`,
      {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('Solscan transfer API error:', response.status);
      return {
        funded_count: 0,
        total_funding_sol: 0,
        funded_wallets: []
      };
    }

    const data = await response.json();
    const transfers = data.data || [];

    // Filter for SOL transfers to early buyers within 24h before launch
    const fundingTransfers = transfers.filter(tx => {
      return (
        tx.block_time >= oneDayBefore &&
        tx.block_time <= creationTime &&
        tx.from === deployerAddress &&
        earlyBuyers.includes(tx.to)
      );
    });

    const fundedWallets = [...new Set(fundingTransfers.map(tx => tx.to))];
    const totalFundingSol = fundingTransfers.reduce((sum, tx) => 
      sum + (tx.amount || 0) / 1e9, 0
    );

    return {
      funded_count: fundedWallets.length,
      total_funding_sol: totalFundingSol,
      funded_wallets: fundedWallets
    };
  } catch (error) {
    console.error('Deployer funding analysis error:', error.message);
    return {
      funded_count: 0,
      total_funding_sol: 0,
      funded_wallets: []
    };
  }
}

/**
 * Calculate bundle risk score (0-100)
 * @param {Object} bundleAnalysis - Bundle pattern analysis
 * @param {Object} deployerFunding - Deployer funding analysis
 * @returns {number} Risk score
 */
function calculateBundleRiskScore(bundleAnalysis, deployerFunding) {
  let score = 0;

  // Coordinated wallets (30 points)
  if (bundleAnalysis.coordinated_wallets >= 10) score += 30;
  else if (bundleAnalysis.coordinated_wallets >= 5) score += 20;
  else if (bundleAnalysis.coordinated_wallets >= 3) score += 10;

  // First block buyers (25 points)
  if (bundleAnalysis.first_block_buyers >= 15) score += 25;
  else if (bundleAnalysis.first_block_buyers >= 10) score += 18;
  else if (bundleAnalysis.first_block_buyers >= 5) score += 10;

  // Deployer funding (30 points)
  if (deployerFunding.funded_count >= 10) score += 30;
  else if (deployerFunding.funded_count >= 5) score += 20;
  else if (deployerFunding.funded_count >= 3) score += 10;

  // Fast coordinated buying (15 points)
  if (bundleAnalysis.avg_time_between_buys < 1) score += 15;
  else if (bundleAnalysis.avg_time_between_buys < 3) score += 10;
  else if (bundleAnalysis.avg_time_between_buys < 5) score += 5;

  return Math.min(score, 100);
}

/**
 * Generate evidence list for bundle detection
 * @param {Object} bundleAnalysis - Bundle pattern analysis
 * @param {Object} deployerFunding - Deployer funding analysis
 * @returns {Array} Evidence strings
 */
function generateBundleEvidence(bundleAnalysis, deployerFunding) {
  const evidence = [];

  if (bundleAnalysis.coordinated_wallets >= 5) {
    evidence.push(
      `${bundleAnalysis.coordinated_wallets} wallets bought in coordinated cluster`
    );
  }

  if (bundleAnalysis.first_block_buyers >= 10) {
    evidence.push(
      `${bundleAnalysis.first_block_buyers} wallets bought within 30 seconds of launch`
    );
  }

  if (deployerFunding.funded_count > 0) {
    evidence.push(
      `${deployerFunding.funded_count} early buyers funded by deployer (${deployerFunding.total_funding_sol.toFixed(2)} SOL)`
    );
  }

  if (bundleAnalysis.avg_time_between_buys < 2) {
    evidence.push(
      `Average ${bundleAnalysis.avg_time_between_buys.toFixed(1)}s between buys - highly coordinated`
    );
  }

  if (evidence.length === 0) {
    evidence.push('No significant bundling patterns detected');
  }

  return evidence;
}

/**
 * Get bundle details from Jito Bundle Explorer (if available)
 * @param {string} bundleId - Bundle ID
 * @returns {Promise<Object>} Bundle details
 */
export async function getJitoBundleDetails(bundleId) {
  try {
    const response = await fetch(
      `https://explorer.jito.wtf/api/bundles/${bundleId}`,
      {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('Jito API error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        bundle_id: data.bundle_id,
        transactions: data.transactions || [],
        total_transactions: data.transactions?.length || 0,
        timestamp: data.timestamp
      }
    };
  } catch (error) {
    console.error('Jito bundle fetch error:', error.message);
    return null;
  }
}
