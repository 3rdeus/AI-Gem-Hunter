/**
 * Birdeye Integration Test Endpoint
 * Test all Birdeye features
 */

import { testBirdeyeWebSocket } from '../lib/birdeye-websocket.js';
import { testBirdeyeWalletTracking, analyzeWalletPerformance } from '../lib/birdeye-wallet-tracking.js';
import { testBirdeyeLiquidity } from '../lib/birdeye-liquidity.js';
import { testBirdeyeHistorical, analyzePatterns } from '../lib/birdeye-historical.js';

export default async function handler(req, res) {
  const { test = 'all', tokenAddress, walletAddress } = req.query;

  try {
    let results = {};

    // Test WebSocket
    if (test === 'all' || test === 'websocket') {
      console.log('🧪 Testing WebSocket...');
      results.websocket = await testBirdeyeWebSocket();
    }

    // Test Wallet Tracking
    if (test === 'all' || test === 'wallet') {
      console.log('🧪 Testing Wallet Tracking...');
      results.walletTracking = await testBirdeyeWalletTracking();
      
      // If wallet address provided, analyze it
      if (walletAddress) {
        results.walletAnalysis = await analyzeWalletPerformance(walletAddress);
      }
    }

    // Test Liquidity Monitoring
    if (test === 'all' || test === 'liquidity') {
      console.log('🧪 Testing Liquidity Monitoring...');
      results.liquidity = await testBirdeyeLiquidity();
    }

    // Test Historical Data
    if (test === 'all' || test === 'historical') {
      console.log('🧪 Testing Historical Data...');
      results.historical = await testBirdeyeHistorical();
      
      // If token address provided, analyze patterns
      if (tokenAddress) {
        results.patternAnalysis = await analyzePatterns(tokenAddress);
      }
    }

    // Summary
    const allSuccess = Object.values(results).every(r => r.success);

    return res.status(200).json({
      success: allSuccess,
      message: allSuccess
        ? '✅ All Birdeye integrations working!'
        : '⚠️ Some integrations failed',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Birdeye test error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
