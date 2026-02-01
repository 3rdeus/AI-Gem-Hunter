/**
 * Velocity Gate - Munger/Musk Entry System
 * 
 * Philosophy: Don't pick "good" tokens. Filter out rugs, then bet on velocity.
 * 
 * Binary Safety Gate → Velocity Score → Small bets, fast exits
 */

import { getComprehensiveSecurityAnalysis } from './goplus.js';
import { checkLiquidity } from './liquidity-checker.mjs';

/**
 * BINARY SAFETY CHECKS - Must ALL pass or we don't touch it
 * These are rug filters, not quality indicators
 */
const SAFETY_GATE = {
  // Minimum liquidity to be tradeable (lowered to catch more early tokens)
  MIN_LIQUIDITY_USD: 100,
  
  // Contract must be safe
  REQUIRE_MINT_REVOKED: true,
  REQUIRE_FREEZE_REVOKED: true,
  
  // Must be sellable
  MAX_SELL_TAX: 15,
  BLOCK_HONEYPOTS: true,
};

/**
 * VELOCITY SCORING - What we actually bet on
 * Freshness + buy pressure = opportunity
 */
const VELOCITY_WEIGHTS = {
  freshness: 0.35,      // Newer is BETTER (opposite of old system)
  buyPressure: 0.30,    // More buys than sells
  liquidityGrowth: 0.20, // LP growing = confidence
  earlyWallets: 0.15,   // Quality of first buyers
};

/**
 * Trade sizing based on conviction
 */
const POSITION_TIERS = {
  SNIPE: {
    velocityMin: 70,
    size: 0.1,        // SOL
    takeProfit: [2, 3], // 2x sell half, 3x sell rest
    stopLoss: -40,
    maxHoldMins: 30
  },
  SCOUT: {
    velocityMin: 50,
    size: 0.05,
    takeProfit: [2, 5],
    stopLoss: -50,
    maxHoldMins: 60
  },
  WATCH: {
    velocityMin: 30,
    size: 0,          // Paper trade only
    takeProfit: [3, 10],
    stopLoss: -70,
    maxHoldMins: 120
  }
};

/**
 * Run the binary safety gate
 * Returns: { passed: boolean, reason: string, checks: object }
 * @param {string} tokenAddress - Token address
 * @param {number} prefetchedLiquidity - Pre-fetched liquidity from discovery (optional)
 */
export async function runSafetyGate(tokenAddress, prefetchedLiquidity = null) {
  console.log(`\n[SAFETY-GATE] ════════════════════════════════════`);
  console.log(`[SAFETY-GATE] 🛡️ Checking: ${tokenAddress.slice(0,8)}...`);
  
  const checks = {
    liquidity: { passed: false, value: null },
    mintRevoked: { passed: false, value: null },
    freezeRevoked: { passed: false, value: null },
    sellable: { passed: false, value: null },
    sellTax: { passed: false, value: null },
  };
  
  let failReason = null;
  
  try {
    // CHECK 1: Minimum liquidity (functional requirement)
    // Use pre-fetched liquidity if available (from Helius), otherwise call Birdeye
    let liquidityUSD = prefetchedLiquidity;
    
    if (liquidityUSD === null || liquidityUSD === undefined) {
      const liqData = await checkLiquidity(tokenAddress, SAFETY_GATE.MIN_LIQUIDITY_USD);
      liquidityUSD = liqData?.liquidity || 0;
      if (liqData?.error) {
        // Fail-open on API errors
        checks.liquidity.passed = true;
        checks.liquidity.value = 'unknown (proceeding)';
        console.log(`[SAFETY-GATE] Liquidity check error: ${liqData.error} - proceeding anyway`);
      }
    }
    
    if (checks.liquidity.value !== 'unknown (proceeding)') {
      checks.liquidity.value = liquidityUSD;
      // Fail-open when Birdeye returns 0 (token too new for indexing)
      if (liquidityUSD === 0 && prefetchedLiquidity === null) {
        checks.liquidity.passed = true;
        checks.liquidity.value = 'unknown/new (proceeding)';
        console.log(`[SAFETY-GATE] Birdeye returned 0 liquidity (likely too new) - proceeding anyway`);
      } else {
        checks.liquidity.passed = liquidityUSD >= SAFETY_GATE.MIN_LIQUIDITY_USD;
        if (!checks.liquidity.passed) {
          failReason = `Liquidity $${liquidityUSD.toFixed(0)} < $${SAFETY_GATE.MIN_LIQUIDITY_USD}`;
        }
      }
    }
    console.log(`[SAFETY-GATE] Liquidity: $${checks.liquidity.value?.toFixed(0) || '?'} ${checks.liquidity.passed ? '✅' : '❌'}`);
    
    if (failReason) {
      return { passed: false, reason: failReason, checks };
    }
    
    // CHECK 2-5: Contract security
    const security = await getComprehensiveSecurityAnalysis(tokenAddress);
    
    if (security?.success && security.security) {
      const sec = security.security;
      
      // Mint authority
      const mintRevoked = !sec.mint_authority?.has_authority;
      checks.mintRevoked.value = mintRevoked;
      checks.mintRevoked.passed = mintRevoked || !SAFETY_GATE.REQUIRE_MINT_REVOKED;
      if (!checks.mintRevoked.passed) {
        failReason = 'MINT AUTHORITY ACTIVE - dev can print tokens';
      }
      console.log(`[SAFETY-GATE] Mint Revoked: ${mintRevoked ? 'YES' : 'NO'} ${checks.mintRevoked.passed ? '✅' : '❌'}`);
      
      // Freeze authority
      const freezeRevoked = !sec.freeze_authority?.has_authority;
      checks.freezeRevoked.value = freezeRevoked;
      checks.freezeRevoked.passed = freezeRevoked || !SAFETY_GATE.REQUIRE_FREEZE_REVOKED;
      if (!failReason && !checks.freezeRevoked.passed) {
        failReason = 'FREEZE AUTHORITY ACTIVE - dev can freeze your tokens';
      }
      console.log(`[SAFETY-GATE] Freeze Revoked: ${freezeRevoked ? 'YES' : 'NO'} ${checks.freezeRevoked.passed ? '✅' : '❌'}`);
      
      // Honeypot
      const honeypot = security.honeypot;
      if (honeypot) {
        checks.sellable.value = !honeypot.is_honeypot;
        checks.sellable.passed = !honeypot.is_honeypot || !SAFETY_GATE.BLOCK_HONEYPOTS;
        if (!failReason && !checks.sellable.passed) {
          failReason = 'HONEYPOT - cannot sell';
        }
        console.log(`[SAFETY-GATE] Sellable: ${!honeypot.is_honeypot ? 'YES' : 'NO'} ${checks.sellable.passed ? '✅' : '❌'}`);
      } else {
        checks.sellable.passed = true; // Can't verify, proceed
        checks.sellable.value = 'unknown';
      }
      
      // Sell tax
      const sellTax = parseFloat(security.raw_data?.sell_tax || 0) * 100;
      checks.sellTax.value = sellTax;
      checks.sellTax.passed = sellTax <= SAFETY_GATE.MAX_SELL_TAX;
      if (!failReason && !checks.sellTax.passed) {
        failReason = `Sell tax ${sellTax}% > ${SAFETY_GATE.MAX_SELL_TAX}%`;
      }
      console.log(`[SAFETY-GATE] Sell Tax: ${sellTax}% ${checks.sellTax.passed ? '✅' : '❌'}`);
      
    } else {
      // Security check failed - BLOCK by default (Munger: avoid losses)
      failReason = 'Could not verify contract security';
      console.log(`[SAFETY-GATE] Security Check: FAILED ❌`);
    }
    
    const allPassed = !failReason;
    console.log(`[SAFETY-GATE] VERDICT: ${allPassed ? '✅ SAFE TO TRADE' : '❌ BLOCKED'}`);
    if (failReason) console.log(`[SAFETY-GATE] Reason: ${failReason}`);
    console.log(`[SAFETY-GATE] ════════════════════════════════════\n`);
    
    return { passed: allPassed, reason: failReason || 'All safety checks passed', checks };
    
  } catch (error) {
    console.error(`[SAFETY-GATE] Error: ${error.message}`);
    return { passed: false, reason: `Gate error: ${error.message}`, checks };
  }
}

/**
 * Calculate velocity score - this is what we BET on
 * Higher = more momentum = trade it
 */
export async function calculateVelocityScore(tokenAddress, poolCreationTime = null, recentTxData = null) {
  console.log(`\n[VELOCITY] 📊 Scoring: ${tokenAddress.slice(0,8)}...`);
  
  const scores = {
    freshness: 0,
    buyPressure: 0,
    liquidityGrowth: 0,
    earlyWallets: 0,
  };
  
  // FRESHNESS: Newer = Better (inverse of traditional thinking)
  if (poolCreationTime) {
    const ageMinutes = (Date.now() - poolCreationTime) / 1000 / 60;
    
    if (ageMinutes < 2) scores.freshness = 100;        // < 2 min = max score
    else if (ageMinutes < 5) scores.freshness = 90;    // 2-5 min = still hot
    else if (ageMinutes < 15) scores.freshness = 70;   // 5-15 min = warm
    else if (ageMinutes < 30) scores.freshness = 50;   // 15-30 min = cooling
    else if (ageMinutes < 60) scores.freshness = 30;   // 30-60 min = cold
    else scores.freshness = 10;                         // > 1 hour = missed it
    
    console.log(`[VELOCITY] Freshness: ${ageMinutes.toFixed(1)} mins = ${scores.freshness}/100`);
  } else {
    scores.freshness = 50; // Unknown age, neutral
    console.log(`[VELOCITY] Freshness: unknown age = ${scores.freshness}/100`);
  }
  
  // BUY PRESSURE: More buys than sells in recent transactions
  if (recentTxData?.transactions) {
    const txs = recentTxData.transactions;
    const buys = txs.filter(t => t.type === 'buy').length;
    const sells = txs.filter(t => t.type === 'sell').length;
    const total = buys + sells;
    
    if (total > 0) {
      const buyRatio = buys / total;
      scores.buyPressure = Math.round(buyRatio * 100);
      console.log(`[VELOCITY] Buy Pressure: ${buys}/${total} txs = ${scores.buyPressure}/100`);
    } else {
      scores.buyPressure = 50; // No data
    }
  } else {
    // Estimate from holder count growth (if available)
    scores.buyPressure = 50; // Neutral without tx data
    console.log(`[VELOCITY] Buy Pressure: no tx data = ${scores.buyPressure}/100`);
  }
  
  // LIQUIDITY GROWTH: LP increasing = confidence
  if (recentTxData?.liquidityHistory) {
    const history = recentTxData.liquidityHistory;
    if (history.length >= 2) {
      const oldest = history[0].liquidity;
      const newest = history[history.length - 1].liquidity;
      const growth = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;
      
      if (growth > 50) scores.liquidityGrowth = 100;
      else if (growth > 20) scores.liquidityGrowth = 80;
      else if (growth > 0) scores.liquidityGrowth = 60;
      else if (growth > -20) scores.liquidityGrowth = 40;
      else scores.liquidityGrowth = 20; // LP draining = bad
      
      console.log(`[VELOCITY] Liquidity Growth: ${growth.toFixed(1)}% = ${scores.liquidityGrowth}/100`);
    }
  } else {
    scores.liquidityGrowth = 50;
    console.log(`[VELOCITY] Liquidity Growth: no history = ${scores.liquidityGrowth}/100`);
  }
  
  // EARLY WALLETS: Smart money entering?
  if (recentTxData?.earlyBuyers) {
    const smartCount = recentTxData.earlyBuyers.filter(w => w.isSmartMoney).length;
    const totalEarly = recentTxData.earlyBuyers.length;
    
    if (smartCount >= 3) scores.earlyWallets = 100;
    else if (smartCount >= 2) scores.earlyWallets = 80;
    else if (smartCount >= 1) scores.earlyWallets = 60;
    else if (totalEarly > 10) scores.earlyWallets = 40; // Many buyers, no smart money
    else scores.earlyWallets = 30;
    
    console.log(`[VELOCITY] Early Wallets: ${smartCount}/${totalEarly} smart = ${scores.earlyWallets}/100`);
  } else {
    scores.earlyWallets = 50;
    console.log(`[VELOCITY] Early Wallets: no data = ${scores.earlyWallets}/100`);
  }
  
  // WEIGHTED FINAL SCORE
  const finalScore = Math.round(
    (scores.freshness * VELOCITY_WEIGHTS.freshness) +
    (scores.buyPressure * VELOCITY_WEIGHTS.buyPressure) +
    (scores.liquidityGrowth * VELOCITY_WEIGHTS.liquidityGrowth) +
    (scores.earlyWallets * VELOCITY_WEIGHTS.earlyWallets)
  );
  
  console.log(`[VELOCITY] FINAL VELOCITY SCORE: ${finalScore}/100`);
  
  return {
    score: finalScore,
    breakdown: scores,
    tier: getPositionTier(finalScore)
  };
}

/**
 * Get position tier based on velocity score
 */
function getPositionTier(velocityScore) {
  if (velocityScore >= POSITION_TIERS.SNIPE.velocityMin) {
    return { ...POSITION_TIERS.SNIPE, name: 'SNIPE', emoji: '🎯' };
  } else if (velocityScore >= POSITION_TIERS.SCOUT.velocityMin) {
    return { ...POSITION_TIERS.SCOUT, name: 'SCOUT', emoji: '🔭' };
  } else if (velocityScore >= POSITION_TIERS.WATCH.velocityMin) {
    return { ...POSITION_TIERS.WATCH, name: 'WATCH', emoji: '👀' };
  } else {
    return { name: 'SKIP', emoji: '⏭️', size: 0 };
  }
}

/**
 * Full evaluation: Safety Gate → Velocity Score → Trade Decision
 */
export async function evaluateToken(tokenAddress, poolCreationTime = null, recentTxData = null) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎯 VELOCITY GATE EVALUATION: ${tokenAddress}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  // STEP 1: Binary safety check
  const safety = await runSafetyGate(tokenAddress);
  
  if (!safety.passed) {
    return {
      action: 'REJECT',
      reason: safety.reason,
      safety,
      velocity: null,
      tier: null
    };
  }
  
  // STEP 2: Velocity scoring
  const velocity = await calculateVelocityScore(tokenAddress, poolCreationTime, recentTxData);
  
  // STEP 3: Determine action
  const tier = velocity.tier;
  
  let action;
  if (tier.name === 'SNIPE') action = 'BUY';
  else if (tier.name === 'SCOUT') action = 'BUY_SMALL';
  else if (tier.name === 'WATCH') action = 'PAPER_TRADE';
  else action = 'SKIP';
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${tier.emoji} VERDICT: ${action}`);
  if (tier.size > 0) {
    console.log(`   Size: ${tier.size} SOL`);
    console.log(`   Take Profit: ${tier.takeProfit.map(x => x + 'x').join(', ')}`);
    console.log(`   Stop Loss: ${tier.stopLoss}%`);
    console.log(`   Max Hold: ${tier.maxHoldMins} mins`);
  }
  console.log(`${'═'.repeat(60)}\n`);
  
  return {
    action,
    reason: `Velocity ${velocity.score}/100 → ${tier.name}`,
    safety,
    velocity,
    tier
  };
}

export { SAFETY_GATE, VELOCITY_WEIGHTS, POSITION_TIERS };
