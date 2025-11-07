/**
 * Jupiter API Integration (FREE)
 * Provides real-time price data from Solana DEXs
 */

const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';
const REQUEST_TIMEOUT = 4000;

/**
 * Fetch price data from Jupiter
 */
export async function fetchJupiterPrice(tokenAddress) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const url = `${JUPITER_PRICE_API}?ids=${tokenAddress}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Jupiter API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const priceData = data.data?.[tokenAddress];

    if (!priceData) {
      return { success: false, error: 'Token not found' };
    }

    return {
      success: true,
      price: priceData.price || 0,
      // Jupiter doesn't provide these, but we return structure for consistency
      marketCap: 0,
      volume24h: 0,
      priceChange24h: 0,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Jupiter request timeout');
      return { success: false, error: 'Timeout' };
    }
    
    console.error('Jupiter fetch error:', error.message);
    return { success: false, error: error.message };
  }
}
