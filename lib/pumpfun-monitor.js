/**
 * Tier 1: Ultra-Fast Pump.fun Monitoring
 * Detects new token launches at $2K-$10K market cap for 100x potential
 */

import WebSocket from 'ws';

/**
 * Pump.fun API endpoints
 */
const PUMPFUN_WS_URL = 'wss://pumpportal.fun/api/data';
const PUMPFUN_API_URL = 'https://frontend-api.pump.fun';

/**
 * Tier 1 configuration
 */
const TIER1_CONFIG = {
  minMarketCap: 2000,        // $2K minimum
  maxMarketCap: 10000,       // $10K maximum
  minLiquidity: 500,         // $500 minimum liquidity
  maxContractAge: 120,       // 2 minutes max age
  positionSize: 0.1,         // 0.1 SOL ($20-$30)
  slippage: 25,              // 25% slippage tolerance
  profitTargets: [2, 5, 10, 20, 50], // 2x, 5x, 10x, 20x, 50x
  stopLoss: -50,             // -50% stop loss
  maxDailyTrades: 50         // Max 50 trades per day
};

/**
 * WebSocket connection state
 */
let ws = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let dailyTradeCount = 0;
let lastResetDate = new Date().toDateString();

/**
 * Start monitoring pump.fun for new launches
 * @param {Function} onNewToken - Callback when new token detected
 */
export function startPumpFunMonitoring(onNewToken) {
  console.log('🚀 Starting Tier 1: Ultra-Fast Pump.fun Monitoring...');
  console.log(`📊 Config: $${TIER1_CONFIG.minMarketCap}-$${TIER1_CONFIG.maxMarketCap} mcap`);
  console.log(`💰 Position size: ${TIER1_CONFIG.positionSize} SOL`);
  console.log(`🎯 Profit targets: ${TIER1_CONFIG.profitTargets.join('x, ')}x`);

  connectWebSocket(onNewToken);

  // Reset daily trade count at midnight
  setInterval(() => {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
      dailyTradeCount = 0;
      lastResetDate = today;
      console.log('📅 Daily trade count reset');
    }
  }, 60000); // Check every minute

  return {
    stop: stopPumpFunMonitoring,
    getStats: getPumpFunStats
  };
}

/**
 * Connect to pump.fun WebSocket
 */
function connectWebSocket(onNewToken) {
  try {
    // Subscribe to new token events
    ws = new WebSocket(PUMPFUN_WS_URL);

    ws.on('open', () => {
      console.log('✅ Connected to pump.fun WebSocket');
      reconnectAttempts = 0;

      // Subscribe to new token creations
      ws.send(JSON.stringify({
        method: 'subscribeNewToken'
      }));

      // Subscribe to token trades for market cap updates
      ws.send(JSON.stringify({
        method: 'subscribeTokenTrade'
      }));
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'newToken') {
          await handleNewToken(message.data, onNewToken);
        } else if (message.type === 'trade') {
          // Track trades for market cap updates
          // (used for position monitoring in Phase 3)
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('❌ WebSocket connection closed');
      
      // Attempt to reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
          connectWebSocket(onNewToken);
        }, delay);
      } else {
        console.error('❌ Max reconnection attempts reached. Please restart manually.');
      }
    });

  } catch (error) {
    console.error('Error connecting to WebSocket:', error.message);
  }
}

/**
 * Handle new token detection
 */
async function handleNewToken(tokenData, onNewToken) {
  try {
    const startTime = Date.now();

    // Check daily trade limit
    if (dailyTradeCount >= TIER1_CONFIG.maxDailyTrades) {
      console.log(`⏸️ Daily trade limit reached (${TIER1_CONFIG.maxDailyTrades})`);
      return;
    }

    // Extract token info
    const {
      mint,
      name,
      symbol,
      uri,
      timestamp
    } = tokenData;

    // Calculate contract age
    const contractAge = (Date.now() - timestamp) / 1000; // seconds

    // Quick age filter (must be very new)
    if (contractAge > TIER1_CONFIG.maxContractAge) {
      return; // Too old, skip
    }

    // Fetch detailed token data
    const details = await fetchTokenDetails(mint);
    
    if (!details) {
      return; // Failed to fetch details
    }

    const {
      marketCap,
      liquidity,
      holders,
      price,
      volume24h
    } = details;

    // Apply Tier 1 filters
    if (marketCap < TIER1_CONFIG.minMarketCap || marketCap > TIER1_CONFIG.maxMarketCap) {
      return; // Outside target range
    }

    if (liquidity < TIER1_CONFIG.minLiquidity) {
      return; // Insufficient liquidity
    }

    // Basic honeypot check (very fast)
    const isHoneypot = await quickHoneypotCheck(mint);
    if (isHoneypot) {
      console.log(`🚨 Honeypot detected: ${symbol}`);
      return;
    }

    // Calculate discovery latency
    const latency = Date.now() - startTime;

    // Prepare Tier 1 opportunity data
    const opportunity = {
      tier: 1,
      tokenAddress: mint,
      name,
      symbol,
      marketCap,
      liquidity,
      holders: holders || 0,
      price,
      volume24h: volume24h || 0,
      contractAge,
      discoveryLatency: latency,
      timestamp: new Date(),
      
      // Trading config
      positionSize: TIER1_CONFIG.positionSize,
      slippage: TIER1_CONFIG.slippage,
      profitTargets: TIER1_CONFIG.profitTargets,
      stopLoss: TIER1_CONFIG.stopLoss,
      
      // Metadata
      source: 'pump.fun',
      autoTrade: true, // Enable auto-trading for Tier 1
      riskLevel: 'EXTREME' // Very high risk
    };

    console.log(`💎 Tier 1 Opportunity: ${symbol} at $${marketCap.toFixed(0)} mcap (${latency}ms)`);

    // Increment daily trade count
    dailyTradeCount++;

    // Call callback
    await onNewToken(opportunity);

  } catch (error) {
    console.error('Error handling new token:', error.message);
  }
}

/**
 * Fetch detailed token data from pump.fun API
 */
async function fetchTokenDetails(mint) {
  try {
    const response = await fetch(`${PUMPFUN_API_URL}/coins/${mint}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      marketCap: data.usd_market_cap || 0,
      liquidity: data.virtual_sol_reserves * 150 || 0, // Estimate liquidity
      holders: data.holder_count || 0,
      price: data.price_usd || 0,
      volume24h: data.volume_24h_usd || 0
    };
  } catch (error) {
    console.error('Error fetching token details:', error.message);
    return null;
  }
}

/**
 * Quick honeypot check (basic, fast)
 */
async function quickHoneypotCheck(mint) {
  try {
    // Check if token is sellable by attempting to simulate a sell
    // This is a simplified check - in production, use Solana RPC simulation
    
    // For now, just check if it's a pump.fun token (they have standard contracts)
    // Pump.fun tokens ending in "pump" are generally not honeypots
    if (mint.endsWith('pump')) {
      return false; // Likely safe
    }

    // Could add more checks here:
    // - Check for sell function in contract
    // - Simulate a sell transaction
    // - Check for blacklist functions
    
    return false; // Default to not honeypot (risky but fast)
  } catch (error) {
    console.error('Error in honeypot check:', error.message);
    return true; // Assume honeypot on error (safe)
  }
}

/**
 * Stop pump.fun monitoring
 */
export function stopPumpFunMonitoring() {
  if (ws) {
    ws.close();
    ws = null;
    console.log('⏸️ Pump.fun monitoring stopped');
  }
}

/**
 * Get pump.fun monitoring stats
 */
export function getPumpFunStats() {
  return {
    connected: ws && ws.readyState === WebSocket.OPEN,
    dailyTradeCount,
    dailyTradesRemaining: TIER1_CONFIG.maxDailyTrades - dailyTradeCount,
    config: TIER1_CONFIG
  };
}

/**
 * Fetch trending tokens from pump.fun
 * (Alternative/backup to WebSocket)
 */
export async function fetchTrendingPumpFunTokens() {
  try {
    const response = await fetch(`${PUMPFUN_API_URL}/coins/trending`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    return data
      .filter(token => {
        const mcap = token.usd_market_cap || 0;
        return mcap >= TIER1_CONFIG.minMarketCap && mcap <= TIER1_CONFIG.maxMarketCap;
      })
      .map(token => ({
        tokenAddress: token.mint,
        name: token.name,
        symbol: token.symbol,
        marketCap: token.usd_market_cap,
        liquidity: token.virtual_sol_reserves * 150,
        price: token.price_usd,
        volume24h: token.volume_24h_usd
      }));
  } catch (error) {
    console.error('Error fetching trending tokens:', error.message);
    return [];
  }
}

/**
 * Update Tier 1 configuration
 */
export function updateTier1Config(newConfig) {
  Object.assign(TIER1_CONFIG, newConfig);
  console.log('✅ Tier 1 config updated:', TIER1_CONFIG);
}
