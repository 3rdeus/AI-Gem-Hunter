/**
 * Vercel Serverless Function
 * Triggers momentum tracker re-score on demand
 * Call with: https://token-safety-api.vercel.app/api/trigger-rescore
 */

import { rescoreAllTokens } from '../lib/momentum-tracker.mjs';
import { processMomentumAlerts } from '../lib/momentum-alerts.mjs';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Please use POST to trigger a re-score'
    });
  }

  console.log('[TRIGGER-RESCORE] Manual re-score triggered via API');

  try {
    // Run the re-score
    const result = await rescoreAllTokens();

    if (result.success) {
      // Process alerts if any
      if (result.momentumAlerts?.length > 0 || result.upgradeAlerts?.length > 0) {
        console.log('[TRIGGER-RESCORE] Sending alerts to Telegram...');
        await processMomentumAlerts(
          result.momentumAlerts || [],
          result.upgradeAlerts || []
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Re-score completed successfully',
        stats: {
          rescored: result.rescored,
          momentumAlerts: result.momentumAlerts?.length || 0,
          upgradeAlerts: result.upgradeAlerts?.length || 0
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Re-score failed',
        details: result.error
      });
    }
  } catch (error) {
    console.error('[TRIGGER-RESCORE] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
