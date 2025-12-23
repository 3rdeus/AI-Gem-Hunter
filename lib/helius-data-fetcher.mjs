/**
 * Helius Data Fetcher
 * Fetch real-time token data using Helius Enhanced APIs
 * Better for brand new tokens than Birdeye
 */

const HELIUS_API_KEY = '1502c109-1c26-4f4d-baef-260bc1e4de12';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_URL = `https://api-mainnet.helius-rpc.com/v0`;

/**
 * Fetch token metadata from Helius
 */
async function fetchTokenMetadata(tokenAddress) {
  try {
    const response = await fetch(`${HELIUS_API_URL}/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAccounts: [tokenAddress]
      })
    });
    
    if (!response.ok) {
      console.error(`[HELIUS] ❌ Token metadata request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data[0] || null;
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching token metadata:', error.message);
    return null;
  }
}

/**
 * Fetch token account info via RPC
 */
async function fetchTokenAccountInfo(tokenAddress) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [tokenAddress, { encoding: 'jsonParsed' }]
      })
    });
    
    if (!response.ok) {
      console.error(`[HELIUS] ❌ Account info request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.result?.value || null;
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching account info:', error.message);
    return null;
  }
}

/**
 * Fetch token supply
 */
async function fetchTokenSupply(tokenAddress) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenSupply',
        params: [tokenAddress]
      })
    });
    
    if (!response.ok) {
      console.error(`[HELIUS] ❌ Token supply request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.result?.value || null;
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching token supply:', error.message);
    return null;
  }
}

/**
 * Fetch token holders count
 */
async function fetchTokenHolders(tokenAddress) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [tokenAddress]
      })
    });
    
    if (!response.ok) {
      console.error(`[HELIUS] ❌ Token holders request failed: ${response.status}`);
      return 0;
    }
    
    const data = await response.json();
    return data.result?.value?.length || 0;
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching token holders:', error.message);
    return 0;
  }
}

/**
 * Parse transactions to get liquidity and volume data
 */
async function fetchTransactionData(tokenAddress) {
  try {
    const response = await fetch(
      `${HELIUS_API_URL}/addresses/${tokenAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=100`
    );
    
    if (!response.ok) {
      console.error(`[HELIUS] ❌ Transaction data request failed: ${response.status}`);
      return { liquidity: 0, volume24h: 0, transactions: 0 };
    }
    
    const transactions = await response.json();
    
    // Analyze transactions for liquidity and volume
    let totalVolume = 0;
    let liquidityEstimate = 0;
    const now = Date.now() / 1000;
    const oneDayAgo = now - 86400;
    
    for (const tx of transactions) {
      const txTime = tx.timestamp;
      
      // Count 24h volume
      if (txTime >= oneDayAgo) {
        // Estimate volume from transaction amounts
        if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          for (const transfer of tx.tokenTransfers) {
            if (transfer.mint === tokenAddress) {
              totalVolume += transfer.tokenAmount || 0;
            }
          }
        }
      }
      
      // Estimate liquidity from largest transactions
      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          const amount = transfer.amount / 1e9; // Convert lamports to SOL
          if (amount > liquidityEstimate) {
            liquidityEstimate = amount;
          }
        }
      }
    }
    
    return {
      liquidity: liquidityEstimate * 150, // Rough SOL to USD conversion
      volume24h: totalVolume * 0.001, // Rough token to USD conversion
      transactions: transactions.length
    };
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching transaction data:', error.message);
    return { liquidity: 0, volume24h: 0, transactions: 0 };
  }
}

/**
 * Main function: Fetch comprehensive token data from Helius
 */
export async function fetchTokenDataFromHelius(tokenAddress) {
  console.log(`[HELIUS] 🔍 Fetching data for token: ${tokenAddress}`);
  
  try {
    // Fetch all data in parallel
    const [metadata, accountInfo, supply, holders, txData] = await Promise.all([
      fetchTokenMetadata(tokenAddress),
      fetchTokenAccountInfo(tokenAddress),
      fetchTokenSupply(tokenAddress),
      fetchTokenHolders(tokenAddress),
      fetchTransactionData(tokenAddress)
    ]);
    
    // Compile comprehensive token data
    const tokenData = {
      address: tokenAddress,
      
      // Basic info
      name: metadata?.account?.data?.parsed?.info?.name || metadata?.account?.data?.name || metadata?.onChainMetadata?.metadata?.data?.name || metadata?.name || 'Unknown',      symbol: metadata?.account?.data?.symbol || 'UNKNOWN',
      decimals: metadata?.account?.data?.decimals || 9,
      
      // Supply
      supply: supply?.uiAmount || 0,
      
      // Metrics
      liquidity: txData.liquidity,
      volume24h: txData.volume24h,
      holders: holders,
      transactions: txData.transactions,
      
      // Social (from metadata if available)
      website: metadata?.account?.data?.uri || null,
      twitter: null, // Not available from Helius
      telegram: null, // Not available from Helius
      
      // Price (not directly available, estimate from liquidity)
      price: txData.liquidity > 0 ? txData.liquidity / (supply?.uiAmount || 1) : 0,
      marketCap: (txData.liquidity / (supply?.uiAmount || 1)) * (supply?.uiAmount || 0),
      
      // Metadata
      source: 'helius',
      fetchedAt: new Date().toISOString()
    };
    
    console.log(`[HELIUS] ✅ Successfully fetched token data`);
    console.log(`[HELIUS] 💰 Liquidity: $${tokenData.liquidity.toFixed(2)}`);
    console.log(`[HELIUS] 📈 Volume 24h: $${tokenData.volume24h.toFixed(2)}`);
    console.log(`[HELIUS] 👥 Holders: ${tokenData.holders}`);
    console.log(`[HELIUS] 🔄 Transactions: ${tokenData.transactions}`);
    
    return tokenData;
    
  } catch (error) {
    console.error('[HELIUS] ❌ Error fetching token data:', error);
    return null;
  }
}

/**
 * Fetch token data with retry logic
 */
export async function fetchTokenDataFromHeliusWithRetry(tokenAddress, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[HELIUS] 🔄 Attempt ${attempt}/${maxRetries} for ${tokenAddress}`);
    
    const data = await fetchTokenDataFromHelius(tokenAddress);
    
    // Check if we got meaningful data
    if (data && (data.liquidity > 0 || data.volume24h > 0 || data.holders > 0)) {
      console.log(`[HELIUS] ✅ Got meaningful data on attempt ${attempt}`);
      return data;
    }
    
    // If no data and not last attempt, wait and retry
    if (attempt < maxRetries) {
      const delay = attempt * 30000; // 30s, 60s
      console.log(`[HELIUS] ⚠️ No data yet, waiting ${delay/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`[HELIUS] ❌ Max retries reached, returning last data`);
  return await fetchTokenDataFromHelius(tokenAddress);
}
