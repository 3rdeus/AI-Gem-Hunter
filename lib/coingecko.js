/**
 * CoinGecko API Integration (FREE - No API key required)
 * Provides token metadata, price, market cap, and volume data
 */

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const REQUEST_TIMEOUT = 4000;

/**
 * Fetch token data from CoinGecko
 */
export async function fetchCoinGeckoData(tokenAddress) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const url = `${COINGECKO_BASE_URL}/coins/solana/contract/${tokenAddress}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Extract relevant data
    const result = {
      success: true,
      name: data.name || 'Unknown',
      symbol: data.symbol?.toUpperCase() || 'UNKNOWN',
      price: data.market_data?.current_price?.usd || 0,
      marketCap: data.market_data?.market_cap?.usd || 0,
      volume24h: data.market_data?.total_volume?.usd || 0,
      priceChange24h: data.market_data?.price_change_percentage_24h || 0,
      circulatingSupply: data.market_data?.circulating_supply || 0,
      totalSupply: data.market_data?.total_supply || 0,
      ath: data.market_data?.ath?.usd || 0,
      athDate: data.market_data?.ath_date?.usd || null,
      description: data.description?.en || '',
      website: data.links?.homepage?.[0] || '',
      twitter: data.links?.twitter_screen_name || '',
      telegram: data.links?.telegram_channel_identifier || '',
      coingeckoRank: data.coingecko_rank || null,
      coingeckoScore: data.coingecko_score || null,
      communityScore: data.community_score || null,
      liquidityScore: data.liquidity_score || null,
    };

    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('CoinGecko request timeout');
      return { success: false, error: 'Timeout' };
    }
    
    console.error('CoinGecko fetch error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get simple price data (faster, less data)
 */
export async function fetchSimplePrice(tokenAddress) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const url = `${COINGECKO_BASE_URL}/simple/token_price/solana?contract_addresses=${tokenAddress}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];

    if (!tokenData) {
      return { success: false, error: 'Token not found' };
    }

    return {
      success: true,
      price: tokenData.usd || 0,
      marketCap: tokenData.usd_market_cap || 0,
      volume24h: tokenData.usd_24h_vol || 0,
      priceChange24h: tokenData.usd_24h_change || 0,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout' };
    }
    
    return { success: false, error: error.message };
  }
}
