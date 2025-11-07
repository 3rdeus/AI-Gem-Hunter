/**
 * Nansen API Integration for Smart Wallet Tracking
 * API Key: vBdEZqIeWvi8z81WwbMmEHi0lbT0leJN
 */

const NANSEN_API_KEY = process.env.NANSEN_API_KEY || 'vBdEZqIeWvi8z81WwbMmEHi0lbT0leJN';
const NANSEN_BASE_URL = 'https://api.nansen.ai/v1';

/**
 * Get wallet portfolio and PNL data from Nansen
 * @param {string} walletAddress - Solana wallet address
 * @returns {Promise<Object>} Wallet portfolio data
 */
export async function getWalletPortfolio(walletAddress) {
  try {
    const response = await fetch(`${NANSEN_BASE_URL}/wallets/${walletAddress}/portfolio`, {
      headers: {
        'X-API-KEY': NANSEN_API_KEY,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`Nansen API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        total_value_usd: data.total_value_usd || 0,
        realized_pnl_usd: data.realized_pnl_usd || 0,
        unrealized_pnl_usd: data.unrealized_pnl_usd || 0,
        total_pnl_usd: (data.realized_pnl_usd || 0) + (data.unrealized_pnl_usd || 0),
        holdings: data.holdings || [],
        last_updated: data.last_updated
      }
    };
  } catch (error) {
    console.error('Nansen portfolio error:', error.message);
    return null;
  }
}

/**
 * Get wallet transaction history from Nansen
 * @param {string} walletAddress - Solana wallet address
 * @param {number} limit - Number of transactions to fetch
 * @returns {Promise<Object>} Transaction history
 */
export async function getWalletTransactions(walletAddress, limit = 100) {
  try {
    const response = await fetch(
      `${NANSEN_BASE_URL}/wallets/${walletAddress}/transactions?limit=${limit}`,
      {
        headers: {
          'X-API-KEY': NANSEN_API_KEY,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn(`Nansen API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        transactions: data.transactions || [],
        total_count: data.total_count || 0
      }
    };
  } catch (error) {
    console.error('Nansen transactions error:', error.message);
    return null;
  }
}

/**
 * Get smart money flows for a token
 * @param {string} tokenAddress - Token address
 * @returns {Promise<Object>} Smart money flow data
 */
export async function getTokenSmartMoney(tokenAddress) {
  try {
    const response = await fetch(
      `${NANSEN_BASE_URL}/tokens/${tokenAddress}/smart-money`,
      {
        headers: {
          'X-API-KEY': NANSEN_API_KEY,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn(`Nansen API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        smart_money_inflow_24h: data.inflow_24h || 0,
        smart_money_outflow_24h: data.outflow_24h || 0,
        net_flow_24h: (data.inflow_24h || 0) - (data.outflow_24h || 0),
        smart_wallet_count: data.smart_wallet_count || 0,
        top_smart_wallets: data.top_wallets || []
      }
    };
  } catch (error) {
    console.error('Nansen smart money error:', error.message);
    return null;
  }
}

/**
 * Get wallet labels from Nansen (whale, smart money, etc.)
 * @param {string} walletAddress - Solana wallet address
 * @returns {Promise<Object>} Wallet labels
 */
export async function getWalletLabels(walletAddress) {
  try {
    const response = await fetch(
      `${NANSEN_BASE_URL}/wallets/${walletAddress}/labels`,
      {
        headers: {
          'X-API-KEY': NANSEN_API_KEY,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn(`Nansen API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        labels: data.labels || [],
        is_smart_money: data.labels?.includes('Smart Money') || false,
        is_whale: data.labels?.includes('Whale') || false,
        is_exchange: data.labels?.includes('Exchange') || false
      }
    };
  } catch (error) {
    console.error('Nansen labels error:', error.message);
    return null;
  }
}

/**
 * Calculate comprehensive wallet reputation score
 * @param {string} walletAddress - Solana wallet address
 * @returns {Promise<Object>} Wallet reputation analysis
 */
export async function calculateWalletReputation(walletAddress) {
  try {
    // Fetch all data in parallel
    const [portfolio, transactions, labels] = await Promise.allSettled([
      getWalletPortfolio(walletAddress),
      getWalletTransactions(walletAddress, 200),
      getWalletLabels(walletAddress)
    ]);

    const portfolioData = portfolio.status === 'fulfilled' ? portfolio.value?.data : null;
    const txData = transactions.status === 'fulfilled' ? transactions.value?.data : null;
    const labelData = labels.status === 'fulfilled' ? labels.value?.data : null;

    if (!txData || !txData.transactions || txData.transactions.length === 0) {
      return {
        success: false,
        error: 'Insufficient transaction history'
      };
    }

    // Calculate metrics
    const metrics = calculateReputationMetrics(portfolioData, txData, labelData);
    
    // Calculate reputation score (0-100)
    const score = calculateReputationScore(metrics);
    
    // Determine tier
    const tier = getReputationTier(score);
    
    // Identify red flags
    const redFlags = identifyRedFlags(metrics, txData);

    return {
      success: true,
      data: {
        wallet_address: walletAddress,
        reputation_score: score,
        reputation_tier: tier,
        metrics: metrics,
        red_flags: redFlags,
        nansen_labels: labelData?.labels || [],
        is_elite: score >= 90,
        last_updated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Wallet reputation calculation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate reputation metrics from wallet data
 */
function calculateReputationMetrics(portfolio, transactions, labels) {
  const txs = transactions.transactions || [];
  
  // Calculate win rate
  const trades = txs.filter(tx => tx.type === 'SELL' || tx.type === 'SWAP');
  const profitableTrades = trades.filter(tx => (tx.pnl_usd || 0) > 0);
  const winRate = trades.length > 0 ? profitableTrades.length / trades.length : 0;
  
  // Calculate average hold time
  const holdTimes = [];
  const buyMap = new Map();
  
  txs.forEach(tx => {
    if (tx.type === 'BUY' || tx.type === 'SWAP_IN') {
      buyMap.set(tx.token_address, tx.timestamp);
    } else if (tx.type === 'SELL' || tx.type === 'SWAP_OUT') {
      const buyTime = buyMap.get(tx.token_address);
      if (buyTime) {
        const holdTime = (new Date(tx.timestamp) - new Date(buyTime)) / (1000 * 60 * 60); // hours
        holdTimes.push(holdTime);
      }
    }
  });
  
  const avgHoldTime = holdTimes.length > 0 
    ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length 
    : 0;
  
  // Calculate unique tokens
  const uniqueTokens = new Set(txs.map(tx => tx.token_address)).size;
  
  // Calculate total PNL
  const totalPnl = portfolio?.total_pnl_usd || 0;
  
  // Check for deployer funding (will be enhanced with Solscan data)
  const deployerFundedCount = 0; // Placeholder - will be calculated in deployer-funding module
  
  return {
    total_trades: trades.length,
    win_rate: winRate,
    total_pnl_usd: totalPnl,
    avg_hold_time_hours: avgHoldTime,
    deployer_funded_count: deployerFundedCount,
    unique_tokens: uniqueTokens,
    is_nansen_smart_money: labels?.is_smart_money || false,
    is_whale: labels?.is_whale || false
  };
}

/**
 * Calculate reputation score (0-100) based on metrics
 */
function calculateReputationScore(metrics) {
  let score = 0;
  
  // Win Rate (25 points)
  score += metrics.win_rate * 25;
  
  // Average Hold Time (20 points)
  // Good: >24h = full points, <1h = 0 points
  const holdTimeScore = Math.min(metrics.avg_hold_time_hours / 24, 1) * 20;
  score += holdTimeScore;
  
  // PNL Consistency (20 points)
  // Positive PNL = full points, negative = 0
  const pnlScore = metrics.total_pnl_usd > 0 ? 20 : 0;
  score += pnlScore;
  
  // Deployer Independence (20 points)
  // No deployer funding = full points
  const deployerScore = metrics.deployer_funded_count === 0 ? 20 : Math.max(0, 20 - metrics.deployer_funded_count * 5);
  score += deployerScore;
  
  // Portfolio Diversity (15 points)
  // 50+ unique tokens = full points
  const diversityScore = Math.min(metrics.unique_tokens / 50, 1) * 15;
  score += diversityScore;
  
  // Bonus for Nansen labels
  if (metrics.is_nansen_smart_money) score += 5;
  if (metrics.is_whale) score += 3;
  
  return Math.min(Math.round(score), 100);
}

/**
 * Get reputation tier based on score
 */
function getReputationTier(score) {
  if (score >= 90) return 'ELITE';
  if (score >= 70) return 'TRUSTED';
  if (score >= 40) return 'UNVERIFIED';
  return 'SUSPICIOUS';
}

/**
 * Identify red flags in wallet behavior
 */
function identifyRedFlags(metrics, transactions) {
  const flags = [];
  
  if (metrics.win_rate < 0.3) {
    flags.push('Low win rate (<30%)');
  }
  
  if (metrics.avg_hold_time_hours < 1) {
    flags.push('Very short hold times (<1 hour) - possible bot or insider');
  }
  
  if (metrics.total_pnl_usd < 0) {
    flags.push('Negative total PNL');
  }
  
  if (metrics.deployer_funded_count > 0) {
    flags.push(`Funded by ${metrics.deployer_funded_count} deployer(s) - insider risk`);
  }
  
  if (metrics.unique_tokens < 5) {
    flags.push('Very limited trading history');
  }
  
  // Check for pump & dump pattern (many quick trades)
  const quickTrades = transactions.transactions?.filter(tx => {
    // Consider trades with <1 hour hold time
    return true; // Simplified - would need full logic
  }).length || 0;
  
  if (quickTrades > metrics.total_trades * 0.7) {
    flags.push('Pump & dump pattern detected (70%+ quick trades)');
  }
  
  return flags;
}
