import WebSocket from 'ws';
/** * Real-Time Token Discovery System
 * Proactively monitors Solana blockchain for new token launches
 * Aggressive noise filtering to surface only legitimate opportunities
 */

const HELIUS_WEBSOCKET_URL = process.env.HELIUS_WEBSOCKET_URL || 'wss://mainnet.helius-rpc.com';
const RAYDIUM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const ORCA_PROGRAM_ID = '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP';
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * Noise filtering thresholds
 */
const FILTERS = {
  MIN_LIQUIDITY_USD: 10000,        // $10k minimum liquidity
  MIN_HOLDERS: 50,                  // 50+ unique holders
  MIN_CONTRACT_AGE_SECONDS: 300,    // 5 minutes old (prevent instant scams)
  MIN_VOLUME_24H_USD: 5000,         // $5k daily volume
  MAX_TOP_HOLDER_PERCENT: 30,       // Top holder can't own >30%
  REQUIRE_SOCIAL_PRESENCE: true,    // Must have website or Twitter
  MIN_TRANSACTIONS: 100,            // 100+ transactions
  MAX_WALLET_CLUSTERING: 0.3        // <30% of buyers from same cluster
};

/**
 * Token discovery queue (in-memory, would use Redis in production)
 */
const discoveryQueue = [];
const processedTokens = new Set();

/**
 * Start real-time token discovery
 */
export async function startTokenDiscovery(onTokenDiscovered) {
  console.log('Starting real-time token discovery...');
  
  // Connect to Helius WebSocket
  const ws = new WebSocket(HELIUS_WEBSOCKET_URL);
  
  ws.on('open', () => {
    console.log('Connected to Helius WebSocket');
    
    // Subscribe to new token creation events
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [RAYDIUM_PROGRAM_ID, ORCA_PROGRAM_ID, PUMP_FUN_PROGRAM_ID]
        },
        {
          commitment: 'confirmed'
        }
      ]
    }));
  });
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.method === 'logsNotification') {
        const logs = message.params.result.value.logs;
        const signature = message.params.result.value.signature;
        
        // Check if this is a new pool creation
        if (isNewPoolCreation(logs)) {
          const tokenAddress = extractTokenAddress(logs);
          
          if (tokenAddress && !processedTokens.has(tokenAddress)) {
            processedTokens.add(tokenAddress);
            
            // Add to discovery queue
            discoveryQueue.push({
              tokenAddress,
              signature,
              discoveredAt: Date.now(),
              source: identifySource(logs)
            });
            
            // Process immediately
            processDiscoveryQueue(onTokenDiscovered);
          }
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error.message);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket closed, reconnecting...');
    setTimeout(() => startTokenDiscovery(onTokenDiscovered), 5000);
  });
  
  return ws;
}

/**
 * Check if logs indicate new pool creation
 */
function isNewPoolCreation(logs) {
  const creationKeywords = [
    'InitializePool',
    'CreatePool',
    'initialize',
    'create'
  ];
  
  return logs.some(log => 
    creationKeywords.some(keyword => 
      log.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Extract token address from logs
 */
function extractTokenAddress(logs) {
  // Simplified - would need proper parsing of transaction data
  const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const addresses = logs.join(' ').match(addressRegex);
  
  // Return first address that looks like a token (not program ID)
  return addresses?.find(addr => 
    addr !== RAYDIUM_PROGRAM_ID && 
    addr !== ORCA_PROGRAM_ID &&
    addr !== PUMP_FUN_PROGRAM_ID
  );
}

/**
 * Identify source (Raydium, Orca, pump.fun)
 */
function identifySource(logs) {
  const logsStr = logs.join(' ');
  
  if (logsStr.includes(RAYDIUM_PROGRAM_ID)) return 'Raydium';
  if (logsStr.includes(ORCA_PROGRAM_ID)) return 'Orca';
  if (logsStr.includes(PUMP_FUN_PROGRAM_ID)) return 'pump.fun';
  
  return 'Unknown';
}

/**
 * Process discovery queue with aggressive filtering
 */
async function processDiscoveryQueue(onTokenDiscovered) {
  if (discoveryQueue.length === 0) return;
  
  const discovery = discoveryQueue.shift();
  const { tokenAddress, signature, discoveredAt, source } = discovery;
  
  console.log(`Processing discovered token: ${tokenAddress} (${source})`);
  
  try {
    // Step 1: Quick pre-filter (contract age)
    const contractAge = await getContractAge(tokenAddress);
    if (contractAge < FILTERS.MIN_CONTRACT_AGE_SECONDS) {
      console.log(`❌ Filtered: Too new (${contractAge}s)`);
      return;
    }
    
    // Step 2: Fetch basic data
    const basicData = await fetchBasicTokenData(tokenAddress);
    
    // Step 3: Apply aggressive filters
    const filterResult = applyNoiseFilters(basicData);
    
    if (!filterResult.passed) {
      console.log(`❌ Filtered: ${filterResult.reason}`);
      return;
    }
    
    // Step 4: Volume authenticity check
    const volumeCheck = await checkVolumeAuthenticity(tokenAddress);
    if (!volumeCheck.isAuthentic) {
      console.log(`❌ Filtered: Spoofed volume (${volumeCheck.reason})`);
      return;
    }
    
    // Step 5: Wallet clustering analysis (Sybil detection)
    const clusteringCheck = await checkWalletClustering(tokenAddress);
    if (clusteringCheck.clusteringScore > FILTERS.MAX_WALLET_CLUSTERING) {
      console.log(`❌ Filtered: Wallet clustering (${clusteringCheck.clusteringScore})`);
      return;
    }
    
    // Step 6: Social presence check
    if (FILTERS.REQUIRE_SOCIAL_PRESENCE) {
      const socialCheck = await checkSocialPresence(tokenAddress);
      if (!socialCheck.hasPresence) {
        console.log(`❌ Filtered: No social presence`);
        return;
      }
    }
    
    // Passed all filters! This is a potential gem
    console.log(`✅ DISCOVERED GEM: ${tokenAddress}`);
    
    // Calculate gem score
    const gemScore = calculateGemScore(basicData, volumeCheck, clusteringCheck);
    
    // Notify callback
    if (onTokenDiscovered) {
      onTokenDiscovered({
        tokenAddress,
        signature,
        discoveredAt,
        source,
        basicData,
        gemScore,
        filters: {
          volumeAuthenticity: volumeCheck,
          walletClustering: clusteringCheck,
          socialPresence: socialCheck
        }
      });
    }
  } catch (error) {
    console.error(`Error processing ${tokenAddress}:`, error.message);
  }
}

/**
 * Get contract age in seconds
 */
async function getContractAge(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solscan.io/token/meta?token=${tokenAddress}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      }
    );
    
    if (!response.ok) return 0;
    
    const data = await response.json();
    const createdTime = data.data?.created_time || 0;
    const now = Math.floor(Date.now() / 1000);
    
    return now - createdTime;
  } catch (error) {
    return 0;
  }
}

/**
 * Fetch basic token data for filtering
 */
async function fetchBasicTokenData(tokenAddress) {
  // Fetch from multiple sources in parallel
  const [birdeyeData, solscanData] = await Promise.allSettled([
    fetchBirdeyeQuick(tokenAddress),
    fetchSolscanQuick(tokenAddress)
  ]);
  
  const birdeye = birdeyeData.status === 'fulfilled' ? birdeyeData.value : null;
  const solscan = solscanData.status === 'fulfilled' ? solscanData.value : null;
  
  return {
    name: solscan?.name || 'Unknown',
    symbol: solscan?.symbol || 'UNKNOWN',
    liquidity_usd: birdeye?.liquidity || 0,
    volume_24h_usd: birdeye?.volume24h || 0,
    holder_count: solscan?.holder || 0,
    price_usd: birdeye?.price || 0,
    market_cap_usd: birdeye?.marketCap || 0,
    transaction_count: solscan?.txCount || 0,
    top_holder_percent: solscan?.topHolderPercent || 0
  };
}

/**
 * Quick Birdeye data fetch (minimal fields)
 */
async function fetchBirdeyeQuick(tokenAddress) {
  try {
    const response = await fetch(
      `https://public-api.birdeye.so/public/token_overview?address=${tokenAddress}`,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(2000)
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    return null;
  }
}

/**
 * Quick Solscan data fetch
 */
async function fetchSolscanQuick(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solscan.io/token/meta?token=${tokenAddress}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000)
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    return null;
  }
}

/**
 * Apply noise filters
 */
function applyNoiseFilters(data) {
  // Liquidity check
  if (data.liquidity_usd < FILTERS.MIN_LIQUIDITY_USD) {
    return {
      passed: false,
      reason: `Low liquidity ($${data.liquidity_usd.toFixed(0)} < $${FILTERS.MIN_LIQUIDITY_USD})`
    };
  }
  
  // Holder count check
  if (data.holder_count < FILTERS.MIN_HOLDERS) {
    return {
      passed: false,
      reason: `Low holder count (${data.holder_count} < ${FILTERS.MIN_HOLDERS})`
    };
  }
  
  // Volume check
  if (data.volume_24h_usd < FILTERS.MIN_VOLUME_24H_USD) {
    return {
      passed: false,
      reason: `Low volume ($${data.volume_24h_usd.toFixed(0)} < $${FILTERS.MIN_VOLUME_24H_USD})`
    };
  }
  
  // Transaction count check
  if (data.transaction_count < FILTERS.MIN_TRANSACTIONS) {
    return {
      passed: false,
      reason: `Low transaction count (${data.transaction_count} < ${FILTERS.MIN_TRANSACTIONS})`
    };
  }
  
  // Top holder concentration check
  if (data.top_holder_percent > FILTERS.MAX_TOP_HOLDER_PERCENT) {
    return {
      passed: false,
      reason: `Top holder owns ${data.top_holder_percent}% (>${FILTERS.MAX_TOP_HOLDER_PERCENT}%)`
    };
  }
  
  return { passed: true };
}

/**
 * Check volume authenticity (detect wash trading)
 */
async function checkVolumeAuthenticity(tokenAddress) {
  try {
    // Get recent transactions
    const response = await fetch(
      `https://api.solscan.io/account/transactions?address=${tokenAddress}&limit=100`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      }
    );
    
    if (!response.ok) {
      return { isAuthentic: true, reason: 'Unable to verify' };
    }
    
    const data = await response.json();
    const txs = data.data || [];
    
    // Analyze transaction patterns
    const uniqueBuyers = new Set();
    const uniqueSellers = new Set();
    let washTradingCount = 0;
    
    txs.forEach(tx => {
      if (tx.type === 'BUY') uniqueBuyers.add(tx.from);
      if (tx.type === 'SELL') uniqueSellers.add(tx.to);
      
      // Check if same wallet is buying and selling
      if (uniqueBuyers.has(tx.to) && uniqueSellers.has(tx.from)) {
        washTradingCount++;
      }
    });
    
    const washTradingRatio = washTradingCount / txs.length;
    
    // If >30% of transactions are wash trading, flag as inauthentic
    if (washTradingRatio > 0.3) {
      return {
        isAuthentic: false,
        reason: `${(washTradingRatio * 100).toFixed(1)}% wash trading detected`,
        washTradingRatio
      };
    }
    
    // Check trade size distribution (natural vs manipulated)
    const tradeSizes = txs.map(tx => tx.amount || 0).filter(a => a > 0);
    const avgTradeSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
    const similarSizeTrades = tradeSizes.filter(size => 
      Math.abs(size - avgTradeSize) < avgTradeSize * 0.1
    ).length;
    
    // If >70% of trades are similar size, likely bot manipulation
    const similarSizeRatio = similarSizeTrades / tradeSizes.length;
    if (similarSizeRatio > 0.7) {
      return {
        isAuthentic: false,
        reason: `${(similarSizeRatio * 100).toFixed(1)}% trades are similar size (bot manipulation)`,
        similarSizeRatio
      };
    }
    
    return {
      isAuthentic: true,
      washTradingRatio,
      similarSizeRatio,
      uniqueBuyers: uniqueBuyers.size,
      uniqueSellers: uniqueSellers.size
    };
  } catch (error) {
    return { isAuthentic: true, reason: 'Unable to verify' };
  }
}

/**
 * Check wallet clustering (Sybil detection)
 */
async function checkWalletClustering(tokenAddress) {
  try {
    // Get top holders
    const response = await fetch(
      `https://api.solscan.io/token/holders?token=${tokenAddress}&limit=50`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      }
    );
    
    if (!response.ok) {
      return { clusteringScore: 0, reason: 'Unable to verify' };
    }
    
    const data = await response.json();
    const holders = data.data || [];
    
    // Analyze wallet creation times (clustered creation = Sybil)
    // Simplified - would need full wallet history
    
    // For now, check if top holders have similar balances (indicator of Sybil)
    const balances = holders.map(h => h.amount);
    const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
    const similarBalances = balances.filter(bal => 
      Math.abs(bal - avgBalance) < avgBalance * 0.2
    ).length;
    
    const clusteringScore = similarBalances / holders.length;
    
    return {
      clusteringScore,
      similarBalanceCount: similarBalances,
      totalHolders: holders.length,
      isSuspicious: clusteringScore > FILTERS.MAX_WALLET_CLUSTERING
    };
  } catch (error) {
    return { clusteringScore: 0, reason: 'Unable to verify' };
  }
}

/**
 * Check social presence (website, Twitter, Telegram)
 */
async function checkSocialPresence(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solscan.io/token/meta?token=${tokenAddress}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000)
      }
    );
    
    if (!response.ok) {
      return { hasPresence: false };
    }
    
    const data = await response.json();
    const meta = data.data || {};
    
    const hasWebsite = !!meta.website;
    const hasTwitter = !!meta.twitter;
    const hasTelegram = !!meta.telegram;
    
    return {
      hasPresence: hasWebsite || hasTwitter || hasTelegram,
      website: meta.website,
      twitter: meta.twitter,
      telegram: meta.telegram
    };
  } catch (error) {
    return { hasPresence: false };
  }
}

/**
 * Calculate gem score (0-100)
 */
function calculateGemScore(basicData, volumeCheck, clusteringCheck) {
  let score = 0;
  
  // Liquidity (20 points)
  if (basicData.liquidity_usd >= 100000) score += 20;
  else if (basicData.liquidity_usd >= 50000) score += 15;
  else if (basicData.liquidity_usd >= 10000) score += 10;
  
  // Holder count (20 points)
  if (basicData.holder_count >= 500) score += 20;
  else if (basicData.holder_count >= 200) score += 15;
  else if (basicData.holder_count >= 50) score += 10;
  
  // Volume authenticity (25 points)
  if (volumeCheck.isAuthentic) {
    score += 25;
    if (volumeCheck.washTradingRatio < 0.1) score += 5; // Bonus for very clean volume
  }
  
  // Wallet clustering (20 points)
  if (clusteringCheck.clusteringScore < 0.1) score += 20;
  else if (clusteringCheck.clusteringScore < 0.2) score += 15;
  else if (clusteringCheck.clusteringScore < 0.3) score += 10;
  
  // Top holder distribution (15 points)
  if (basicData.top_holder_percent < 10) score += 15;
  else if (basicData.top_holder_percent < 20) score += 10;
  else if (basicData.top_holder_percent < 30) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Get discovery statistics
 */
export function getDiscoveryStats() {
  return {
    total_discovered: processedTokens.size,
    queue_length: discoveryQueue.length,
    filters_applied: Object.keys(FILTERS).length
  };
}
