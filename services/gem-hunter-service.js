
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

gem-hunter-service.js
/**
 * AI Gem Hunter Service
 * Integrates real-time discovery with Telegram notifications
 */

import { startTokenDiscovery, getDiscoveryStats } from '../lib/real-time-discovery.js';
import {
  sendGemAlert,
  sendCriticalWarning,
  sendSmartMoneyAlert,
  sendDailySummary,
  sendTestMessage
} from '../lib/telegram-bot.js';

/**
 * Service state
 */
let isRunning = false;
let discoveryWebSocket = null;
let stats = {
  gemsDiscovered: 0,
  alertsSent: 0,
  criticalWarnings: 0,
  startTime: null,
  topGems: []
};

/**
 * Start the AI Gem Hunter service
 */
export async function startGemHunter() {
  if (isRunning) {
    console.log('Gem Hunter is already running');
    return { success: false, message: 'Already running' };
  }

  console.log('🚀 Starting AI Gem Hunter Service...');
  
  // Send test message to confirm Telegram is working
  const testResult = await sendTestMessage();
  if (!testResult.success) {
    console.error('❌ Telegram bot not configured properly');
    return {
      success: false,
      message: 'Telegram bot configuration error',
      error: testResult.error
    };
  }

  console.log('✅ Telegram bot connected');

  // Start token discovery with callback
  discoveryWebSocket = startTokenDiscovery(handleGemDiscovered);
  
  isRunning = true;
  stats.startTime = new Date();

  console.log('✅ AI Gem Hunter Service started');
  console.log('📡 Monitoring Raydium, Orca, and pump.fun for new launches...');

  // Schedule daily summary (every 24 hours)
  setInterval(sendDailySummaryReport, 24 * 60 * 60 * 1000);

  return {
    success: true,
    message: 'AI Gem Hunter started successfully',
    stats: getServiceStats()
  };
}

/**
 * Stop the AI Gem Hunter service
 */
export function stopGemHunter() {
  if (!isRunning) {
    return { success: false, message: 'Service not running' };
  }

  console.log('⏸️ Stopping AI Gem Hunter Service...');

  if (discoveryWebSocket) {
    discoveryWebSocket.close();
    discoveryWebSocket = null;
  }

  isRunning = false;

  console.log('✅ AI Gem Hunter Service stopped');

  return {
    success: true,
    message: 'Service stopped',
    stats: getServiceStats()
  };
}

/**
 * Handle gem discovered callback
 * @param {Object} gemData - Discovered gem data
 */
async function handleGemDiscovered(gemData) {
  try {
    console.log(`💎 Gem discovered: ${gemData.tokenAddress}`);

    stats.gemsDiscovered++;

    // Add to top gems list
    stats.topGems.push({
      address: gemData.tokenAddress,
      name: gemData.basicData.name,
      symbol: gemData.basicData.symbol,
      score: gemData.gemScore,
      discoveredAt: new Date()
    });

    // Keep only top 10 gems
    stats.topGems.sort((a, b) => b.score - a.score);
    stats.topGems = stats.topGems.slice(0, 10);

    // Determine if we should send alert based on gem score
    // Only send alerts for high-quality gems (score >= 80)
    if (gemData.gemScore >= 80) {
      // High-quality gem - send alert
      const alertResult = await sendGemAlert(gemData);
      
      if (alertResult.success) {
        stats.alertsSent++;
        console.log(`✅ Gem alert sent: ${gemData.basicData.name}`);
      } else {
        console.error(`❌ Failed to send gem alert: ${alertResult.error}`);
      }
    } else {
      console.log(`📊 Gem score below threshold (${gemData.gemScore}/100 < 80) - no alert sent`);
    }

    // Check for critical warnings (bundled launch, deployer funding, etc.)
    await checkForCriticalWarnings(gemData);

  } catch (error) {
    console.error('Error handling gem discovery:', error.message);
  }
}

/**
 * Check for critical warnings and send alerts
 * @param {Object} gemData - Gem data
 */
async function checkForCriticalWarnings(gemData) {
  const warnings = [];

  // Check volume authenticity
  if (gemData.filters.volumeAuthenticity && !gemData.filters.volumeAuthenticity.isAuthentic) {
    warnings.push(`Wash trading detected: ${gemData.filters.volumeAuthenticity.reason}`);
  }

  // Check wallet clustering
  if (gemData.filters.walletClustering && gemData.filters.walletClustering.isSuspicious) {
    warnings.push(`Suspicious wallet clustering: ${(gemData.filters.walletClustering.clusteringScore * 100).toFixed(1)}%`);
  }

  // Check top holder concentration
  if (gemData.basicData.top_holder_percent > 40) {
    warnings.push(`High holder concentration: Top holder owns ${gemData.basicData.top_holder_percent.toFixed(1)}%`);
  }

  // Check liquidity
  if (gemData.basicData.liquidity_usd < 20000) {
    warnings.push(`Low liquidity: Only $${gemData.basicData.liquidity_usd.toFixed(0)}`);
  }

  // If we have critical warnings, send alert
  if (warnings.length >= 2) {
    const warningData = {
      tokenAddress: gemData.tokenAddress,
      tokenName: gemData.basicData.name,
      tokenSymbol: gemData.basicData.symbol,
      warningType: 'Multiple Risk Factors Detected',
      details: warnings
    };

    const result = await sendCriticalWarning(warningData);
    
    if (result.success) {
      stats.criticalWarnings++;
      console.log(`🚨 Critical warning sent: ${gemData.basicData.name}`);
    }
  }
}

/**
 * Send daily summary report
 */
async function sendDailySummaryReport() {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get gems discovered in the last 24 hours from database
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentGems, error: gemsError } = await supabase
      .from('gem_discoveries')
      .select('*')
      .gte('discovered_at', oneDayAgo)
      .order('initial_score', { ascending: false });

    const gemsDiscovered = recentGems?.length || 0;

    // Get alerts sent in the last 24 hours from database
    const { data: recentAlerts, error: alertsError } = await supabase
      .from('gem_discoveries')
      .select('*')
      .gte('discovered_at', oneDayAgo)
      .gte('initial_score', 80); // Alerts are sent for gems with score >= 80

    const alertsSent = recentAlerts?.length || 0;

    // Prepare top gems data
    const topGems = (recentGems || []).slice(0, 5).map(gem => ({
      name: gem.token_name || 'Unknown',
      symbol: gem.token_symbol || 'N/A',
      score: gem.initial_score || 0
    }));

    const summaryData = {
      gemsDiscovered,
      alertsSent,
      topGems,
      performance: {
        avgScore: topGems.length > 0
          ? topGems.reduce((sum, gem) => sum + gem.score, 0) / topGems.length
          : 0,
        accuracy: 0, // Would calculate from historical data
        bestPerformer: topGems[0]?.name || 'N/A'
      }
    };

    console.log(`📊 Daily summary data: ${gemsDiscovered} gems discovered, ${alertsSent} alerts sent`);
    await sendDailySummary(summaryData);
    console.log('📊 Daily summary sent');

    // Note: We don't reset database stats, only in-memory stats for current session
    stats.gemsDiscovered = 0;
    stats.alertsSent = 0;
    stats.criticalWarnings = 0;
  } catch (error) {
    console.error('Error sending daily summary:', error.message);
  }
}

/**
 * Get service statistics
 */
export function getServiceStats() {
  return {
    isRunning,
    uptime: stats.startTime ? Date.now() - stats.startTime.getTime() : 0,
    gemsDiscovered: stats.gemsDiscovered,
    alertsSent: stats.alertsSent,
    criticalWarnings: stats.criticalWarnings,
    topGems: stats.topGems.slice(0, 5),
    discoveryStats: getDiscoveryStats()
  };
}

/**
 * Get service status
 */
export function getServiceStatus() {
  return {
    running: isRunning,
    startTime: stats.startTime,
    stats: getServiceStats()
  };
}
Daily Summary of AI Gem Hunter Activity - Manus
