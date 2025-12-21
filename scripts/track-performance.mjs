/**
 * Performance Tracker - Scheduled Job
 * Updates performance metrics for recently discovered gems
 * Run this every 6 hours via cron/scheduler
 */

import { updateGemPerformance, getDiscoveredGems } from '../lib/gem-tracker.mjs';
import { calculateGemScore } from '../lib/token-scorer.mjs';

/**
 * Track performance for gems discovered in the last 24 hours
 */
export async function trackRecentGemPerformance() {
  console.log('[PERFORMANCE-TRACKER] Starting performance tracking cycle...');
  
  try {
    // Get all gems discovered in last 24 hours that had alerts sent
    const { success, data: recentGems, error } = await getDiscoveredGems({
      alertSent: true,
      limit: 100 // Track top 100 recent gems
    });
    
    if (!success || !recentGems) {
      console.error('[PERFORMANCE-TRACKER] Failed to fetch recent gems:', error);
      return { success: false, error };
    }
    
    // Filter gems discovered within last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const gemsToTrack = recentGems.filter(gem => {
      const discoveredAt = new Date(gem.discovered_at);
      return discoveredAt >= twentyFourHoursAgo;
    });
    
    console.log(`[PERFORMANCE-TRACKER] Found ${gemsToTrack.length} gems to track`);
    
    if (gemsToTrack.length === 0) {
      console.log('[PERFORMANCE-TRACKER] No gems to track in the last 24 hours');
      return { success: true, tracked: 0 };
    }
    
    // Track performance for each gem
    let successCount = 0;
    let errorCount = 0;
    
    for (const gem of gemsToTrack) {
      try {
        console.log(`[PERFORMANCE-TRACKER] Updating ${gem.name} (${gem.token_address})...`);
        
        // Fetch current metrics by re-scoring the token
        const scoreResult = await calculateGemScore(gem.token_address);
        
        if (scoreResult.error || !scoreResult.data) {
          console.warn(`[PERFORMANCE-TRACKER] Could not get current data for ${gem.token_address}`);
          errorCount++;
          continue;
        }
        
        // Extract current metrics
        const currentMetrics = {
          price: scoreResult.data.price || null,
          liquidity: scoreResult.data.liquidity || 0,
          volume24h: scoreResult.data.v24hUSD || 0,
          holders: scoreResult.data.holder || 0,
          marketCap: scoreResult.data.mc || 0
        };
        
        // Update performance
        const updateResult = await updateGemPerformance(gem.token_address, currentMetrics);
        
        if (updateResult.success) {
          const change = updateResult.priceChange?.toFixed(2) || 'N/A';
          const status = updateResult.status || 'unknown';
          console.log(`[PERFORMANCE-TRACKER] ✅ ${gem.name}: ${change}% change, status: ${status}`);
          successCount++;
        } else {
          console.error(`[PERFORMANCE-TRACKER] ❌ Failed to update ${gem.token_address}:`, updateResult.error);
          errorCount++;
        }
        
        // Rate limiting: wait 200ms between updates to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`[PERFORMANCE-TRACKER] Exception updating ${gem.token_address}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`[PERFORMANCE-TRACKER] Cycle complete: ${successCount} tracked, ${errorCount} errors`);
    
    return {
      success: true,
      tracked: successCount,
      errors: errorCount,
      total: gemsToTrack.length
    };
    
  } catch (error) {
    console.error('[PERFORMANCE-TRACKER] Fatal error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution when run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[PERFORMANCE-TRACKER] Running performance tracking...');
  
  trackRecentGemPerformance()
    .then(result => {
      console.log('[PERFORMANCE-TRACKER] Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('[PERFORMANCE-TRACKER] Unhandled error:', error);
      process.exit(1);
    });
}
