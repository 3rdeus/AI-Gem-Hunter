/**
 * Birdeye WebSocket Integration
 * Real-time price feeds for instant exit timing
 * Replaces polling with <100ms push updates
 */

import WebSocket from 'ws';

const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;

/**
 * Active WebSocket connections
 */
const activeConnections = new Map();
const priceCallbacks = new Map();

/**
 * Track token price via WebSocket
 * @param {string} tokenAddress - Token address to track
 * @param {function} onPriceUpdate - Callback for price updates
 */
export function trackTokenPrice(tokenAddress, onPriceUpdate) {
  try {
    console.log(`📡 Birdeye WS: Tracking ${tokenAddress.substring(0, 8)}...`);

    // Create WebSocket connection
    const ws = new WebSocket(BIRDEYE_WS_URL, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY
      }
    });

    ws.on('open', () => {
      console.log(`✅ Birdeye WS: Connected for ${tokenAddress.substring(0, 8)}`);

      // Subscribe to price updates
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE_PRICE',
        data: { address: tokenAddress }
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'PRICE_UPDATE') {
          const priceData = {
            price: message.data.value,
            timestamp: message.data.timestamp || Date.now(),
            marketCap: message.data.marketCap,
            volume24h: message.data.volume24h,
            priceChange24h: message.data.priceChange24h
          };

          // Call the callback
          onPriceUpdate(priceData);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Birdeye WS error for ${tokenAddress.substring(0, 8)}:`, error.message);
    });

    ws.on('close', () => {
      console.log(`🔌 Birdeye WS: Disconnected for ${tokenAddress.substring(0, 8)}`);
      activeConnections.delete(tokenAddress);

      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        console.log(`🔄 Birdeye WS: Reconnecting ${tokenAddress.substring(0, 8)}...`);
        trackTokenPrice(tokenAddress, onPriceUpdate);
      }, 5000);
    });

    // Store connection
    activeConnections.set(tokenAddress, ws);
    priceCallbacks.set(tokenAddress, onPriceUpdate);

    return {
      success: true,
      connection: ws
    };
  } catch (error) {
    console.error('Birdeye WebSocket error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Stop tracking token price
 * @param {string} tokenAddress - Token address to stop tracking
 */
export function stopTrackingPrice(tokenAddress) {
  const ws = activeConnections.get(tokenAddress);
  
  if (ws) {
    // Unsubscribe
    ws.send(JSON.stringify({
      type: 'UNSUBSCRIBE_PRICE',
      data: { address: tokenAddress }
    }));

    // Close connection
    ws.close();
    
    // Remove from maps
    activeConnections.delete(tokenAddress);
    priceCallbacks.delete(tokenAddress);

    console.log(`🛑 Stopped tracking ${tokenAddress.substring(0, 8)}`);
    
    return { success: true };
  }

  return { success: false, error: 'Connection not found' };
}

/**
 * Track multiple tokens at once
 * @param {Array} tokenAddresses - Array of token addresses
 * @param {function} onPriceUpdate - Callback for price updates
 */
export function trackMultipleTokens(tokenAddresses, onPriceUpdate) {
  const results = [];

  for (const address of tokenAddresses) {
    const result = trackTokenPrice(address, (priceData) => {
      onPriceUpdate(address, priceData);
    });
    results.push({ address, ...result });
  }

  return results;
}

/**
 * Get all active connections
 */
export function getActiveConnections() {
  return Array.from(activeConnections.keys());
}

/**
 * Close all connections
 */
export function closeAllConnections() {
  for (const [address, ws] of activeConnections.entries()) {
    ws.close();
    console.log(`🔌 Closed connection for ${address.substring(0, 8)}`);
  }

  activeConnections.clear();
  priceCallbacks.clear();

  return { success: true, count: activeConnections.size };
}

/**
 * Health check for WebSocket connections
 */
export function healthCheck() {
  const connections = Array.from(activeConnections.entries());
  const healthy = connections.filter(([_, ws]) => ws.readyState === WebSocket.OPEN);
  const unhealthy = connections.filter(([_, ws]) => ws.readyState !== WebSocket.OPEN);

  return {
    total: connections.length,
    healthy: healthy.length,
    unhealthy: unhealthy.length,
    connections: connections.map(([address, ws]) => ({
      address: address.substring(0, 8) + '...',
      state: ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'
    }))
  };
}

/**
 * Restart unhealthy connections
 */
export function restartUnhealthyConnections() {
  const connections = Array.from(activeConnections.entries());
  let restarted = 0;

  for (const [address, ws] of connections) {
    if (ws.readyState !== WebSocket.OPEN) {
      const callback = priceCallbacks.get(address);
      if (callback) {
        console.log(`🔄 Restarting connection for ${address.substring(0, 8)}`);
        ws.close();
        trackTokenPrice(address, callback);
        restarted++;
      }
    }
  }

  return {
    success: true,
    restarted
  };
}

/**
 * Test Birdeye WebSocket connection
 */
export async function testBirdeyeWebSocket() {
  try {
    console.log('🧪 Testing Birdeye WebSocket connection...');

    // Test with USDC
    const testAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(BIRDEYE_WS_URL, {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY
        }
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_PRICE',
          data: { address: testAddress }
        }));
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        const message = JSON.parse(data.toString());
        console.log('✅ Received message:', message);
        ws.close();
        resolve({
          success: true,
          message: 'WebSocket connection successful',
          data: message
        });
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Birdeye WebSocket test error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get WebSocket stats
 */
export function getWebSocketStats() {
  const connections = Array.from(activeConnections.entries());
  
  return {
    totalConnections: connections.length,
    openConnections: connections.filter(([_, ws]) => ws.readyState === WebSocket.OPEN).length,
    closedConnections: connections.filter(([_, ws]) => ws.readyState === WebSocket.CLOSED).length,
    connectingConnections: connections.filter(([_, ws]) => ws.readyState === WebSocket.CONNECTING).length,
    tokens: connections.map(([address]) => address.substring(0, 8) + '...')
  };
}

export default {
  trackTokenPrice,
  stopTrackingPrice,
  trackMultipleTokens,
  getActiveConnections,
  closeAllConnections,
  healthCheck,
  restartUnhealthyConnections,
  testBirdeyeWebSocket,
  getWebSocketStats
};
