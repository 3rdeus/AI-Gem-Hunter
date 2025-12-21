/**
 * Performance Tracker Service
 * Runs continuously and tracks gem performance every 6 hours
 */

import { trackRecentGemPerformance } from '../scripts/track-performance.mjs';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

/**
 * Run the performance tracking cycle
 */
async function runTrackingCycle() {
  console.log('[PERF-SERVICE] ⏰ Running scheduled performance tracking cycle...');
  
  try {
    const result = await trackRecentGemPerformance();
    
    if (result.success) {
      console.log(`[PERF-SERVICE] ✅ Cycle complete: ${result.tracked} gems tracked, ${result.errors || 0} errors`);
    } else {
      console.error('[PERF-SERVICE] ❌ Cycle failed:', result.error);
    }
  } catch (error) {
    console.error('[PERF-SERVICE] ❌ Unhandled error:', error);
  }
}

/**
 * Main service loop
 */
async function startPerformanceTracker() {
  console.log('[PERF-SERVICE] 🚀 Performance Tracker Service starting...');
  console.log(`[PERF-SERVICE] 📅 Will run every 6 hours`);
  
  // Run immediately on startup
  await runTrackingCycle();
  
  // Schedule to run every 6 hours
  setInterval(async () => {
    await runTrackingCycle();
  }, SIX_HOURS_MS);
  
  console.log('[PERF-SERVICE] ✅ Performance Tracker Service is now running');
  console.log(`[PERF-SERVICE] ⏰ Next run in 6 hours`);
}

// Start the service
startPerformanceTracker()
  .catch(error => {
    console.error('[PERF-SERVICE] 🔥 Fatal error starting service:', error);
    process.exit(1);
  });
