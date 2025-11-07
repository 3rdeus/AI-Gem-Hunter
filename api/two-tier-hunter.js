/**
 * Two-Tier Gem Hunter API Endpoint
 * Control and monitor the two-tier gem hunting system
 */

import { startTwoTierGemHunter, stopTwoTierGemHunter, getTwoTierStatus, configureTiers, getPerformanceSummary } from '../services/two-tier-gem-hunter.js';
import { getAllPositions, getBonkBotStats, testBonkBotConnection } from '../lib/bonk-bot.js';
import { getMonitoringStats } from '../lib/position-monitor.js';
import { getAllExitStrategies } from '../lib/auto-exit.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    switch (action) {
      case 'start':
        return await handleStart(req, res);
      
      case 'stop':
        return await handleStop(req, res);
      
      case 'status':
        return await handleStatus(req, res);
      
      case 'configure':
        return await handleConfigure(req, res);
      
      case 'performance':
        return await handlePerformance(req, res);
      
      case 'positions':
        return await handlePositions(req, res);
      
      case 'test-bonk-bot':
        return await handleTestBonkBot(req, res);
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use: start, stop, status, configure, performance, positions, test-bonk-bot'
        });
    }
  } catch (error) {
    console.error('Two-Tier Hunter API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Start the two-tier gem hunter
 */
async function handleStart(req, res) {
  const result = await startTwoTierGemHunter();
  return res.status(result.success ? 200 : 400).json(result);
}

/**
 * Stop the two-tier gem hunter
 */
async function handleStop(req, res) {
  const result = await stopTwoTierGemHunter();
  return res.status(result.success ? 200 : 400).json(result);
}

/**
 * Get system status
 */
async function handleStatus(req, res) {
  const status = getTwoTierStatus();
  return res.status(200).json({
    success: true,
    status
  });
}

/**
 * Configure tiers
 */
async function handleConfigure(req, res) {
  const { tier1, tier2 } = req.body || req.query;
  
  const config = {};
  if (tier1 !== undefined) config.tier1 = tier1 === 'true' || tier1 === true;
  if (tier2 !== undefined) config.tier2 = tier2 === 'true' || tier2 === true;

  const result = configureTiers(config);
  return res.status(200).json({
    success: true,
    ...result
  });
}

/**
 * Get performance summary
 */
async function handlePerformance(req, res) {
  const summary = getPerformanceSummary();
  const bonkBotStats = getBonkBotStats();
  const monitorStats = getMonitoringStats();
  const exitStrategies = getAllExitStrategies();

  return res.status(200).json({
    success: true,
    performance: summary,
    bonkBot: bonkBotStats,
    monitoring: monitorStats,
    exitStrategies
  });
}

/**
 * Get all positions
 */
async function handlePositions(req, res) {
  const positions = getAllPositions();
  
  return res.status(200).json({
    success: true,
    total: positions.length,
    active: positions.filter(p => p.status === 'ACTIVE').length,
    closed: positions.filter(p => p.status === 'CLOSED').length,
    pending: positions.filter(p => p.status === 'PENDING').length,
    positions
  });
}

/**
 * Test Bonk Bot connection
 */
async function handleTestBonkBot(req, res) {
  const result = await testBonkBotConnection();
  return res.status(result.success ? 200 : 400).json(result);
}
