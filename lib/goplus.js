import crypto from 'crypto';

const GOPLUS_API = 'https://api.gopluslabs.io/api/v1/solana/token_security';

/**
 * Generate GoPlus API signature
 * @param {string} appKey - GoPlus app key
 * @param {number} time - Unix timestamp
 * @param {string} appSecret - GoPlus app secret
 * @returns {string} SHA1 signature
 */
function generateSignature(appKey, time, appSecret) {
  return crypto.createHash('sha1')
    .update(`${appKey}${time}${appSecret}`)
    .digest('hex');
}

/**
 * Fetch token security data from GoPlus Labs API
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<Object>} Security data
 */
async function getTokenSecurity(tokenAddress) {
  try {
    const appKey = process.env.GOPLUS_APP_KEY;
    const appSecret = process.env.GOPLUS_APP_SECRET;
    
    if (!appKey || !appSecret) {
      console.warn('GoPlus API credentials not configured');
      return null;
    }
    
    const time = Math.floor(Date.now() / 1000);
    const sign = generateSignature(appKey, time, appSecret);
    
    const url = `${GOPLUS_API}?contract_addresses=${tokenAddress}&app_key=${appKey}&sign=${sign}&time=${time}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 1) {
      throw new Error(`GoPlus API returned error code: ${data.code} - ${data.message}`);
    }
    
    return data.result?.[tokenAddress] || null;
  } catch (error) {
    console.error('GoPlus API error:', error.message);
    return null;
  }
}

/**
 * Analyze honeypot risk based on GoPlus security data
 * @param {Object} securityData - Security data from GoPlus
 * @returns {Object} Honeypot analysis
 */
function analyzeHoneypot(securityData) {
  if (!securityData) {
    return {
      is_honeypot: false,
      confidence: 0,
      reason: 'No data available',
      risks: [],
      checked: false
    };
  }
  
  const risks = [];
  let confidence = 0;
  let isHoneypot = false;
  
  // Check if token is non-transferable
  if (securityData.is_non_transferable === '1') {
    risks.push('Token is non-transferable');
    confidence += 50;
    isHoneypot = true;
  }
  
  // Check for transfer hooks that might block selling
  if (securityData.has_transfer_hook === '1') {
    risks.push('Has transfer hooks that may restrict trading');
    confidence += 30;
  }
  
  // Check if accounts can be frozen
  if (securityData.is_freezable === '1') {
    risks.push('Token accounts can be frozen by authority');
    confidence += 20;
  }
  
  // Check for suspicious trading patterns
  if (securityData.buy_tax && parseFloat(securityData.buy_tax) > 10) {
    risks.push(`High buy tax: ${securityData.buy_tax}%`);
    confidence += 10;
  }
  
  if (securityData.sell_tax && parseFloat(securityData.sell_tax) > 10) {
    risks.push(`High sell tax: ${securityData.sell_tax}%`);
    confidence += 10;
  }
  
  // Determine if it's a honeypot based on confidence
  if (confidence >= 50) {
    isHoneypot = true;
  }
  
  return {
    is_honeypot: isHoneypot,
    confidence: Math.min(confidence, 100),
    reason: risks.length > 0 ? risks[0] : 'No honeypot indicators found',
    risks: risks,
    checked: true
  };
}

/**
 * Analyze mint authority risk
 * @param {Object} securityData - Security data from GoPlus
 * @returns {Object} Mint authority analysis
 */
function analyzeMintAuthority(securityData) {
  if (!securityData) {
    return {
      has_mint_authority: false,
      authority_address: null,
      is_malicious: false,
      warning: null
    };
  }
  
  const hasMintAuthority = securityData.is_mintable === '1';
  const authorityAddress = securityData.mint_authority || null;
  
  // Check if mint authority is known to be malicious
  const isMalicious = securityData.malicious_mint_authority === '1';
  
  let warning = null;
  if (hasMintAuthority) {
    if (isMalicious) {
      warning = 'Mint authority is controlled by a known malicious address';
    } else if (authorityAddress) {
      warning = 'Token supply can be increased by mint authority';
    } else {
      warning = 'Unlimited minting is enabled';
    }
  }
  
  return {
    has_mint_authority: hasMintAuthority,
    authority_address: authorityAddress,
    is_malicious: isMalicious,
    warning: warning
  };
}

/**
 * Analyze other security risks
 * @param {Object} securityData - Security data from GoPlus
 * @returns {Array} List of other risks
 */
function analyzeOtherRisks(securityData) {
  if (!securityData) return [];
  
  const risks = [];
  
  // Check if program is closable
  if (securityData.is_closable === '1') {
    risks.push({
      type: 'closable_program',
      severity: 'high',
      message: 'Program can be closed, eliminating all token assets'
    });
  }
  
  // Check for mutable balances
  if (securityData.is_mutable_balance === '1') {
    risks.push({
      type: 'mutable_balance',
      severity: 'critical',
      message: 'Token balances can be tampered with by authority'
    });
  }
  
  // Check for upgradable transfer fees
  if (securityData.has_upgradable_transfer_fee === '1') {
    risks.push({
      type: 'upgradable_fee',
      severity: 'medium',
      message: 'Transfer fees can be increased up to 100%'
    });
  }
  
  // Check for blacklist functionality
  if (securityData.has_blacklist === '1') {
    risks.push({
      type: 'blacklist',
      severity: 'medium',
      message: 'Token has blacklist functionality'
    });
  }
  
  return risks;
}

/**
 * Calculate total score penalty based on security risks
 * @param {Object} honeypot - Honeypot analysis
 * @param {Object} mintAuthority - Mint authority analysis
 * @param {Array} otherRisks - Other risks
 * @returns {number} Total penalty to subtract from safety score
 */
function calculateScorePenalty(honeypot, mintAuthority, otherRisks) {
  let penalty = 0;
  
  // Honeypot penalty (0-50 points)
  if (honeypot.is_honeypot) {
    penalty += Math.floor(honeypot.confidence / 2);
  }
  
  // Mint authority penalty
  if (mintAuthority.has_mint_authority) {
    penalty += mintAuthority.is_malicious ? 40 : 15;
  }
  
  // Other risks penalties
  otherRisks.forEach(risk => {
    switch (risk.severity) {
      case 'critical':
        penalty += 35;
        break;
      case 'high':
        penalty += 25;
        break;
      case 'medium':
        penalty += 10;
        break;
      default:
        penalty += 5;
    }
  });
  
  return Math.min(penalty, 95); // Cap at 95 to avoid negative scores
}

/**
 * Get comprehensive security analysis from GoPlus
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<Object>} Comprehensive security analysis
 */
export async function getComprehensiveSecurityAnalysis(tokenAddress) {
  try {
    const securityData = await getTokenSecurity(tokenAddress);
    
    if (!securityData) {
      return {
        available: false,
        honeypot: analyzeHoneypot(null),
        mint_authority: analyzeMintAuthority(null),
        other_risks: [],
        total_score_penalty: 0,
        trusted_token: false
      };
    }
    
    const honeypot = analyzeHoneypot(securityData);
    const mintAuthority = analyzeMintAuthority(securityData);
    const otherRisks = analyzeOtherRisks(securityData);
    const scorePenalty = calculateScorePenalty(honeypot, mintAuthority, otherRisks);
    
    // Check if it's a trusted token
    const trustedToken = securityData.is_trust_list === '1';
    
    return {
      available: true,
      honeypot: honeypot,
      mint_authority: mintAuthority,
      other_risks: otherRisks,
      total_score_penalty: trustedToken ? 0 : scorePenalty,
      trusted_token: trustedToken,
      raw_data: securityData // Include raw data for debugging
    };
  } catch (error) {
    console.error('Error in comprehensive security analysis:', error);
    return {
      available: false,
      honeypot: analyzeHoneypot(null),
      mint_authority: analyzeMintAuthority(null),
      other_risks: [],
      total_score_penalty: 0,
      trusted_token: false
    };
  }
}
