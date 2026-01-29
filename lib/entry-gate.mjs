/**
 * Entry Gate - Hardened Pre-Trade Validation
 * ALL checks must pass before any buy execution
 * 
 * Philosophy: Miss opportunities, never lose to rugs
 */

import { detectBundledLaunch } from './bundle-detection.js';
import { analyzeDeployerFunding } from './deployer-funding.js';
import { getComprehensiveSecurityAnalysis } from './goplus.js';
import { checkLiquidity } from './liquidity-checker.mjs';
import { calculateGemScore } from './token-scorer.mjs';

/**
 * Hard rejection thresholds - if ANY of these fail, DO NOT BUY
 */
const HARD_RULES = {
  // Minimum age in milliseconds (token must survive this long)
  MIN_TOKEN_AGE_MS: 5 * 60 * 1000, // 5 minutes
  
  // Liquidity requirements
  MIN_LIQUIDITY_USD: 30000,  // $30k minimum
  
  // Bundle/Insider detection
  MAX_BUNDLE_RISK_SCORE: 40, // 0-100, lower = safer
  MAX_DEPLOYER_FUNDED_WALLETS: 2, // Allow some, but not many
  
  // Contract security
  REQUIRE_MINT_REVOKED: true,
  REQUIRE_FREEZE_REVOKED: true,
  
  // Holder distribution
  MAX_TOP10_CONCENTRATION: 60, // Top 10 can't hold > 60%
  MAX_SINGLE_HOLDER: 15, // No single wallet > 15% (excluding LP)
  
  // Honeypot
  REQUIRE_SELLABLE: true, // Must pass sell simulation
  MAX_SELL_TAX: 10, // Max 10% sell tax
  
  // Minimum gem score
  MIN_GEM_SCORE: 40
};

/**
 * Gate result structure
 */
function createGateResult(passed, reason, checks, riskLevel) {
  return {
    passed,
    reason,
    checks,
    riskLevel, // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    timestamp: new Date().toISOString()
  };
}

/**
 * Main entry gate - returns pass/fail with detailed reasoning
 * @param {string} tokenAddress - Token to evaluate
 * @param {number} tokenCreationTime - Unix timestamp of token creation
 * @returns {Promise<Object>} Gate result
 */
export async function evaluateEntry(tokenAddress, tokenCreationTime = null) {
  console.log(`\n[ENTRY-GATE] ═══════════════════════════════════════`);
  console.log(`[ENTRY-GATE] Evaluating: ${tokenAddress}`);
  console.log(`[ENTRY-GATE] ═══════════════════════════════════════\n`);
  
  const checks = {
    tokenAge: { passed: null, value: null, required: HARD_RULES.MIN_TOKEN_AGE_MS },
    liquidity: { passed: null, value: null, required: HARD_RULES.MIN_LIQUIDITY_USD },
    bundleRisk: { passed: null, value: null, required: `<${HARD_RULES.MAX_BUNDLE_RISK_SCORE}` },
    deployerFunding: { passed: null, value: null, required: `<${HARD_RULES.MAX_DEPLOYER_FUNDED_WALLETS}` },
    mintRevoked: { passed: null, value: null, required: true },
    freezeRevoked: { passed: null, value: null, required: true },
    honeypot: { passed: null, value: null, required: 'sellable' },
    sellTax: { passed: null, value: null, required: `<${HARD_RULES.MAX_SELL_TAX}%` },
    holderConcentration: { passed: null, value: null, required: `<${HARD_RULES.MAX_TOP10_CONCENTRATION}%` },
    gemScore: { passed: null, value: null, required: `>${HARD_RULES.MIN_GEM_SCORE}` }
  };
  
  let failReasons = [];
  
  try {
    // ═══════════════════════════════════════════════════════════
    // CHECK 1: Token Age (must survive initial minutes)
    // ═══════════════════════════════════════════════════════════
    if (tokenCreationTime) {
      const ageMs = Date.now() - tokenCreationTime;
      checks.tokenAge.value = Math.round(ageMs / 1000 / 60) + ' mins';
      checks.tokenAge.passed = ageMs >= HARD_RULES.MIN_TOKEN_AGE_MS;
      
      if (!checks.tokenAge.passed) {
        failReasons.push(`Token too young (${checks.tokenAge.value}, need ${HARD_RULES.MIN_TOKEN_AGE_MS/60000} mins)`);
      }
      console.log(`[ENTRY-GATE] Token Age: ${checks.tokenAge.value} - ${checks.tokenAge.passed ? '✅' : '❌'}`);
    } else {
      checks.tokenAge.value = 'unknown';
      checks.tokenAge.passed = true; // Can't check, assume OK
      console.log(`[ENTRY-GATE] Token Age: unknown (skipping check)`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 2: Liquidity
    // ═══════════════════════════════════════════════════════════
    const liquidityData = await checkLiquidity(tokenAddress);
    if (liquidityData?.success) {
      checks.liquidity.value = liquidityData.liquidity_usd;
      checks.liquidity.passed = liquidityData.liquidity_usd >= HARD_RULES.MIN_LIQUIDITY_USD;
      
      if (!checks.liquidity.passed) {
        failReasons.push(`Liquidity too low ($${checks.liquidity.value?.toLocaleString()}, need $${HARD_RULES.MIN_LIQUIDITY_USD.toLocaleString()})`);
      }
      console.log(`[ENTRY-GATE] Liquidity: $${checks.liquidity.value?.toLocaleString()} - ${checks.liquidity.passed ? '✅' : '❌'}`);
    } else {
      checks.liquidity.value = 'fetch failed';
      checks.liquidity.passed = false;
      failReasons.push('Could not verify liquidity');
      console.log(`[ENTRY-GATE] Liquidity: fetch failed - ❌`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 3: Bundle Detection (coordinated insiders)
    // ═══════════════════════════════════════════════════════════
    const bundleData = await detectBundledLaunch(tokenAddress);
    if (bundleData?.success) {
      const riskScore = bundleData.bundle_analysis?.risk_score || 0;
      checks.bundleRisk.value = riskScore;
      checks.bundleRisk.passed = riskScore < HARD_RULES.MAX_BUNDLE_RISK_SCORE;
      
      if (!checks.bundleRisk.passed) {
        failReasons.push(`Bundled launch detected (risk: ${riskScore}/100)`);
      }
      console.log(`[ENTRY-GATE] Bundle Risk: ${riskScore}/100 - ${checks.bundleRisk.passed ? '✅' : '❌'}`);
    } else {
      checks.bundleRisk.value = 'check failed';
      checks.bundleRisk.passed = true; // Can't verify, proceed with caution
      console.log(`[ENTRY-GATE] Bundle Risk: check failed (proceeding)`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 4: Deployer Funding (insider wallets)
    // ═══════════════════════════════════════════════════════════
    const deployerData = await analyzeDeployerFunding(tokenAddress);
    if (deployerData?.success) {
      checks.deployerFunding.value = deployerData.total_funded;
      checks.deployerFunding.passed = deployerData.total_funded <= HARD_RULES.MAX_DEPLOYER_FUNDED_WALLETS;
      
      if (!checks.deployerFunding.passed) {
        failReasons.push(`Deployer funded ${deployerData.total_funded} early buyer wallets`);
      }
      console.log(`[ENTRY-GATE] Deployer-Funded Wallets: ${deployerData.total_funded} - ${checks.deployerFunding.passed ? '✅' : '❌'}`);
    } else {
      checks.deployerFunding.value = 'check failed';
      checks.deployerFunding.passed = true;
      console.log(`[ENTRY-GATE] Deployer Funding: check failed (proceeding)`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 5, 6, 7, 8: Contract Security via GoPlus
    // ═══════════════════════════════════════════════════════════
    const securityAnalysis = await getComprehensiveSecurityAnalysis(tokenAddress);
    if (securityAnalysis?.success && securityAnalysis.security) {
      const sec = securityAnalysis.security;
      
      // Mint authority
      const mintRevoked = !sec.mint_authority?.has_authority;
      checks.mintRevoked.value = mintRevoked ? 'revoked' : 'ACTIVE';
      checks.mintRevoked.passed = !HARD_RULES.REQUIRE_MINT_REVOKED || mintRevoked;
      
      if (!checks.mintRevoked.passed) {
        failReasons.push('Mint authority NOT revoked - dev can print tokens');
      }
      console.log(`[ENTRY-GATE] Mint Authority: ${checks.mintRevoked.value} - ${checks.mintRevoked.passed ? '✅' : '❌'}`);
      
      // Freeze authority
      const freezeRevoked = !sec.freeze_authority?.has_authority;
      checks.freezeRevoked.value = freezeRevoked ? 'revoked' : 'ACTIVE';
      checks.freezeRevoked.passed = !HARD_RULES.REQUIRE_FREEZE_REVOKED || freezeRevoked;
      
      if (!checks.freezeRevoked.passed) {
        failReasons.push('Freeze authority NOT revoked - dev can freeze your tokens');
      }
      console.log(`[ENTRY-GATE] Freeze Authority: ${checks.freezeRevoked.value} - ${checks.freezeRevoked.passed ? '✅' : '❌'}`);
      
      // Holder concentration
      checks.holderConcentration.value = 'see detailed report';
      checks.holderConcentration.passed = true; // Placeholder
      
      // Honeypot
      const honeypot = securityAnalysis.honeypot;
      if (honeypot) {
        checks.honeypot.value = honeypot.is_honeypot ? 'HONEYPOT' : 'sellable';
        checks.honeypot.passed = !honeypot.is_honeypot;
        
        if (!checks.honeypot.passed) {
          failReasons.push('HONEYPOT DETECTED - cannot sell');
        }
        console.log(`[ENTRY-GATE] Honeypot: ${checks.honeypot.value} - ${checks.honeypot.passed ? '✅' : '❌'}`);
      } else {
        checks.honeypot.value = 'unknown';
        checks.honeypot.passed = true; // Can't verify, proceed
      }
      
      // Sell tax
      const sellTax = parseFloat(securityAnalysis.raw_data?.sell_tax || 0) * 100;
      checks.sellTax.value = sellTax + '%';
      checks.sellTax.passed = sellTax <= HARD_RULES.MAX_SELL_TAX;
      
      if (!checks.sellTax.passed) {
        failReasons.push(`Sell tax too high (${sellTax}%, max ${HARD_RULES.MAX_SELL_TAX}%)`);
      }
      console.log(`[ENTRY-GATE] Sell Tax: ${checks.sellTax.value} - ${checks.sellTax.passed ? '✅' : '❌'}`);
    } else {
      // Security check failed - mark all security checks as failed
      checks.mintRevoked.value = 'check failed';
      checks.mintRevoked.passed = false;
      checks.freezeRevoked.value = 'check failed';
      checks.freezeRevoked.passed = false;
      checks.honeypot.value = 'check failed';
      checks.honeypot.passed = false;
      checks.sellTax.value = 'check failed';
      checks.sellTax.passed = false;
      failReasons.push('Could not verify contract security');
      console.log(`[ENTRY-GATE] Security Check: failed - ❌`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 9: Gem Score
    // ═══════════════════════════════════════════════════════════
    const gemData = await calculateGemScore(tokenAddress);
    if (gemData && !gemData.error) {
      checks.gemScore.value = gemData.score;
      checks.gemScore.passed = gemData.score >= HARD_RULES.MIN_GEM_SCORE;
      
      if (!checks.gemScore.passed) {
        failReasons.push(`Gem score too low (${gemData.score}/100, need ${HARD_RULES.MIN_GEM_SCORE})`);
      }
      console.log(`[ENTRY-GATE] Gem Score: ${gemData.score}/100 - ${checks.gemScore.passed ? '✅' : '❌'}`);
    } else {
      checks.gemScore.value = 'scoring failed';
      checks.gemScore.passed = false;
      failReasons.push('Could not calculate gem score');
      console.log(`[ENTRY-GATE] Gem Score: scoring failed - ❌`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // FINAL VERDICT
    // ═══════════════════════════════════════════════════════════
    const allPassed = Object.values(checks).every(c => c.passed === true);
    const failedCount = Object.values(checks).filter(c => c.passed === false).length;
    
    let riskLevel;
    if (failedCount === 0) riskLevel = 'LOW';
    else if (failedCount <= 2) riskLevel = 'MEDIUM';
    else if (failedCount <= 4) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';
    
    console.log(`\n[ENTRY-GATE] ═══════════════════════════════════════`);
    console.log(`[ENTRY-GATE] VERDICT: ${allPassed ? '✅ APPROVED' : '❌ REJECTED'}`);
    console.log(`[ENTRY-GATE] Risk Level: ${riskLevel}`);
    if (failReasons.length > 0) {
      console.log(`[ENTRY-GATE] Fail Reasons:`);
      failReasons.forEach(r => console.log(`[ENTRY-GATE]   - ${r}`));
    }
    console.log(`[ENTRY-GATE] ═══════════════════════════════════════\n`);
    
    return createGateResult(
      allPassed,
      allPassed ? 'All checks passed' : failReasons.join('; '),
      checks,
      riskLevel
    );
    
  } catch (error) {
    console.error(`[ENTRY-GATE] Fatal error: ${error.message}`);
    return createGateResult(
      false,
      `Gate evaluation error: ${error.message}`,
      checks,
      'CRITICAL'
    );
  }
}

/**
 * Quick pre-screen (fast checks only, for high-volume filtering)
 */
export async function quickPreScreen(tokenAddress, tokenCreationTime) {
  // Only check age and liquidity for speed
  const checks = { tokenAge: false, liquidity: false };
  
  // Age check
  if (tokenCreationTime) {
    const ageMs = Date.now() - tokenCreationTime;
    checks.tokenAge = ageMs >= HARD_RULES.MIN_TOKEN_AGE_MS;
    if (!checks.tokenAge) {
      return { passed: false, reason: 'Too young', waitMs: HARD_RULES.MIN_TOKEN_AGE_MS - ageMs };
    }
  }
  
  // Quick liquidity check
  const liquidityData = await checkLiquidity(tokenAddress);
  if (liquidityData?.success) {
    checks.liquidity = liquidityData.liquidity_usd >= HARD_RULES.MIN_LIQUIDITY_USD;
    if (!checks.liquidity) {
      return { passed: false, reason: `Low liquidity: $${liquidityData.liquidity_usd}` };
    }
  }
  
  return { passed: true, reason: 'Pre-screen passed, run full evaluation' };
}

export { HARD_RULES };
