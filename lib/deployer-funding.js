/**
 * Deployer Funding Analysis Module
 * Tracks money flow from deployer to early buyers (insider detection)
 * Key insight: Legitimate projects don't fund early buyers
 */

const SOLSCAN_BASE_URL = 'https://api.solscan.io';

/**
 * Analyze deployer funding patterns for a token
 * @param {string} tokenAddress - Token address
 * @returns {Promise<Object>} Deployer funding analysis
 */
export async function analyzeDeployerFunding(tokenAddress) {
  try {
    console.log(`Analyzing deployer funding for: ${tokenAddress}`);

    // Step 1: Get token metadata to find deployer
    const tokenMeta = await getTokenMetadata(tokenAddress);
    if (!tokenMeta?.deployer_address) {
      return {
        success: false,
        error: 'Could not identify deployer address'
      };
    }

    const deployerAddress = tokenMeta.deployer_address;
    const creationTime = tokenMeta.creation_time;

    // Step 2: Get early token buyers (first 100 holders)
    const earlyBuyers = await getEarlyBuyers(tokenAddress, creationTime);
    
    if (earlyBuyers.length === 0) {
      return {
        success: true,
        deployer_address: deployerAddress,
        funded_wallets: [],
        total_funded: 0,
        total_funding_sol: 0,
        insider_confidence: 0,
        analysis: 'No early buyers found'
      };
    }

    // Step 3: Get deployer's SOL transfers (48 hours before launch)
    const deployerTransfers = await getDeployerTransfers(
      deployerAddress,
      creationTime - (48 * 60 * 60), // 48 hours before
      creationTime
    );

    // Step 4: Match deployer transfers to early buyers
    const fundedWallets = matchDeployerFunding(
      deployerTransfers,
      earlyBuyers,
      creationTime
    );

    // Step 5: Calculate insider confidence score
    const insiderConfidence = calculateInsiderConfidence(
      fundedWallets,
      earlyBuyers.length
    );

    // Step 6: Generate detailed analysis
    const analysis = generateFundingAnalysis(fundedWallets, earlyBuyers);

    return {
      success: true,
      deployer_address: deployerAddress,
      funded_wallets: fundedWallets,
      total_funded: fundedWallets.length,
      total_funding_sol: fundedWallets.reduce((sum, w) => sum + w.funded_amount_sol, 0),
      insider_confidence: insiderConfidence,
      analysis: analysis,
      early_buyers_count: earlyBuyers.length,
      funded_percentage: (fundedWallets.length / earlyBuyers.length) * 100
    };
  } catch (error) {
    console.error('Deployer funding analysis error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get token metadata including deployer address
 */
async function getTokenMetadata(tokenAddress) {
  try {
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/token/meta?token=${tokenAddress}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      deployer_address: data.data?.creator || data.data?.owner,
      creation_time: data.data?.created_time || Math.floor(Date.now() / 1000)
    };
  } catch (error) {
    console.error('Token metadata fetch error:', error.message);
    return null;
  }
}

/**
 * Get early buyers of a token (first 100 holders)
 */
async function getEarlyBuyers(tokenAddress, creationTime) {
  try {
    // Get token holders
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/token/holders?token=${tokenAddress}&limit=100&offset=0`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const holders = data.data || [];

    // Get transaction history for each holder to find buy time
    const earlyBuyers = [];
    
    for (const holder of holders.slice(0, 50)) { // Limit to top 50 for performance
      const buyTime = await getFirstBuyTime(holder.address, tokenAddress, creationTime);
      
      if (buyTime && buyTime <= creationTime + (5 * 60)) { // Within 5 minutes of launch
        earlyBuyers.push({
          address: holder.address,
          amount: holder.amount,
          buy_time: buyTime
        });
      }
    }

    return earlyBuyers;
  } catch (error) {
    console.error('Early buyers fetch error:', error.message);
    return [];
  }
}

/**
 * Get first buy time for a wallet
 */
async function getFirstBuyTime(walletAddress, tokenAddress, creationTime) {
  try {
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/token/txs?address=${walletAddress}&token=${tokenAddress}&limit=10`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const txs = data.data || [];

    // Find first buy transaction
    const buyTx = txs
      .filter(tx => tx.type === 'BUY' || tx.type === 'SWAP' || tx.change_amount > 0)
      .sort((a, b) => a.block_time - b.block_time)[0];

    return buyTx?.block_time || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get deployer's SOL transfers in a time window
 */
async function getDeployerTransfers(deployerAddress, startTime, endTime) {
  try {
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/transfer?address=${deployerAddress}&limit=200`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const transfers = data.data || [];

    // Filter for SOL transfers from deployer within time window
    return transfers.filter(tx => 
      tx.from === deployerAddress &&
      tx.block_time >= startTime &&
      tx.block_time <= endTime &&
      tx.token_symbol === 'SOL'
    );
  } catch (error) {
    console.error('Deployer transfers fetch error:', error.message);
    return [];
  }
}

/**
 * Match deployer transfers to early buyers
 */
function matchDeployerFunding(deployerTransfers, earlyBuyers, creationTime) {
  const fundedWallets = [];

  for (const buyer of earlyBuyers) {
    // Find transfers from deployer to this buyer
    const funding = deployerTransfers.find(tx => tx.to === buyer.address);
    
    if (funding) {
      const timeBetweenHours = (buyer.buy_time - funding.block_time) / 3600;
      
      fundedWallets.push({
        wallet: buyer.address,
        funded_amount_sol: funding.amount / 1e9,
        funded_at: new Date(funding.block_time * 1000).toISOString(),
        bought_token_at: new Date(buyer.buy_time * 1000).toISOString(),
        time_between_hours: timeBetweenHours,
        buy_amount_tokens: buyer.amount,
        still_holding: true, // Would need to check current balance
        suspicious_score: calculateSuspiciousScore(timeBetweenHours, funding.amount / 1e9)
      });
    }
  }

  return fundedWallets.sort((a, b) => b.suspicious_score - a.suspicious_score);
}

/**
 * Calculate suspicious score for a funded wallet
 */
function calculateSuspiciousScore(timeBetweenHours, fundingAmountSol) {
  let score = 0;

  // Time proximity (max 40 points)
  if (timeBetweenHours < 1) score += 40;
  else if (timeBetweenHours < 6) score += 30;
  else if (timeBetweenHours < 24) score += 20;
  else score += 10;

  // Funding amount (max 30 points)
  if (fundingAmountSol >= 10) score += 30;
  else if (fundingAmountSol >= 5) score += 20;
  else if (fundingAmountSol >= 1) score += 10;

  // Pattern bonus (30 points)
  // If funded shortly before launch and bought immediately = insider
  if (timeBetweenHours < 2 && fundingAmountSol >= 3) {
    score += 30;
  }

  return Math.min(score, 100);
}

/**
 * Calculate overall insider confidence (0-1)
 */
function calculateInsiderConfidence(fundedWallets, totalEarlyBuyers) {
  if (fundedWallets.length === 0) return 0;

  const fundedPercentage = fundedWallets.length / totalEarlyBuyers;
  const avgSuspiciousScore = fundedWallets.reduce((sum, w) => sum + w.suspicious_score, 0) / fundedWallets.length;

  // Confidence based on:
  // 1. Percentage of early buyers funded (50%)
  // 2. Average suspicious score (50%)
  const confidence = (fundedPercentage * 0.5) + (avgSuspiciousScore / 100 * 0.5);

  return Math.min(confidence, 1);
}

/**
 * Generate human-readable funding analysis
 */
function generateFundingAnalysis(fundedWallets, earlyBuyers) {
  if (fundedWallets.length === 0) {
    return 'No evidence of deployer funding early buyers - good sign';
  }

  const fundedPercentage = (fundedWallets.length / earlyBuyers.length * 100).toFixed(1);
  const totalFunding = fundedWallets.reduce((sum, w) => sum + w.funded_amount_sol, 0).toFixed(2);
  const highlysuspicious = fundedWallets.filter(w => w.suspicious_score >= 70).length;

  let analysis = `🚨 INSIDER TRADING DETECTED:\n\n`;
  analysis += `• ${fundedWallets.length} of ${earlyBuyers.length} early buyers (${fundedPercentage}%) funded by deployer\n`;
  analysis += `• Total funding: ${totalFunding} SOL\n`;
  analysis += `• ${highlysuspicious} wallets with highly suspicious patterns\n\n`;

  analysis += `Top Suspicious Wallets:\n`;
  fundedWallets.slice(0, 3).forEach((w, i) => {
    analysis += `${i + 1}. ${w.wallet.substring(0, 8)}... - ${w.funded_amount_sol.toFixed(2)} SOL, `;
    analysis += `${w.time_between_hours.toFixed(1)}h before buy (Score: ${w.suspicious_score}/100)\n`;
  });

  return analysis;
}

/**
 * Get detailed funding timeline for a specific wallet
 */
export async function getWalletFundingTimeline(walletAddress, tokenAddress) {
  try {
    // Get all SOL transfers to this wallet
    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/transfer?address=${walletAddress}&limit=50`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const transfers = data.data || [];

    // Filter for incoming SOL transfers
    const incomingTransfers = transfers
      .filter(tx => tx.to === walletAddress && tx.token_symbol === 'SOL')
      .map(tx => ({
        from: tx.from,
        amount_sol: tx.amount / 1e9,
        timestamp: new Date(tx.block_time * 1000).toISOString(),
        tx_hash: tx.tx_hash
      }));

    return {
      success: true,
      wallet: walletAddress,
      incoming_transfers: incomingTransfers,
      total_received_sol: incomingTransfers.reduce((sum, tx) => sum + tx.amount_sol, 0)
    };
  } catch (error) {
    console.error('Wallet funding timeline error:', error.message);
    return null;
  }
}
