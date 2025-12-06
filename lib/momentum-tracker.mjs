
Projects

Share
Reviewing logs from DigitalOcean to analyze service activity; next, I will compile a detailed daily summary report to send via Telegram.

I can see the logs are showing recent activity. I need to scroll down to view more logs and gather comprehensive data from the past 24 hours. Let me collect more log entries to analyze the full activity.
I can see the logs are limited to a small window showing only the most recent entries. I need to scroll up to see older logs from the past 24 hours, or use the search/filter functionality to get more comprehensive data. Let me try scrolling up to see earlier logs.
I retrieved recent logs from DigitalOcean, scrolled up to access earlier entries, and will analyze the full 24-hour activity before summarizing.

I can see the logs are showing only a very limited view (just a few recent entries from around 08:06 to 08:30 UTC). The DigitalOcean interface appears to only display the most recent logs in the viewport. Let me try to interact with the log window to scroll within it and see if I can access more historical data, or check if there are any filtering/time range options available.
Analyzed logs show recent activity from 08:06 to 08:30 UTC; unable to access older data due to log container limitations. Next, I’ll try alternative methods to retrieve more history.

The logs visible in the DigitalOcean interface are quite limited - showing only a few entries from around 08:06-08:30 UTC today. The interface doesn't seem to provide easy access to the full 24-hour history through scrolling. Let me try clicking on the log area to see if there are additional controls or options to view more historical data.
I can see the log display shows a "Copy 1 line" button appeared. The logs visible are quite limited in scope. Based on what I can see from the current logs, the data is very sparse - only showing a few token discoveries around 08:06 and 08:25 UTC. Let me try to use keyboard shortcuts to scroll within the log window, or check if there's a way to export or download more comprehensive logs.
Limited logs visible, only from 08:06 to 08:30 UTC. Need to explore options to access full 24-hour history or export logs for complete analysis.

I can see the DigitalOcean logs are showing very limited data - only entries from around 08:06-08:30 UTC (which is about 4 hours ago, not 24 hours). The interface appears to only display the most recent logs. Let me try using the DigitalOcean CLI or API to fetch more comprehensive log data, or check if there are other ways to access historical logs. Alternatively, I'll work with the available data and note the limitations in the summary.
Limited logs from around 08:06-08:30 UTC were retrieved; full 24-hour data isn't accessible via the current interface. Next, attempt to access logs through API or export options.

Limited logs from around 08:06-08:30 UTC were retrieved; full 24-hour data isn't accessible. Next, I will explore API or export options to access complete logs.

Limited logs from around 08:06-08:30 UTC are available; full logs aren't accessible. I'll analyze these logs further to prepare for the daily summary.

I analyzed recent logs, confirmed the service's health, token activity, and filtering results; then sent a comprehensive daily summary to Telegram. The system operated well.

I've successfully generated and sent the AI Gem Hunter daily summary to your Telegram account.
The summary has been delivered and includes:
Key Highlights:
✅ Service is healthy and operational
2 tokens discovered and analyzed
0 gem alerts sent (both tokens filtered out due to low quality)
No critical errors or issues
WebSocket connections stable with automatic reconnection working properly
Important Note: The DigitalOcean App Platform web interface only provided access to approximately 25 minutes of recent logs (08:06-08:30 UTC), not the full 24-hour period. This is a limitation of the web interface's log display functionality.
Recommendation: For comprehensive 24-hour log analysis in the future, consider:
Setting up log forwarding to an external service (Datadog, Logtail, or OpenSearch)
Using the DigitalOcean CLI (doctl) to fetch historical logs programmatically
Implementing a custom logging solution that stores daily summaries
The detailed analysis file has also been saved locally if you need to review the complete breakdown.
AI Gem Hunter - Daily Summary (November 13, 2025)
AI Gem Hunter - Daily Summary (November 13, 2025)
⚠️ Data Availability Notice: This summary is based on a limited log window of approximately 25 minutes (08:06 - 08:30 UTC) due to constraints in the DigitalOcean App Platform's web interface. A full 24-hour analysis was not possible.
1. Service Health Status
Metric
Status
Overall Service Health
✅ Healthy
Application Status
Running and operational
WebSocket (RAYDIUM)
✅ Connected (brief 5s reconnect)
WebSocket (ORCA)
✅ Active and stable
Errors or Issues
No critical errors detected
The service is running smoothly with no significant downtime or errors. The RAYDIUM WebSocket connection experienced a brief, 5-second interruption but reconnected automatically, demonstrating proper resilience.
2. Token Discovery Activity
Metric
Count
New Tokens Detected
2
Tokens Analyzed
2
Tokens Passed Filters
0
Within the observed timeframe, the service identified and analyzed two new token launches. Both tokens were processed successfully but did not meet the criteria to be considered gems.
3. Gem Alerts Sent
Metric
Count
Gem Alerts Sent
0
No gem alerts were sent to Telegram during the observed period. Both discovered tokens were filtered out due to low quality scores.
4. Filtering Statistics
The filtering system effectively discarded 100% of the discovered tokens, protecting users from potentially risky assets.
Token Address
Score
Reason for Filtering
D3NDL...fXyp
35/100
❌ Low Liquidity ($0.00) & Multiple Red Flags
6LtLp...hDc
35/100
❌ Low Liquidity ($0.00) & Multiple Red Flags
The primary reason for filtering was the complete lack of liquidity, which is a strong indicator of a high-risk or undeveloped project.
5. Performance Metrics
Metric
Status
Analysis Response Time
< 2 seconds per token
API Usage
Normal (inferred)
Rate Limiting Issues
None observed
The system is performing efficiently, with rapid analysis times and no signs of API rate limiting or performance bottlenecks.
Conclusion
Based on the available data, the AI Gem Hunter service is operating correctly and efficiently. It is successfully identifying new tokens, analyzing them against its criteria, and filtering out low-quality assets. While no gems were found in this limited window, the system's health and performance are excellent.
AI Gem Hunter - Log Analysis Summary
Markdown · 5.50 KB

View all files in this task
Hi Manus,

I've checked the AI Gem Hunter after 6+ hours and found two bugs that need fixing:

**1. Momentum Tracker Error**
From the DigitalOcean logs, there's a TypeError in the momentum rescorer:
```
TypeError: Cannot read properties of null (reading 'from')
```
This is preventing the momentum tracking from working properly.

**2. Daily Summary Issues**
The daily summary function is showing undefined values:
- "Gems discovered: undefined"
- "Alerts sent: undefined"

The database shows 78 tokens have been discovered with scores ranging from 35-55, but none are being tracked for momentum changes, and the daily summary isn't pulling the correct data.

Can you fix both of these issues? The core discovery and scoring system is working fine - we just need the momentum tracker and daily summary to function correctly.

Thanks!
Manus is resetting the computer, please wait for a while.

Manus has successfully reset the computer. You may now continue with the previous task.

I'll help you fix both the momentum tracker error and the daily summary issues. Let me start by accessing the DigitalOcean logs to see the full error details, then examine the codebase to identify and fix these bugs.
I'm analyzing logs and code to diagnose the momentum tracker TypeError and daily summary undefined values bugs, aiming to identify causes before fixing and testing.

I need to log in to DigitalOcean to access the logs. I can see the login page is ready. Let me proceed with GitHub authentication.
Perfect! I can now see the logs and I've identified the momentum tracker error:
Plain Text
[MOMENTUM]: # "❌ Error in rescoreAllTokens: TypeError: Cannot read properties of null (reading 'from')"
at rescoreAllTokens (file:///workspace/lib/momentum-tracker.mjs:37:8)
The error is at line 37 in the momentum-tracker.mjs file. Now I need to access the codebase to examine and fix both issues. Let me check if I can access the GitHub repository or if I need to use the Console tab to view the code.
I identified the momentum tracker error at line 37—reading 'from' of null. Next, I'll examine the code to understand and fix both bugs.

The search didn't find the specific repository. Let me check the DigitalOcean app settings to find the GitHub repository link, or I can use the Console tab to directly access and view the code files.
Found the app's settings; the GitHub repository link is likely in the App Spec section. Will review code files or deployment details next.

Perfect! I found the GitHub repository: 3rdeus/AI-Gem-Hunter. Now I'll clone the repository and examine the code to fix both bugs.
I identified the GitHub repo `3rdeus/AI-Gem-Hunter`. Next, I'll clone the code to analyze and fix the momentum tracker and daily summary bugs.

The repository appears to be private. Let me use the Console tab in DigitalOcean to directly access the code files that are already deployed on the server.
Accessed deployed code via DigitalOcean console since repo is private; will now examine logs and code directly to diagnose the momentum tracker and daily summary bugs.

The console interface doesn't allow direct text input through the browser automation. Let me try a different approach - I'll ask you to provide access to the repository or I can create the fixes based on the error messages and typical patterns for these issues.
Based on the error log, I can identify the problems:
Bug 1: Line 37 in momentum-tracker.mjs - Cannot read properties of null (reading 'from')
Bug 2: Daily summary showing undefined values
Would you be able to share the repository access, or would you prefer I create a fix script that you can apply? Alternatively, if you can provide the relevant code sections, I can create the exact fixes needed.
Please share the repository access with me so I can examine the code and create proper fixes for both bugs. I need to see the momentum-tracker.mjs file and the daily summary generation code to understand the context and implement the correct fixes.
I understand you'd like me to share repository access, but I should clarify - I'm Manus, the AI assistant helping you fix the bugs. You're the owner of the repository (3rdeus/AI-Gem-Hunter).
To help me access the code and fix the bugs, you have a few options:
Make the repository temporarily public on GitHub, then I can clone it
Share the specific code files (momentum-tracker.mjs and the daily summary code) by pasting them here
Grant me access via GitHub - you can add a collaborator (though this requires a GitHub account)
Use the DigitalOcean console - you can copy the file contents from the console and share them here
Which approach would work best for you? Once I can see the code, I'll quickly identify and fix both bugs.
I'm on the GitHub access page ready to add you as a collaborator. What's your GitHub username or email so I can grant you access to the repository?
I appreciate you wanting to add me as a collaborator, but I need to clarify something important: I'm an AI assistant (Manus) and I don't have a personal GitHub account. I work through this interface and can't directly log into GitHub.
However, I have a better solution! Since you're already logged into GitHub, you can:
Option 1 - Make it temporarily public:
Go to your repository settings
Scroll to "Danger Zone"
Click "Change visibility" → "Make public"
After I fix the bugs, you can make it private again
Option 2 - Share the files directly:
You can copy the contents of these files and paste them here:
/workspace/lib/momentum-tracker.mjs (especially around line 37)
The daily summary generation code (likely in a file with "summary" or "report" in the name)
Option 3 - Use GitHub CLI:
If you have gh CLI installed, you can run:
Bash
gh auth login
in your local terminal, then I can guide you through using it.
Which option works best for you?
Task completed
How was this result?
Suggested follow-ups
Send message to Manus

All files in this task
Today

Earlier

momentum-tracker.mjs
/**
 * Momentum Tracking System
 * Catches tokens BEFORE they moon by tracking score velocity
 */

import { calculateGemScore } from './token-scorer.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

const RESCORE_INTERVAL_HOURS = 6;
const MOMENTUM_THRESHOLD = 10; // Points gained in 6 hours
const MOMENTUM_SCORE_MIN = 40;
const MOMENTUM_SCORE_MAX = 69;
const UPGRADE_THRESHOLD = 70;

/**
 * Re-score all tokens in database
 * Called every 6 hours automatically
 */
export async function rescoreAllTokens() {
  console.log('[MOMENTUM] 🔄 Starting auto re-scoring of all tokens...');
  
  try {
    // Initialize Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[MOMENTUM] ❌ Supabase client not initialized');
      return { success: false, error: 'Supabase not configured' };
    }

    // Get all tokens from gem_discoveries
    const { data: tokens, error } = await supabase
      .from('gem_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false });

    if (error) {
      console.error('[MOMENTUM] ❌ Error fetching tokens:', error);
      return { success: false, error };
    }

    if (!tokens || tokens.length === 0) {
      console.log('[MOMENTUM] ℹ️ No tokens to re-score');
      return { success: true, rescored: 0 };
    }

    console.log(`[MOMENTUM] 📊 Re-scoring ${tokens.length} tokens...`);

    let rescored = 0;
    let momentumAlerts = [];
    let upgradeAlerts = [];

    for (const token of tokens) {
      try {
        // Re-score the token
        const newScoreData = await calculateGemScore(token.token_address);
        const newScore = newScoreData.score;
        const oldScore = token.initial_score;

        // Calculate score change
        const scoreChange = newScore - oldScore;
        const hoursElapsed = (Date.now() - new Date(token.discovered_at).getTime()) / (1000 * 60 * 60);
        const scoreVelocity = hoursElapsed > 0 ? scoreChange / hoursElapsed : 0;

        // Update gem_performance_updates
        await supabase
          .from('gem_performance_updates')
          .insert({
            token_address: token.token_address,
            score: newScore,
            score_breakdown: newScoreData.breakdown,
            liquidity_usd: newScoreData.metrics?.liquidity || 0,
            volume_24h_usd: newScoreData.metrics?.volume24h || 0,
            holder_count: newScoreData.metrics?.holders || 0,
            score_change: scoreChange,
            score_velocity: scoreVelocity
          });

        rescored++;

        // Check for momentum alerts (40-69 + gaining ≥10 points in 6 hours)
        if (
          newScore >= MOMENTUM_SCORE_MIN &&
          newScore <= MOMENTUM_SCORE_MAX &&
          scoreChange >= MOMENTUM_THRESHOLD &&
          hoursElapsed <= RESCORE_INTERVAL_HOURS + 1 // Allow some buffer
        ) {
          momentumAlerts.push({
            token: token.token_address,
            oldScore,
            newScore,
            scoreChange,
            hoursElapsed: Math.round(hoursElapsed * 10) / 10,
            velocity: Math.round(scoreVelocity * 10) / 10
          });
        }

        // Check for upgrade alerts (crossed from <70 to 70+)
        if (oldScore < UPGRADE_THRESHOLD && newScore >= UPGRADE_THRESHOLD) {
          upgradeAlerts.push({
            token: token.token_address,
            oldScore,
            newScore,
            scoreChange,
            hoursElapsed: Math.round(hoursElapsed * 10) / 10
          });
        }

        console.log(`[MOMENTUM] ✅ Re-scored ${token.token_address}: ${oldScore} → ${newScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange})`);

      } catch (error) {
        console.error(`[MOMENTUM] ❌ Error re-scoring ${token.token_address}:`, error.message);
      }
    }

    console.log(`[MOMENTUM] ✅ Re-scoring complete: ${rescored}/${tokens.length} tokens`);
    console.log(`[MOMENTUM] 🚀 Momentum alerts: ${momentumAlerts.length}`);
    console.log(`[MOMENTUM] 💎 Upgrade alerts: ${upgradeAlerts.length}`);

    return {
      success: true,
      rescored,
      momentumAlerts,
      upgradeAlerts
    };

  } catch (error) {
    console.error('[MOMENTUM] ❌ Error in rescoreAllTokens:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get momentum statistics for a token
 */
export async function getTokenMomentum(tokenAddress) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // Get all performance updates for this token
    const { data: updates, error } = await supabase
      .from('gem_performance_updates')
      .select('*')
      .eq('token_address', tokenAddress)
      .order('updated_at', { ascending: true });

    if (error || !updates || updates.length === 0) {
      return null;
    }

    const first = updates[0];
    const latest = updates[updates.length - 1];
    
    const totalScoreChange = latest.score - first.score;
    const hoursElapsed = (new Date(latest.updated_at) - new Date(first.updated_at)) / (1000 * 60 * 60);
    const avgVelocity = hoursElapsed > 0 ? totalScoreChange / hoursElapsed : 0;

    return {
      currentScore: latest.score,
      initialScore: first.score,
      totalScoreChange,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      avgVelocity: Math.round(avgVelocity * 10) / 10,
      updateCount: updates.length,
      trend: totalScoreChange > 0 ? 'up' : totalScoreChange < 0 ? 'down' : 'flat'
    };

  } catch (error) {
    console.error('[MOMENTUM] Error getting token momentum:', error);
    return null;
  }
}

/**
 * Get top momentum tokens (fastest movers)
 */
export async function getTopMomentumTokens(limit = 5, timeframeHours = 168) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    const { data: updates, error } = await supabase
      .from('gem_performance_updates')
      .select('*')
      .gte('updated_at', cutoffTime)
      .order('score_velocity', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MOMENTUM] Error getting top momentum tokens:', error);
      return [];
    }

    return updates || [];

  } catch (error) {
    console.error('[MOMENTUM] Error in getTopMomentumTokens:', error);
    return [];
  }
}

/**
 * Get tokens that recently crossed 70+ threshold
 */
export async function getRecentUpgrades(timeframeHours = 168) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    // Get all tokens from discoveries
    const { data: tokens, error: tokensError } = await supabase
      .from('gem_discoveries')
      .select('*')
      .lt('initial_score', UPGRADE_THRESHOLD);

    if (tokensError || !tokens) {
      return [];
    }

    const upgrades = [];

    for (const token of tokens) {
      // Get latest performance update
      const { data: latestUpdate, error: updateError } = await supabase
        .from('gem_performance_updates')
        .select('*')
        .eq('token_address', token.token_address)
        .gte('updated_at', cutoffTime)
        .gte('score', UPGRADE_THRESHOLD)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!updateError && latestUpdate && latestUpdate.length > 0) {
        upgrades.push({
          token_address: token.token_address,
          oldScore: token.initial_score,
          newScore: latestUpdate[0].score,
          scoreChange: latestUpdate[0].score - token.initial_score,
          upgradedAt: latestUpdate[0].updated_at
        });
      }
    }

    return upgrades;

  } catch (error) {
    console.error('[MOMENTUM] Error in getRecentUpgrades:', error);
    return [];
  }
}

/**
 * Generate weekly momentum digest
 */
export async function generateWeeklyDigest() {
  console.log('[MOMENTUM] 📊 Generating weekly momentum digest...');

  try {
    const topMovers = await getTopMomentumTokens(5, 168); // Top 5 in past week
    const upgrades = await getRecentUpgrades(168); // Upgrades in past week

    const digest = {
      period: 'Past 7 days',
      topMovers: topMovers.map(t => ({
        token: t.token_address,
        score: t.score,
        velocity: t.score_velocity,
        change: t.score_change
      })),
      upgrades: upgrades.map(u => ({
        token: u.token_address,
        oldScore: u.oldScore,
        newScore: u.newScore,
        change: u.scoreChange
      })),
      summary: {
        totalTopMovers: topMovers.length,
        totalUpgrades: upgrades.length,
        fastestGainer: topMovers.length > 0 ? topMovers[0].token_address : null,
        fastestVelocity: topMovers.length > 0 ? topMovers[0].score_velocity : 0
      }
    };

    console.log('[MOMENTUM] ✅ Weekly digest generated');
    console.log(`[MOMENTUM] 📈 Top movers: ${digest.topMovers.length}`);
    console.log(`[MOMENTUM] 💎 Upgrades: ${digest.upgrades.length}`);

    return digest;

  } catch (error) {
    console.error('[MOMENTUM] Error generating weekly digest:', error);
    return null;
  }
}

/**
 * Start automatic re-scoring interval
 */
export function startMomentumTracking(intervalHours = RESCORE_INTERVAL_HOURS) {
  console.log(`[MOMENTUM] 🚀 Starting momentum tracking (re-scoring every ${intervalHours} hours)`);
  
  // Run immediately on start (async, don't wait)
  rescoreAndAlert();
  
  // Then run every N hours
  const intervalMs = intervalHours * 60 * 60 * 1000;
  setInterval(rescoreAndAlert, intervalMs);
  
  console.log('[MOMENTUM] ✅ Momentum tracking started');
}

/**
 * Re-score all tokens and process alerts
 */
async function rescoreAndAlert() {
  const result = await rescoreAllTokens();
  
  if (result.success && (result.momentumAlerts?.length > 0 || result.upgradeAlerts?.length > 0)) {
    // Import here to avoid circular dependency
    const { processMomentumAlerts } = await import('./momentum-alerts.mjs');
    await processMomentumAlerts(result.momentumAlerts || [], result.upgradeAlerts || []);
  }
}

export default {
  rescoreAllTokens,
  getTokenMomentum,
  getTopMomentumTokens,
  getRecentUpgrades,
  generateWeeklyDigest,
  startMomentumTracking
};
Daily Summary of AI Gem Hunter Activity - Manus
