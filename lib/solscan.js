/**
 * Solscan API Integration
 * Fetches token metadata, contract details, and transaction history
 */

const SOLSCAN_BASE_URL = 'https://api.solscan.io';
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;
const TIMEOUT_MS = 4000;

if (!SOLSCAN_API_KEY) {
  console.warn('SOLSCAN_API_KEY not set - Solscan integration may fail');
}

/**
 * Fetch token metadata from Solscan
 */
export async function fetchSolscanMetadata(tokenAddress) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${SOLSCAN_BASE_URL}/token/meta?token=${tokenAddress}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    if (SOLSCAN_API_KEY) {
      headers['token'] = SOLSCAN_API_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Solscan API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        name: data.name || 'Unknown Token',
        symbol: data.symbol || 'UNKNOWN',
        decimals: data.decimals || 9,
        supply: data.supply || 0,
        holder: data.holder || 0,
        icon: data.icon || null,
        website: data.website || null,
        twitter: data.twitter || null,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('Solscan API timeout');
      return { success: false, error: 'Timeout' };
    }

    console.error('Solscan API error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch token holders from Solscan
 */
export async function fetchSolscanHolders(tokenAddress, limit = 10) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${SOLSCAN_BASE_URL}/token/holders?token=${tokenAddress}&offset=0&limit=${limit}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    if (SOLSCAN_API_KEY) {
      headers['token'] = SOLSCAN_API_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return { success: false, error: 'Invalid response format' };
    }

    // Calculate top holder percentage
    const totalSupply = data.total || 0;
    const topHolders = data.data.slice(0, 5);
    
    let topHolderAmount = 0;
    if (topHolders.length > 0) {
      topHolderAmount = topHolders[0].amount || 0;
    }

    const topHolderPercent = totalSupply > 0 ? (topHolderAmount / totalSupply) * 100 : 0;

    return {
      success: true,
      data: {
        totalHolders: data.total || 0,
        topHolders: topHolders.map(h => ({
          address: h.address,
          amount: h.amount,
          decimals: h.decimals,
          percent: totalSupply > 0 ? (h.amount / totalSupply) * 100 : 0,
        })),
        topHolderPercent,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch recent transactions from Solscan
 */
export async function fetchSolscanTransactions(tokenAddress, limit = 20) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${SOLSCAN_BASE_URL}/token/transfer/latest?token=${tokenAddress}&limit=${limit}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    if (SOLSCAN_API_KEY) {
      headers['token'] = SOLSCAN_API_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return { success: false, error: 'Invalid response format' };
    }

    return {
      success: true,
      data: {
        transactions: data.data.map(tx => ({
          signature: tx.signature,
          blockTime: tx.blockTime,
          from: tx.src,
          to: tx.dst,
          amount: tx.amount,
          decimals: tx.decimals,
        })),
        count: data.data.length,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze Solscan data for suspicious patterns
 */
export function analyzeSolscanData(metadata, holders, transactions) {
  const warnings = [];
  let riskScore = 0;

  // Check metadata
  if (metadata && metadata.success) {
    const { name, symbol, website, twitter } = metadata.data;
    
    // No social media presence
    if (!website && !twitter) {
      warnings.push('No website or social media links - possible scam');
      riskScore += 20;
    }

    // Suspicious name patterns
    if (name && (name.toLowerCase().includes('test') || name.toLowerCase().includes('fake'))) {
      warnings.push('Suspicious token name detected');
      riskScore += 30;
    }
  }

  // Check holder concentration
  if (holders && holders.success) {
    const { topHolderPercent, totalHolders } = holders.data;
    
    if (topHolderPercent > 50) {
      warnings.push(`Whale alert: Top holder owns ${topHolderPercent.toFixed(1)}% of supply`);
      riskScore += 35;
    } else if (topHolderPercent > 30) {
      warnings.push(`High concentration: Top holder owns ${topHolderPercent.toFixed(1)}% of supply`);
      riskScore += 20;
    }

    if (totalHolders < 50) {
      warnings.push('Very few token holders - high centralization');
      riskScore += 15;
    }
  }

  // Check transaction patterns
  if (transactions && transactions.success) {
    const { transactions: txs } = transactions.data;
    
    if (txs.length < 5) {
      warnings.push('Very low transaction activity - possible dead token');
      riskScore += 15;
    }

    // Check for bot-like patterns (many transactions in short time)
    if (txs.length >= 10) {
      const timestamps = txs.map(tx => tx.blockTime).sort();
      const timeDiff = timestamps[timestamps.length - 1] - timestamps[0];
      
      if (timeDiff < 60) { // All transactions within 1 minute
        warnings.push('Suspicious transaction pattern - possible bot activity');
        riskScore += 25;
      }
    }
  }

  return {
    warnings,
    riskScore: Math.min(riskScore, 100),
  };
}
