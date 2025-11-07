/**
 * Birdeye API Integration
 * Fetches token market data, volume, price, and holder information
 */

const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 4000;

/**
 * Fetch token overview from Birdeye
 */
export async function fetchBirdeyeData(tokenAddress) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${BIRDEYE_BASE_URL}/defi/token_overview?address=${tokenAddress}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    // Add API key if available
    if (process.env.BIRDEYE_API_KEY) {
      headers['X-API-KEY'] = process.env.BIRDEYE_API_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return { success: false, error: 'Invalid response format' };
    }

    // Extract relevant data
    return {
      success: true,
      data: {
        liquidity: data.data.liquidity || 0,
        marketCap: data.data.mc || 0,
        price: data.data.price || 0,
        volume24h: data.data.v24hUSD || 0,
        priceChange24h: data.data.v24hChangePercent || 0,
        holders: data.data.holder || 0,
        supply: data.data.supply || 0,
        decimals: data.data.decimals || 9,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('Birdeye API timeout');
      return { success: false, error: 'Timeout' };
    }

    console.error('Birdeye API error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch token price from Birdeye
 */
export async function fetchBirdeyePrice(tokenAddress) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${BIRDEYE_BASE_URL}/defi/price?address=${tokenAddress}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    if (process.env.BIRDEYE_API_KEY) {
      headers['X-API-KEY'] = process.env.BIRDEYE_API_KEY;
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

    return {
      success: true,
      data: {
        price: data.data?.value || 0,
        updateTime: data.data?.updateUnixTime || Date.now(),
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze Birdeye data for suspicious patterns
 */
export function analyzeBirdeyeData(data) {
  const warnings = [];
  let riskScore = 0;

  if (!data || !data.success) {
    return { warnings: ['Birdeye data unavailable'], riskScore: 50 };
  }

  const { liquidity, marketCap, volume24h, priceChange24h, holders } = data.data;

  // Low liquidity warning
  if (liquidity < 5000) {
    warnings.push('Very low liquidity (< $5K) - high slippage risk');
    riskScore += 30;
  } else if (liquidity < 50000) {
    warnings.push('Low liquidity (< $50K) - moderate slippage risk');
    riskScore += 15;
  }

  // Low market cap warning
  if (marketCap < 100000) {
    warnings.push('Very low market cap - high volatility risk');
    riskScore += 20;
  }

  // Suspicious volume patterns
  if (volume24h > marketCap * 2) {
    warnings.push('Abnormally high volume relative to market cap - possible wash trading');
    riskScore += 25;
  }

  // Extreme price changes
  if (Math.abs(priceChange24h) > 100) {
    warnings.push(`Extreme price volatility (${priceChange24h.toFixed(1)}% in 24h)`);
    riskScore += 20;
  }

  // Low holder count
  if (holders < 100) {
    warnings.push('Very few holders - centralization risk');
    riskScore += 15;
  }

  return {
    warnings,
    riskScore: Math.min(riskScore, 100),
  };
}
