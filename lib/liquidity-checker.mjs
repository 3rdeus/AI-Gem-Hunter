/**
 * Liquidity Checker Module
 * Checks if a token has sufficient liquidity using Birdeye API
 */

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const MIN_LIQUIDITY_USD = 150; // Approximately 1 SOL at current prices
const API_TIMEOUT_MS = 5000; // 5 second timeout

/**
 * Check if a token has sufficient liquidity
 * @param {string} tokenAddress - Solana token address
 * @param {number} minLiquidityUSD - Minimum liquidity in USD (default: 150)
 * @returns {Promise<{passed: boolean, liquidity: number, error: string|null}>}
 */
export async function checkLiquidity(tokenAddress, minLiquidityUSD = MIN_LIQUIDITY_USD) {
  try {
    console.log(`[LIQUIDITY-CHECK] Checking liquidity for token: ${tokenAddress}`);
    
    // Fetch token data from Birdeye
    const tokenData = await fetchTokenOverview(tokenAddress);
    
    if (!tokenData) {
      console.log(`[LIQUIDITY-CHECK] No data available for token: ${tokenAddress}`);
      return {
        passed: true, // Fail-open: allow token through if data unavailable
        liquidity: 0,
        error: 'No data available'
      };
    }
    
    // Extract liquidity value
    const liquidity = tokenData.liquidity || 0;
    const passed = liquidity >= minLiquidityUSD;
    
    console.log(`[LIQUIDITY-CHECK] Token: ${tokenAddress}, Liquidity: $${liquidity.toFixed(2)}, Passed: ${passed}`);
    
    return {
      passed,
      liquidity,
      error: null
    };
    
  } catch (error) {
    console.error(`[LIQUIDITY-CHECK] Error checking liquidity for ${tokenAddress}:`, error.message);
    
    // Fail-open: allow token through on error
    return {
      passed: true,
      liquidity: 0,
      error: error.message
    };
  }
}

/**
 * Fetch token overview from Birdeye API
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<Object|null>}
 */
async function fetchTokenOverview(tokenAddress) {
  const url = `${BIRDEYE_API_URL}/defi/token_overview?address=${tokenAddress}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[LIQUIDITY-CHECK] Birdeye API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      console.error(`[LIQUIDITY-CHECK] Invalid response from Birdeye API`);
      return null;
    }
    
    return data.data;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`[LIQUIDITY-CHECK] API request timeout after ${API_TIMEOUT_MS}ms`);
    } else {
      console.error(`[LIQUIDITY-CHECK] Fetch error:`, error.message);
    }
    
    return null;
  }
}

/**
 * Get detailed liquidity information for a token
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<Object|null>}
 */
export async function getDetailedLiquidity(tokenAddress) {
  try {
    const tokenData = await fetchTokenOverview(tokenAddress);
    
    if (!tokenData) {
      return null;
    }
    
    return {
      liquidity: tokenData.liquidity || 0,
      volume24h: tokenData.v24hUSD || 0,
      marketCap: tokenData.mc || 0,
      priceChange24h: tokenData.v24hChangePercent || 0,
      holders: tokenData.holder || 0,
      supply: tokenData.supply || 0,
      decimals: tokenData.decimals || 0
    };
    
  } catch (error) {
    console.error(`[LIQUIDITY-CHECK] Error getting detailed liquidity:`, error.message);
    return null;
  }
}

/**
 * Check liquidity for multiple tokens in batch
 * @param {string[]} tokenAddresses - Array of Solana token addresses
 * @param {number} minLiquidityUSD - Minimum liquidity in USD
 * @returns {Promise<Map<string, {passed: boolean, liquidity: number}>>}
 */
export async function checkLiquidityBatch(tokenAddresses, minLiquidityUSD = MIN_LIQUIDITY_USD) {
  const results = new Map();
  
  // Process tokens sequentially to avoid rate limiting
  for (const address of tokenAddresses) {
    const result = await checkLiquidity(address, minLiquidityUSD);
    results.set(address, result);
    
    // Small delay between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Get current SOL price from Birdeye
 * @returns {Promise<number|null>} SOL price in USD
 */
export async function getSolPrice() {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  try {
    const tokenData = await fetchTokenOverview(SOL_MINT);
    
    if (tokenData && tokenData.price) {
      console.log(`[LIQUIDITY-CHECK] Current SOL price: $${tokenData.price.toFixed(2)}`);
      return tokenData.price;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[LIQUIDITY-CHECK] Error fetching SOL price:`, error.message);
    return null;
  }
}

/**
 * Convert SOL amount to USD using current price
 * @param {number} solAmount - Amount in SOL
 * @returns {Promise<number|null>} Equivalent USD value
 */
export async function convertSolToUsd(solAmount) {
  const solPrice = await getSolPrice();
  
  if (solPrice) {
    return solAmount * solPrice;
  }
  
  // Fallback to approximate price if API fails
  const APPROXIMATE_SOL_PRICE = 150;
  console.log(`[LIQUIDITY-CHECK] Using approximate SOL price: $${APPROXIMATE_SOL_PRICE}`);
  return solAmount * APPROXIMATE_SOL_PRICE;
}

// Export constants for use in other modules
export const CONSTANTS = {
  MIN_LIQUIDITY_USD,
  API_TIMEOUT_MS
};
