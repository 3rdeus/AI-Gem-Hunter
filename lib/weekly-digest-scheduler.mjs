/**
 * Weekly Momentum Digest Scheduler
 * Sends weekly digest every Monday at 9 AM
 */

import { generateWeeklyDigest } from './momentum-tracker.mjs';
import { sendWeeklyDigest } from './momentum-alerts.mjs';

/**
 * Send weekly momentum digest
 */
async function sendWeeklyMomentumDigest() {
  console.log('[WEEKLY-DIGEST] 📊 Generating and sending weekly momentum digest...');

  try {
    // Generate digest data
    const digestData = await generateWeeklyDigest();

    if (!digestData) {
      console.error('[WEEKLY-DIGEST] ❌ Failed to generate digest data');
      return;
    }

    // Send via Telegram
    await sendWeeklyDigest(digestData);

    console.log('[WEEKLY-DIGEST] ✅ Weekly digest sent successfully');

  } catch (error) {
    console.error('[WEEKLY-DIGEST] ❌ Error sending weekly digest:', error);
  }
}

/**
 * Start weekly digest scheduler
 * Runs every Monday at 9 AM
 */
export function startWeeklyDigestScheduler() {
  console.log('[WEEKLY-DIGEST] 🚀 Starting weekly digest scheduler (Mondays at 9 AM)');

  // Calculate time until next Monday 9 AM
  function getNextMonday9AM() {
    const now = new Date();
    const next = new Date(now);
    
    // Set to 9 AM
    next.setHours(9, 0, 0, 0);
    
    // Get days until Monday (1 = Monday, 0 = Sunday)
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilMonday);
    
    // If it's already past 9 AM on Monday, schedule for next week
    if (now.getDay() === 1 && now.getHours() >= 9) {
      next.setDate(next.getDate() + 7);
    }
    
    return next;
  }

  // Schedule first run
  const nextRun = getNextMonday9AM();
  const msUntilNextRun = nextRun - new Date();
  
  console.log(`[WEEKLY-DIGEST] ⏰ Next digest: ${nextRun.toLocaleString()}`);
  console.log(`[WEEKLY-DIGEST] ⏰ Time until next run: ${Math.round(msUntilNextRun / (1000 * 60 * 60))} hours`);

  setTimeout(() => {
    sendWeeklyMomentumDigest();
    
    // Then run every week (7 days)
    setInterval(sendWeeklyMomentumDigest, 7 * 24 * 60 * 60 * 1000);
  }, msUntilNextRun);

  console.log('[WEEKLY-DIGEST] ✅ Weekly digest scheduler started');
}

export default {
  sendWeeklyMomentumDigest,
  startWeeklyDigestScheduler
};
