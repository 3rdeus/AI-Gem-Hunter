/**
 * AI Gem Hunter API Endpoint
 * Control the gem hunter service and get status
 */

import { startGemHunter, stopGemHunter, getServiceStatus } from '../services/gem-hunter-service.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const action = req.query.action || req.body?.action;

    switch (action) {
      case 'start':
        const startResult = await startGemHunter();
        return res.status(200).json(startResult);

      case 'stop':
        const stopResult = stopGemHunter();
        return res.status(200).json(stopResult);

      case 'status':
      default:
        const status = getServiceStatus();
        return res.status(200).json({
          success: true,
          ...status
        });
    }
  } catch (error) {
    console.error('Gem hunter API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
