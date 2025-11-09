import WebSocket from 'ws';

/**
 * Real-Time Token Discovery System
 * Proactively monitors Solana blockchain for new token launches
 * Aggressive noise filtering to surface only legitimate opportunities
 * 
 * FIXED: Added WebSocket keep-alive mechanism to prevent 5-minute disconnections
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

// WebSocket connection state
let ws = null;
let pingInterval = null;
let pongTimeout = null;
let missedPongs = 0;
let connectionStartTime = null;
let isReconnecting = false;

/**
 * Start real-time token discovery with persistent connection
 */
export async function startTokenDiscovery(onTokenDiscovered) {
  console.log('[GEM-HUNTER] Starting real-time token discovery...');
  
  // Prevent multiple simultaneous reconnection attempts
  if (isReconnecting) {
    console.log('[GEM-HUNTER] Reconnection already in progress, skipping...');
    return;
  }
  
  isReconnecting = true;
  
  // Clean up any existing connection
  cleanupConnection();
  
  // Connect to Helius WebSocket
  ws = new WebSocket(HELIUS_WEBSOCKET_URL);
  connectionStartTime = Date.now();
  
  ws.on('open', () => {
    console.log('[GEM-HUNTER] Connected to Helius WebSocket');
    isReconnecting = false;
    missedPongs = 0;
    
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
    
    // Start keep-alive ping mechanism
    startKeepAlive();
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
            
            console.log(`[GEM-HUNTER] 💎 New token discovered: ${tokenAddress}`);
            
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
      console.error('[GEM-HUNTER ERROR] WebSocket message error:', error.message);
    }
  });
  
  ws.on('pong', () => {
    // Reset missed pongs counter on successful pong
    missedPongs = 0;
    
    // Clear pong timeout
    if (pongTimeout) {
      clearTimeout(pongTimeout);
      pongTimeout = null;
    }
    
    // Log connection health at debug level (optional)
    const uptime = Math.floor((Date.now() - connectionStartTime) / 1000);
    if (uptime % 300 === 0) { // Log every 5 minutes
      console.log(`[GEM-HUNTER] WebSocket connection healthy (uptime: ${uptime}s)`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[GEM-HUNTER ERROR] WebSocket error:', error.message);
  });
  
  ws.on('close', (code, reason) => {
    const uptime = Math.floor((Date.now() - connectionStartTime) / 1000);
    console.log(`[GEM-HUNTER] WebSocket closed after ${uptime}s (code: ${code}, reason: ${reason || 'none'})`);
    
    // Clean up timers
    cleanupConnection();
    
    // Reconnect with exponential backoff
    const reconnectDelay = Math.min(5000 * Math.pow(2, missedPongs), 60000);
    console.log(`[GEM-HUNTER] Reconnecting in ${reconnectDelay / 1000}s...`);
    
    setTimeout(() => {
      startTokenDiscovery(onTokenDiscovered);
    }, reconnectDelay);
  });
  
  return ws;
}

/**
 * Start WebSocket keep-alive mechanism
 * Sends ping every 30 seconds to prevent idle timeout
 */
function startKeepAlive() {
  // Clear any existing interval
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send ping
      ws.ping();
      
      // Set timeout for pong response
      pongTimeout = setTimeout(() => {
        missedPongs++;
        console.warn(`[GEM-HUNTER WARNING] Missed pong response (${missedPongs}/${MAX_MISSED_PONGS})`);
        
        // Force reconnection if too many pongs missed
        if (missedPongs >= MAX_MISSED_PONGS) {
          console.error('[GEM-HUNTER ERROR] Connection appears dead, forcing reconnection...');
          ws.terminate();
        }
      }, PONG_TIMEOUT_MS);
    } else {
      console.warn('[GEM-HUNTER WARNING] WebSocket not open, skipping ping');
    }
  }, PING_INTERVAL_MS);
}

/**
 * Clean up WebSocket connection and timers
 */
function cleanupConnection() {
  // Clear ping interval
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  // Clear pong timeout
  if (pongTimeout) {
    clearTimeout(pongTimeout);
    pongTimeout = null;
  }
  
  // Close WebSocket if still open
  if (ws) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.terminate();
    }
    ws = null;
  }
}

/**
 * Graceful shutdown
 */
export function stopTokenDiscovery() {
  console.log('[GEM-HUNTER] Stopping token discovery...');
  cleanupConnection();
  isReconnecting = false;
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
 * Extract token address from transaction logs
 */
function extractTokenAddress(logs) {
  // Parse logs to find token mint address
  // This is a simplified version - actual implementation would be more robust
  for (const log of logs) {
    const match = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Identify the source DEX from logs
 */
function identifySource(logs) {
  const logString = logs.join(' ');
  
  if (logString.includes(RAYDIUM_PROGRAM_ID)) {
    return 'Raydium';
  } else if (logString.includes(ORCA_PROGRAM_ID)) {
    return 'Orca';
  } else if (logString.includes(PUMP_FUN_PROGRAM_ID)) {
    return 'pump.fun';
  }
  
  return 'Unknown';
}

/**
 * Process discovery queue
 */
async function processDiscoveryQueue(onTokenDiscovered) {
  while (discoveryQueue.length > 0) {
    const discovery = discoveryQueue.shift();
    
    try {
      console.log(`[GEM-HUNTER] Analyzing token from ${discovery.source}: ${discovery.tokenAddress}`);
      
      // Call the callback with discovered token
      if (onTokenDiscovered) {
        await onTokenDiscovered(discovery);
      }
    } catch (error) {
      console.error(`[GEM-HUNTER ERROR] Error processing token ${discovery.tokenAddress}:`, error.message);
    }
  }
}

// Export filters for use in other modules
export { FILTERS };

/**
 * Get discovery statistics
 */
export function getDiscoveryStats() {
  const uptime = connectionStartTime ? Math.floor((Date.now() - connectionStartTime) / 1000) : 0;
  
  return {
    isConnected: ws && ws.readyState === WebSocket.OPEN,
    uptime,
    processedTokens: processedTokens.size,
    queueLength: discoveryQueue.length,
    missedPongs,
    isReconnecting
  };
}
