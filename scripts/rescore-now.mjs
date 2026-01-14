#!/usr/bin/env node
/**
 * Manual Momentum Tracker Re-score Script
 * Forces a re-evaluation of all discovered gems
 * Run this with: node scripts/rescore-now.mjs
 */

import { rescoreAllTokens } from '../lib/momentum-tracker.mjs';
import { processMomentumAlerts } from '../lib/momentum-alerts.mjs';

console.log('🔄 MANUAL RE-SCORE TRIGGERED');
console.log('================================');
console.log('This will re-score all discovered gems and send alerts for:');
console.log('- Tokens with momentum (40-69 score, +10 points in 6 hours)');
console.log('- Tokens upgraded to gem status (crossed 70+ threshold)');
console.log('');

// Run the re-score
const result = await rescoreAllTokens();

if (result.success) {
  console.log('');
  console.log('✅ RE-SCORE COMPLETE');
  console.log('================================');
  console.log(`📊 Tokens re-scored: ${result.rescored}`);
  console.log(`🚀 Momentum alerts: ${result.momentumAlerts?.length || 0}`);
  console.log(`💎 Upgrade alerts: ${result.upgradeAlerts?.length || 0}`);
  
  // Process alerts if any
  if (result.momentumAlerts?.length > 0 || result.upgradeAlerts?.length > 0) {
    console.log('');
    console.log('📤 Sending alerts to Telegram...');
    await processMomentumAlerts(
      result.momentumAlerts || [],
      result.upgradeAlerts || []
    );
    console.log('✅ Alerts sent!');
  }
  
  process.exit(0);
} else {
  console.error('');
  console.error('❌ RE-SCORE FAILED');
  console.error('================================');
  console.error('Error:', result.error);
  process.exit(1);
}
