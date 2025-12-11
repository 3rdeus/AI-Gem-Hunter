/**
 * Whale Wallet Tracking System
 * Monitors known successful wallets and detects smart money accumulation
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NjIyMTAwNTAwNDUsImVtYWlsIjoiM3JkZXVzQGR1Y2suY29tIiwiYWN0aW9uIjoidG9rZW4tYXBpIiwiYXBpVmVyc2lvbiI6InYyIiwiaWF0IjoxNzYyMjEwMDUwfQ.CsfpKnxw-dwlWrG1U-QylVYNl4yQYFuALnk8ECq-ogA';

let supabase = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

/**
 * Fetch wallet transactions from Solscan API
 */
async function getWalletTransactions(walletAddress, limit = 50) {
  try {
    const response = await fetch(
      `https://pro-api.solscan.io/v2.0/account/transfer?address=${walletAddress}&limit=${limit}&page=1`,
      {
        headers: {
          'token': SOLSCAN_API_KEY,
          'accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[WHALE-TRACKER] Solscan API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[WHALE-TRACKER] Error fetching wallet transactions:', error.message);
    return null;
  }
}

/**
 * Extract token purchases from transactions
 */
function extractTokenPurchases(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const purchases = [];
  const now = Date.now();
  const last24h = now - (24 * 60 * 60 * 1000);

  for (const tx of transactions) {
    // Filter for recent transactions (last 24h)
    const txTime = tx.block_time * 1000;
    if (txTime < last24h) continue;

    // Look for token purchases (incoming SPL token transfers)
    if (tx.token_address && tx.change_amount > 0) {
      purchases.push({
        tokenAddress: tx.token_address,
        amount: tx.change_amount,
        amountUsd: tx.change_amount_usd || 0,
        txHash: tx.trans_id,
        timestamp: new Date(txTime)
      });
    }
  }

  return purchases;
}

/**
 * Track smart money activity for all registered wallets
 */
export async function trackSmartMoneyActivity() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[WHALE-TRACKER] Supabase client not initialized');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('[WHALE-TRACKER] 🐋 Starting smart money tracking...');

    // Get all active smart wallets
    const { data: smartWallets, error: walletsError } = await supabase
      .from('smart_wallets')
      .select('*')
      .eq('is_active', true)
      .order('success_rate', { ascending: false });

    if (walletsError) {
      console.error('[WHALE-TRACKER] Error fetching smart wallets:', walletsError);
      return { success: false, error: walletsError };
    }

    if (!smartWallets || smartWallets.length === 0) {
      console.log('[WHALE-TRACKER] ⚠️ No smart wallets registered yet');
      return { success: true, walletsTracked: 0, signalsDetected: 0 };
    }

    console.log(`[WHALE-TRACKER] 📊 Tracking ${smartWallets.length} smart wallets...`);

    let totalSignals = 0;
    const tokenBuySignals = new Map(); // token -> array of wallet addresses

    // Track each wallet
    for (const wallet of smartWallets) {
      const transactions = await getWalletTransactions(wallet.address);
      if (!transactions) continue;

      const purchases = extractTokenPurchases(transactions);
      
      for (const purchase of purchases) {
        // Record signal in database
        const { error: signalError } = await supabase
          .from('smart_money_signals')
          .insert({
            token_address: purchase.tokenAddress,
            wallet_address: wallet.address,
            signal_type: 'BUY',
            amount_usd: purchase.amountUsd,
            transaction_hash: purchase.txHash,
            detected_at: purchase.timestamp
          });

        if (!signalError) {
          totalSignals++;
          
          // Track for accumulation detection
          if (!tokenBuySignals.has(purchase.tokenAddress)) {
            tokenBuySignals.set(purchase.tokenAddress, []);
          }
          tokenBuySignals.get(purchase.tokenAddress).push(wallet.address);
        }
      }

      // Update last_checked_at
      await supabase
        .from('smart_wallets')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('address', wallet.address);

      // Rate limiting: wait 100ms between wallets
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check for accumulation patterns (3+ smart wallets buying same token)
    const accumulationAlerts = [];
    for (const [tokenAddress, wallets] of tokenBuySignals.entries()) {
      if (wallets.length >= 3) {
        console.log(`[WHALE-TRACKER] 🚨 SMART MONEY ACCUMULATION DETECTED!`);
        console.log(`[WHALE-TRACKER] Token: ${tokenAddress}`);
        console.log(`[WHALE-TRACKER] ${wallets.length} smart wallets bought in last 24h`);
        console.log(`[WHALE-TRACKER] Wallets: ${wallets.join(', ')}`);

        accumulationAlerts.push({
          tokenAddress,
          walletCount: wallets.length,
          wallets
        });

        // Update gem_discoveries if token exists
        await supabase
          .from('gem_discoveries')
          .update({ smart_money_count: wallets.length })
          .eq('token_address', tokenAddress);
      }
    }

    console.log(`[WHALE-TRACKER] ✅ Tracked ${smartWallets.length} wallets`);
    console.log(`[WHALE-TRACKER] 📊 Detected ${totalSignals} buy signals`);
    console.log(`[WHALE-TRACKER] 🎯 Found ${accumulationAlerts.length} accumulation patterns`);

    return {
      success: true,
      walletsTracked: smartWallets.length,
      signalsDetected: totalSignals,
      accumulationAlerts
    };

  } catch (error) {
    console.error('[WHALE-TRACKER] Error in trackSmartMoneyActivity:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get wallet quality metrics
 */
export async function getWalletQualityMetrics(walletAddress) {
  try {
    // Get wallet age (first transaction time)
    const response = await fetch(
      `https://pro-api.solscan.io/v2.0/account/transfer?address=${walletAddress}&limit=1&page=1&sort_by=block_time&sort_order=asc`,
      {
        headers: {
          'token': SOLSCAN_API_KEY,
          'accept': 'application/json'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const firstTx = data.data?.[0];
    
    if (!firstTx) return null;

    const firstTxTime = firstTx.block_time * 1000;
    const now = Date.now();
    const walletAgeDays = Math.floor((now - firstTxTime) / (1000 * 60 * 60 * 24));

    // Get recent activity
    const recentTxs = await getWalletTransactions(walletAddress, 100);
    const monthlyTxCount = recentTxs ? recentTxs.filter(tx => {
      const txTime = tx.block_time * 1000;
      return txTime > (now - (30 * 24 * 60 * 60 * 1000));
    }).length : 0;

    return {
      walletAgeDays,
      monthlyTxCount,
      firstTransactionDate: new Date(firstTxTime)
    };

  } catch (error) {
    console.error('[WHALE-TRACKER] Error getting wallet metrics:', error.message);
    return null;
  }
}

/**
 * Calculate wallet quality score
 */
export function calculateWalletQualityScore(metrics) {
  if (!metrics) return 0;

  const { walletAgeDays, successRate, portfolioValueUsd, monthlyTxCount } = metrics;

  // Wallet Age Score (0-100)
  let ageScore = 0;
  if (walletAgeDays < 7) ageScore = 0;
  else if (walletAgeDays < 30) ageScore = 30;
  else if (walletAgeDays < 90) ageScore = 50;
  else if (walletAgeDays < 365) ageScore = 75;
  else ageScore = 100;

  // Success Rate Score (0-100)
  const successScore = (successRate || 0) * 100;

  // Balance Score (0-100)
  let balanceScore = 0;
  if (portfolioValueUsd < 100) balanceScore = 0;
  else if (portfolioValueUsd < 1000) balanceScore = 20;
  else if (portfolioValueUsd < 10000) balanceScore = 50;
  else if (portfolioValueUsd < 100000) balanceScore = 75;
  else balanceScore = 100;

  // Activity Score (0-100)
  let activityScore = 0;
  if (monthlyTxCount < 5) activityScore = 0;
  else if (monthlyTxCount < 20) activityScore = 30;
  else if (monthlyTxCount < 50) activityScore = 60;
  else if (monthlyTxCount < 100) activityScore = 80;
  else activityScore = 100;

  // Weighted average
  const qualityScore = (
    0.3 * ageScore +
    0.3 * successScore +
    0.2 * balanceScore +
    0.2 * activityScore
  );

  return Math.round(qualityScore);
}

/**
 * Start automated whale tracking (runs every hour)
 */
export function startWhaleTracking() {
  console.log('[WHALE-TRACKER] 🐋 Starting automated whale tracking...');
  
  // Run immediately
  trackSmartMoneyActivity();
  
  // Then run every hour
  const INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(trackSmartMoneyActivity, INTERVAL);
  
  console.log('[WHALE-TRACKER] ✅ Whale tracking scheduled (every 1 hour)');
}
