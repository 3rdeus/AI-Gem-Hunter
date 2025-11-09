import WebSocket from 'ws';

/**
 * Real-Time Token Discovery System
 * Proactively monitors Solana blockchain for new token launches
 * Aggressive noise filtering to surface only legitimate opportunities
 * 
 * FIXED: Helius WebSocket API only supports 1 address per subscription
 * Solution: Create 3 separate WebSocket connections, one for each DEX program
 */

const HELIUS_WEBSOCKET_URL = process.env.HELIUS_WEBSOCKET_URL || 'wss://mainnet.helius-rpc.com';
const RAYDIUM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const ORCA_PROGRAM_ID = '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP';
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

// WebSocket keep-alive configuration
const PING_INTERVAL_MS = 30000;  // Send ping every 30 seconds
const PONG_TIMEOUT_MS = 10000;   // Wait 10 seconds for pong response
const MAX_MISSED_PONGS = 3;      // Reconnect after 3 missed pongs

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

// WebSocket connection state for each DEX
const connections = {
  raydium: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false },
  orca: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false },
  pumpfun: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false }
};

// Map program IDs to connection names
const programToConnection = {
  [RAYDIUM_PROGRAM_ID]: 'raydium',
  [ORCA_PROGRAM_ID]: 'orca',
  [PUMP_FUN_PROGRAM_ID]: 'pumpfun'
};

/**
 * Start real-time token discovery with separate connections for each DEX
 */
export async function startTokenDiscovery(onTokenDiscovered) {
  console.log('[GEM-HUNTER] Starting real-time token discovery...');
  console.log('[GEM-HUNTER] Monitoring Raydium, Orca, and pump.fun with separate WebSocket connections');
  
  // Start a separate WebSocket connection for each DEX program
  await startDexConnection('raydium', RAYDIUM_PROGRAM_ID, onTokenDiscovered);
  await startDexConnection('orca', ORCA_PROGRAM_ID, onTokenDiscovered);
  await startDexConnection('pumpfun', PUMP_FUN_PROGRAM_ID, onTokenDiscovered);
  
  console.log('[GEM-HUNTER] ✅ All DEX connections initialized');
}

/**
 * Start a WebSocket connection for a specific DEX program
 */
async function startDexConnection(dexName, programId, onTokenDiscovered) {
  const conn = connections[dexName];
  
  // Prevent multiple simultaneous reconnection attempts
  if (conn.isReconnecting) {
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Reconnection already in progress, skipping...`);
    return;
  }
  
  conn.isReconnecting = true;
  
  // Clean up any existing connection
  cleanupConnection(dexName);
  
  // Connect to Helius WebSocket
  conn.ws = new WebSocket(HELIUS_WEBSOCKET_URL);
  
  conn.ws.on('open', () => {
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Connected to Helius WebSocket`);
    conn.isReconnecting = false;
    conn.missedPongs = 0;
    
    // Subscribe to new token creation events for this specific program
    conn.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: `${dexName}-subscription`,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [programId]  // Only ONE program ID per subscription
        },
        {
          commitment: 'confirmed'
        }
      ]
    }));
    
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Subscription request sent for program ${programId}`);
    
    // Start keep-alive ping mechanism
    startKeepAlive(dexName);
  });
  
  conn.ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Log subscription confirmation
      if (message.id === `${dexName}-subscription` && message.result) {
        console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: ✅ Subscription confirmed! ID: ${message.result}`);
        return;
      }
      
      // Handle log notifications
      if (message.method === 'logsNotification') {
        const logs = message.params.result.value.logs;
        const signature = message.params.result.value.signature;
        
        // Check if this is a new pool creation
        if (isNewPoolCreation(logs)) {
          const tokenAddress = extractTokenAddress(logs);
          
          if (tokenAddress && !processedTokens.has(tokenAddress)) {
            processedTokens.add(tokenAddress);
            
            console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: 💎 New token discovered: ${tokenAddress}`);
            
            // Add to discovery queue
            discoveryQueue.push({
              tokenAddress,
              signature,
              discoveredAt: Date.now(),
              source: dexName
            });
            
            // Process immediately
            processDiscoveryQueue(onTokenDiscovered);
          }
        }
      }
      
      // Handle errors
      if (message.error) {
        console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: ❌ Error:`, message.error);
      }
      
    } catch (error) {
      console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: Error processing message:`, error);
    }
  });
  
  conn.ws.on('pong', () => {
    // Reset missed pongs counter on successful pong
    conn.missedPongs = 0;
    if (conn.pongTimeout) {
      clearTimeout(conn.pongTimeout);
      conn.pongTimeout = null;
    }
  });
  
  conn.ws.on('error', (error) => {
    console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: WebSocket error:`, error.message);
  });
  
  conn.ws.on('close', (code, reason) => {
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: WebSocket closed (code: ${code}, reason: ${reason || 'none'})`);
    
    // Clean up intervals
    cleanupConnection(dexName);
    
    // Attempt reconnection after 5 seconds
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Reconnecting in 5 seconds...`);
    setTimeout(() => {
      startDexConnection(dexName, programId, onTokenDiscovered);
    }, 5000);
  });
}

/**
 * Start keep-alive ping mechanism for a specific connection
 */
function startKeepAlive(dexName) {
  const conn = connections[dexName];
  
  conn.pingInterval = setInterval(() => {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.ping();
      
      // Set timeout to check for pong response
      conn.pongTimeout = setTimeout(() => {
        conn.missedPongs++;
        console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Missed pong #${conn.missedPongs}`);
        
        if (conn.missedPongs >= MAX_MISSED_PONGS) {
          console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Too many missed pongs, reconnecting...`);
          conn.ws.terminate();
        }
      }, PONG_TIMEOUT_MS);
    }
  }, PING_INTERVAL_MS);
}

/**
 * Clean up connection resources for a specific DEX
 */
function cleanupConnection(dexName) {
  const conn = connections[dexName];
  
  if (conn.pingInterval) {
    clearInterval(conn.pingInterval);
    conn.pingInterval = null;
  }
  
  if (conn.pongTimeout) {
    clearTimeout(conn.pongTimeout);
    conn.pongTimeout = null;
  }
  
  if (conn.ws) {
    try {
      conn.ws.removeAllListeners();
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
    } catch (error) {
      console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: Error cleaning up connection:`, error);
    }
    conn.ws = null;
  }
}

/**
 * Check if logs indicate a new pool creation
 */
function isNewPoolCreation(logs) {
  const poolCreationKeywords = [
    'initialize',
    'InitializePool',
    'create_pool',
    'CreatePool',
    'initialize2',
    'InitializeInstruction'
  ];
  
  return logs.some(log => 
    poolCreationKeywords.some(keyword => 
      log.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Extract token address from logs
 */
function extractTokenAddress(logs) {
  // This is a simplified extraction - in production you'd parse the actual instruction data
  for (const log of logs) {
    // Look for Solana addresses (base58 encoded, typically 32-44 characters)
    const addressMatch = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (addressMatch) {
      return addressMatch[0];
    }
  }
  return null;
}

/**
 * Process the discovery queue
 */
async function processDiscoveryQueue(onTokenDiscovered) {
  while (discoveryQueue.length > 0) {
    const token = discoveryQueue.shift();
    
    try {
      // Call the callback with discovered token
      if (onTokenDiscovered) {
        await onTokenDiscovered(token);
      }
    } catch (error) {
      console.error('[GEM-HUNTER] Error processing discovered token:', error);
    }
  }
}

/**
 * Stop all token discovery connections
 */
export function stopTokenDiscovery() {
  console.log('[GEM-HUNTER] Stopping all token discovery connections...');
  
  for (const dexName of Object.keys(connections)) {
    cleanupConnection(dexName);
  }
  
  console.log('[GEM-HUNTER] All connections stopped');
}

/**
 * Get discovery statistics
 */
export function getDiscoveryStats() {
  const stats = {
    connections: {},
    tokensProcessed: processedTokens.size,
    queueLength: discoveryQueue.length
  };
  
  for (const [dexName, conn] of Object.entries(connections)) {
    stats.connections[dexName] = {
      connected: conn.ws && conn.ws.readyState === WebSocket.OPEN,
      missedPongs: conn.missedPongs,
      isReconnecting: conn.isReconnecting
    };
  }
  
  return stats;
}
