import WebSocket from 'ws';
import { calculateGemScore, getScoreInterpretation } from './token-scorer.mjs';

/**
 * Real-Time Token Discovery System with AI Scoring
 * Monitors Solana blockchain and scores tokens automatically
 */

const HELIUS_WEBSOCKET_URL = process.env.HELIUS_WEBSOCKET_URL || 'wss://mainnet.helius-rpc.com';
const RAYDIUM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const ORCA_PROGRAM_ID = '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP';
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

// WebSocket keep-alive configuration
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;
const MAX_MISSED_PONGS = 3;

// Discovery statistics
let stats = {
  tokensDiscovered: 0,
  tokensScored: 0,
  scoringErrors: 0,
  averageScore: 0,
  highScoreCount: 0  // Tokens with score >= 80
};

// WebSocket connection state for each DEX
const connections = {
  raydium: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false },
  orca: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false },
  pumpfun: { ws: null, pingInterval: null, pongTimeout: null, missedPongs: 0, isReconnecting: false }
};

const programToConnection = {
  [RAYDIUM_PROGRAM_ID]: 'raydium',
  [ORCA_PROGRAM_ID]: 'orca',
  [PUMP_FUN_PROGRAM_ID]: 'pumpfun'
};

const processedTokens = new Set();

/**
 * Start real-time token discovery with scoring
 */
export async function startTokenDiscovery(onTokenDiscovered) {
  console.log('[GEM-HUNTER] Starting real-time token discovery with AI scoring...');
  
  await startDexConnection('raydium', RAYDIUM_PROGRAM_ID, onTokenDiscovered);
  await startDexConnection('orca', ORCA_PROGRAM_ID, onTokenDiscovered);
  await startDexConnection('pumpfun', PUMP_FUN_PROGRAM_ID, onTokenDiscovered);
  
  console.log('[GEM-HUNTER] ✅ All DEX connections initialized with scoring engine');
}

/**
 * Start WebSocket connection for a specific DEX
 */
async function startDexConnection(dexName, programId, onTokenDiscovered) {
  const conn = connections[dexName];
  
  if (conn.isReconnecting) {
    return;
  }
  
  conn.isReconnecting = true;
  cleanupConnection(dexName);
  
  conn.ws = new WebSocket(HELIUS_WEBSOCKET_URL);
  
  conn.ws.on('open', () => {
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Connected to Helius WebSocket`);
    conn.isReconnecting = false;
    conn.missedPongs = 0;
    
    // Subscribe to logs for this program
    conn.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: `${dexName}-subscription`,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [programId]
        },
        {
          commitment: 'confirmed'
        }
      ]
    }));
    
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Subscription request sent for program ${programId}`);
    
    // Start keep-alive
    setupKeepAlive(dexName);
  });
  
  conn.ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      // Handle subscription confirmation
      if (message.result) {
        console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: ✅ Subscription confirmed! ID: ${message.result}`);
        return;
      }
      
      // Handle log notifications
      if (message.params && message.params.result) {
        const logs = message.params.result.value.logs;
        
        // Extract token address from logs
        const tokenAddress = extractTokenAddress(logs);
        
        if (tokenAddress && !processedTokens.has(tokenAddress)) {
          processedTokens.add(tokenAddress);
          stats.tokensDiscovered++;
          
          console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: 💎 New token discovered: ${tokenAddress}`);
          
          // Score the token automatically
          await scoreAndNotify(tokenAddress, dexName, onTokenDiscovered);
        }
      }
      
      // Handle pong responses
      if (message.method === 'pong') {
        clearTimeout(conn.pongTimeout);
        conn.missedPongs = 0;
      }
      
    } catch (error) {
      console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: Error processing message:`, error);
    }
  });
  
  conn.ws.on('error', (error) => {
    console.error(`[GEM-HUNTER] ${dexName.toUpperCase()}: WebSocket error:`, error.message);
  });
  
  conn.ws.on('close', () => {
    console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Connection closed, reconnecting...`);
    cleanupConnection(dexName);
    setTimeout(() => startDexConnection(dexName, programId, onTokenDiscovered), 5000);
  });
}

/**
 * Score token and notify if it's a gem
 */
async function scoreAndNotify(tokenAddress, source, onTokenDiscovered) {
  try {
    console.log(`[GEM-HUNTER] Scoring token: ${tokenAddress}`);
    
    // Calculate gem score
    const scoreResult = await calculateGemScore(tokenAddress);
    
    if (scoreResult.error) {
      console.log(`[GEM-HUNTER] ⚠️ Scoring error for ${tokenAddress}: ${scoreResult.error}`);
      stats.scoringErrors++;
      return;
    }
    
    stats.tokensScored++;
    
    // Update average score
    stats.averageScore = ((stats.averageScore * (stats.tokensScored - 1)) + scoreResult.score) / stats.tokensScored;
    
    if (scoreResult.score >= 80) {
      stats.highScoreCount++;
    }
    
    const interpretation = getScoreInterpretation(scoreResult.score);
    console.log(`[GEM-HUNTER] Token ${tokenAddress} scored ${scoreResult.score}/100 - ${interpretation}`);
    console.log(`[GEM-HUNTER] Score breakdown:`, scoreResult.breakdown);
    
    // Prepare gem data with scoring information
    const gemData = {
      tokenAddress,
      source,
      gemScore: scoreResult.score,
      scoreBreakdown: scoreResult.breakdown,
      interpretation,
      basicData: {
        name: scoreResult.data?.name || 'Unknown',
        symbol: scoreResult.data?.symbol || 'N/A',
        decimals: scoreResult.data?.decimals || 0
      },
      metrics: {
        liquidity: scoreResult.data?.liquidity || 0,
        volume24h: scoreResult.data?.v24hUSD || 0,
        holders: scoreResult.data?.holder || 0,
        marketCap: scoreResult.data?.mc || 0,
        priceChange24h: scoreResult.data?.v24hChangePercent || 0
      },
      social: {
        website: scoreResult.data?.extensions?.website || null,
        twitter: scoreResult.data?.extensions?.twitter || null,
        telegram: scoreResult.data?.extensions?.telegram || null,
        discord: scoreResult.data?.extensions?.discord || null
      },
      discoveredAt: new Date().toISOString()
    };
    
    // Notify callback with scored gem data
    if (onTokenDiscovered) {
      onTokenDiscovered(gemData);
    }
    
  } catch (error) {
    console.error(`[GEM-HUNTER] Error scoring token ${tokenAddress}:`, error);
    stats.scoringErrors++;
  }
}

/**
 * Extract token address from transaction logs
 */
function extractTokenAddress(logs) {
  // Look for token mint addresses in logs
  for (const log of logs) {
    // Pattern matching for Solana addresses (base58, 32-44 chars)
    const addressMatch = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (addressMatch) {
      return addressMatch[0];
    }
  }
  return null;
}

/**
 * Setup keep-alive ping/pong
 */
function setupKeepAlive(dexName) {
  const conn = connections[dexName];
  
  conn.pingInterval = setInterval(() => {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({ method: 'ping' }));
      
      conn.pongTimeout = setTimeout(() => {
        conn.missedPongs++;
        console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Missed pong (${conn.missedPongs}/${MAX_MISSED_PONGS})`);
        
        if (conn.missedPongs >= MAX_MISSED_PONGS) {
          console.log(`[GEM-HUNTER] ${dexName.toUpperCase()}: Too many missed pongs, reconnecting...`);
          conn.ws.close();
        }
      }, PONG_TIMEOUT_MS);
    }
  }, PING_INTERVAL_MS);
}

/**
 * Cleanup connection resources
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
    conn.ws.removeAllListeners();
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close();
    }
    conn.ws = null;
  }
}

/**
 * Get discovery statistics including scoring metrics
 */
export function getDiscoveryStats() {
  return {
    ...stats,
    averageScore: Math.round(stats.averageScore * 10) / 10,
    scoringSuccessRate: stats.tokensDiscovered > 0 
      ? ((stats.tokensScored / stats.tokensDiscovered) * 100).toFixed(1) + '%'
      : '0%',
    highScoreRate: stats.tokensScored > 0
      ? ((stats.highScoreCount / stats.tokensScored) * 100).toFixed(1) + '%'
      : '0%'
  };
}

/**
 * Stop all discovery connections
 */
export function stopTokenDiscovery() {
  console.log('[GEM-HUNTER] Stopping token discovery...');
  
  Object.keys(connections).forEach(dexName => {
    cleanupConnection(dexName);
  });
  
  console.log('[GEM-HUNTER] ✅ All connections stopped');
}
