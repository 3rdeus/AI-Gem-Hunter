/**
 * Smart Wallet Index & Second-Wave Accumulation Detector
 * Tracks elite wallets and detects re-accumulation patterns (high-conviction signals)
 */

import { calculateWalletReputation } from './nansen-api.js';

/**
 * Elite wallet index (curated list of proven profitable wallets)
 * These are wallets with:
 * - Reputation score 90+
 * - 100+ successful trades
 * - No deployer funding history
 * - Average hold time > 48 hours
 */
const ELITE_WALLET_INDEX = [
  // Placeholder - would be populated from database or Nansen
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  // Add more elite wallets...
];

/**
 * Detect smart wallet quorum (multiple elite wallets buying same token)
 * @param {string} tokenAddress - Token address
 * @returns {Promise<Object>} Quorum detection results
 */
export async function detectSmartWalletQuorum(tokenAddress) {
  try {
    console.log(`Detecting smart wallet quorum for: ${tokenAddress}`);

    // Get current holders
    const holders = await getTokenHolders(tokenAddress);
    
    if (!holders || holders.length === 0) {
      return {
        success: true,
        quorum_met: false,
        elite_wallets_buying: 0,
        message: 'No holder data available'
      };
    }

    // Check which elite wallets are holding
    const eliteHolders = [];
    
    for (const wallet of ELITE_WALLET_INDEX) {
      const holder = holders.find(h => h.address === wallet);
      
      if (holder) {
        // Get wallet reputation to confirm elite status
        const reputation = await calculateWalletReputation(wallet);
        
        if (reputation?.success && reputation.data.reputation_score >= 90) {
          eliteHolders.push({
            wallet: wallet,
            reputation: reputation.data.reputation_score,
            amount_held: holder.amount,
            percentage: holder.percentage,
            buy_time: holder.first_buy_time || null
          });
        }
      }
    }

    // Check if quorum is met (3+ elite wallets)
    const quorumMet = eliteHolders.length >= 3;

    // Calculate total invested (estimate)
    const totalInvested = eliteHolders.reduce((sum, h) => 
      sum + (h.amount_held * 0.0001), // Placeholder price
      0
    );

    // Calculate average reputation
    const avgReputation = eliteHolders.length > 0
      ? eliteHolders.reduce((sum, h) => sum + h.reputation, 0) / eliteHolders.length
      : 0;

    // Determine signal strength
    let signal = 'NEUTRAL';
    if (eliteHolders.length >= 5) signal = 'STRONG_BUY';
    else if (eliteHolders.length >= 3) signal = 'BUY';
    else if (eliteHolders.length >= 1) signal = 'WATCH';

    return {
      success: true,
      quorum_met: quorumMet,
      elite_wallets_buying: eliteHolders.length,
      total_invested_usd: totalInvested,
      avg_wallet_reputation: Math.round(avgReputation),
      signal: signal,
      wallets: eliteHolders,
      analysis: generateQuorumAnalysis(eliteHolders, quorumMet)
    };
  } catch (error) {
    console.error('Smart wallet quorum detection error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Detect second-wave accumulation (smart wallets re-entering after dump)
 * @param {string} tokenAddress - Token address
 * @returns {Promise<Object>} Second-wave detection results
 */
export async function detectSecondWaveAccumulation(tokenAddress) {
  try {
    console.log(`Detecting second-wave accumulation for: ${tokenAddress}`);

    // Get token price history
    const priceHistory = await getTokenPriceHistory(tokenAddress);
    
    if (!priceHistory || priceHistory.length < 2) {
      return {
        success: true,
        second_wave_detected: false,
        message: 'Insufficient price history'
      };
    }

    // Identify peak price and subsequent dump
    const peak = Math.max(...priceHistory.map(p => p.price));
    const current = priceHistory[priceHistory.length - 1].price;
    const dropFromPeak = (peak - current) / peak;

    // Only look for second-wave if there was a significant dump (>30%)
    if (dropFromPeak < 0.3) {
      return {
        success: true,
        second_wave_detected: false,
        message: 'No significant dump detected'
      };
    }

    // Get recent transactions to find re-accumulation
    const recentTxs = await getRecentTransactions(tokenAddress, 24); // Last 24 hours
    
    // Filter for smart wallet buys
    const smartWalletBuys = [];
    
    for (const tx of recentTxs) {
      if (tx.type === 'BUY') {
        // Check if buyer is a smart wallet
        const reputation = await calculateWalletReputation(tx.buyer);
        
        if (reputation?.success && reputation.data.reputation_score >= 70) {
          // Check if this wallet previously sold
          const previousSell = await checkPreviousSell(tx.buyer, tokenAddress);
          
          if (previousSell) {
            smartWalletBuys.push({
              wallet: tx.buyer,
              reputation_score: reputation.data.reputation_score,
              first_buy: previousSell.first_buy,
              first_sell: previousSell.sell,
              re_accumulation: {
                timestamp: tx.timestamp,
                amount_usd: tx.amount_usd,
                price: current,
                price_drop_from_peak: dropFromPeak
              },
              signal_strength: calculateSignalStrength(
                reputation.data.reputation_score,
                dropFromPeak,
                tx.amount_usd
              )
            });
          }
        }
      }
    }

    // Determine if second-wave is happening
    const secondWaveDetected = smartWalletBuys.length >= 3;
    
    // Calculate total re-invested
    const totalReInvested = smartWalletBuys.reduce((sum, w) => 
      sum + w.re_accumulation.amount_usd, 0
    );

    // Calculate bullish confidence
    const bullishConfidence = calculateBullishConfidence(
      smartWalletBuys.length,
      totalReInvested,
      dropFromPeak
    );

    return {
      success: true,
      second_wave_detected: secondWaveDetected,
      second_wave_wallets: smartWalletBuys,
      total_smart_wallets_accumulating: smartWalletBuys.length,
      total_re_invested_usd: totalReInvested,
      price_drop_from_peak: dropFromPeak,
      bullish_confidence: bullishConfidence,
      analysis: generateSecondWaveAnalysis(smartWalletBuys, dropFromPeak)
    };
  } catch (error) {
    console.error('Second-wave detection error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get token holders
 */
async function getTokenHolders(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solscan.io/token/holders?token=${tokenAddress}&limit=100`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Token holders fetch error:', error.message);
    return [];
  }
}

/**
 * Get token price history (simplified - would use Birdeye or Jupiter)
 */
async function getTokenPriceHistory(tokenAddress) {
  // Placeholder - would integrate with Birdeye price history API
  return [
    { timestamp: Date.now() - 86400000, price: 0.0001 },
    { timestamp: Date.now() - 43200000, price: 0.0003 }, // Peak
    { timestamp: Date.now() - 21600000, price: 0.0002 },
    { timestamp: Date.now(), price: 0.00015 } // Current (50% drop)
  ];
}

/**
 * Get recent transactions for a token
 */
async function getRecentTransactions(tokenAddress, hoursBack) {
  try {
    const response = await fetch(
      `https://api.solscan.io/account/transactions?address=${tokenAddress}&limit=100`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const cutoffTime = Date.now() / 1000 - (hoursBack * 3600);
    
    return (data.data || [])
      .filter(tx => tx.block_time >= cutoffTime)
      .map(tx => ({
        type: tx.type,
        buyer: tx.to,
        timestamp: new Date(tx.block_time * 1000).toISOString(),
        amount_usd: 0 // Would calculate from amount and price
      }));
  } catch (error) {
    console.error('Recent transactions fetch error:', error.message);
    return [];
  }
}

/**
 * Check if wallet previously sold this token
 */
async function checkPreviousSell(walletAddress, tokenAddress) {
  // Placeholder - would query transaction history
  // Returns null if no previous sell found
  return {
    first_buy: {
      timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      amount_usd: 10000,
      price: 0.0001
    },
    sell: {
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      amount_usd: 15000,
      pnl_usd: 5000
    }
  };
}

/**
 * Calculate signal strength for second-wave buy
 */
function calculateSignalStrength(reputationScore, dropFromPeak, amountUsd) {
  let strength = 0;

  // Reputation (40 points)
  strength += (reputationScore / 100) * 40;

  // Drop from peak (30 points)
  // Bigger drop = stronger signal (buying the dip)
  strength += Math.min(dropFromPeak * 60, 30);

  // Investment size (30 points)
  if (amountUsd >= 10000) strength += 30;
  else if (amountUsd >= 5000) strength += 20;
  else if (amountUsd >= 1000) strength += 10;

  const score = Math.min(strength, 100);

  if (score >= 80) return 'VERY_HIGH';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate bullish confidence for second-wave
 */
function calculateBullishConfidence(walletCount, totalInvested, dropFromPeak) {
  let confidence = 0;

  // Number of smart wallets (50%)
  confidence += Math.min(walletCount / 10, 1) * 0.5;

  // Total capital deployed (30%)
  confidence += Math.min(totalInvested / 100000, 1) * 0.3;

  // Drop from peak (20%)
  // Bigger drop = higher conviction when buying
  confidence += Math.min(dropFromPeak / 0.7, 1) * 0.2;

  return Math.min(confidence, 1);
}

/**
 * Generate quorum analysis text
 */
function generateQuorumAnalysis(eliteHolders, quorumMet) {
  if (!quorumMet) {
    return `Only ${eliteHolders.length} elite wallet(s) holding - quorum not met (need 3+)`;
  }

  const avgRep = eliteHolders.reduce((sum, h) => sum + h.reputation, 0) / eliteHolders.length;
  
  let analysis = `✅ SMART MONEY QUORUM MET\n\n`;
  analysis += `${eliteHolders.length} elite wallets (avg reputation: ${avgRep.toFixed(0)}/100) are holding this token.\n\n`;
  analysis += `This indicates strong conviction from proven profitable traders.\n\n`;
  analysis += `Top Elite Holders:\n`;
  
  eliteHolders.slice(0, 3).forEach((h, i) => {
    analysis += `${i + 1}. ${h.wallet.substring(0, 8)}... - Rep: ${h.reputation}/100, ${h.percentage?.toFixed(2)}% of supply\n`;
  });

  return analysis;
}

/**
 * Generate second-wave analysis text
 */
function generateSecondWaveAnalysis(smartWalletBuys, dropFromPeak) {
  if (smartWalletBuys.length === 0) {
    return 'No second-wave accumulation detected';
  }

  let analysis = `📊 SECOND-WAVE ACCUMULATION DETECTED\n\n`;
  analysis += `${smartWalletBuys.length} smart wallets are re-entering after ${(dropFromPeak * 100).toFixed(1)}% drop from peak.\n\n`;
  analysis += `This suggests high-conviction buying - these wallets:\n`;
  analysis += `• Previously took profits\n`;
  analysis += `• Are now re-accumulating at lower prices\n`;
  analysis += `• Have proven track records (avg reputation: ${(smartWalletBuys.reduce((sum, w) => sum + w.reputation_score, 0) / smartWalletBuys.length).toFixed(0)}/100)\n\n`;
  
  analysis += `Top Re-Accumulators:\n`;
  smartWalletBuys.slice(0, 3).forEach((w, i) => {
    analysis += `${i + 1}. ${w.wallet.substring(0, 8)}... - Rep: ${w.reputation_score}/100, `;
    analysis += `Signal: ${w.signal_strength}\n`;
  });

  return analysis;
}

/**
 * Get smart wallet activity summary for a token
 */
export async function getSmartWalletActivity(tokenAddress) {
  try {
    const [quorum, secondWave] = await Promise.allSettled([
      detectSmartWalletQuorum(tokenAddress),
      detectSecondWaveAccumulation(tokenAddress)
    ]);

    const quorumData = quorum.status === 'fulfilled' ? quorum.value : null;
    const secondWaveData = secondWave.status === 'fulfilled' ? secondWave.value : null;

    return {
      success: true,
      quorum: quorumData,
      second_wave: secondWaveData,
      overall_signal: determineOverallSignal(quorumData, secondWaveData)
    };
  } catch (error) {
    console.error('Smart wallet activity error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Determine overall signal from quorum and second-wave data
 */
function determineOverallSignal(quorum, secondWave) {
  const signals = [];

  if (quorum?.quorum_met) {
    signals.push({
      type: 'QUORUM',
      strength: quorum.signal,
      description: `${quorum.elite_wallets_buying} elite wallets holding`
    });
  }

  if (secondWave?.second_wave_detected) {
    signals.push({
      type: 'SECOND_WAVE',
      strength: secondWave.bullish_confidence > 0.7 ? 'STRONG' : 'MODERATE',
      description: `${secondWave.total_smart_wallets_accumulating} smart wallets re-accumulating`
    });
  }

  if (signals.length === 0) {
    return {
      overall: 'NEUTRAL',
      signals: [],
      recommendation: 'No significant smart wallet activity detected'
    };
  }

  // Both signals present = very bullish
  if (signals.length === 2) {
    return {
      overall: 'VERY_BULLISH',
      signals: signals,
      recommendation: 'Strong buy signal - both quorum and second-wave accumulation detected'
    };
  }

  // One signal = moderately bullish
  return {
    overall: 'BULLISH',
    signals: signals,
    recommendation: signals[0].description
  };
}
