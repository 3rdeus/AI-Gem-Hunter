/**
 * Momentum Alert System
 * Sends alerts for high-momentum tokens (40-69 gaining ≥10 points)
 */

import { sendTelegramMessage } from './telegram-bot.mjs';
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

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send momentum alert for early-stage rocket
 */
export async function sendMomentumAlert(alertData) {
  const { token, oldScore, newScore, scoreChange, hoursElapsed, velocity } = alertData;

  console.log(`[MOMENTUM-ALERT] 🚀 Sending momentum alert for ${token}`);

  const message = `
🚀🚀🚀 HIGH MOMENTUM ALERT! 🚀🚀🚀

**Early Stage Rocket Detected!**

📍 Token: \`${token}\`

📊 **Momentum:**
• Score jumped: ${oldScore} → ${newScore} (+${scoreChange} points)
• Time: ${hoursElapsed}h
• Velocity: +${velocity} points/hour
• Status: 🚀 ACCELERATING

💡 **Why This Matters:**
This token is gaining momentum FAST! It's still in the 40-69 range (risky/speculative) but showing strong upward movement. This could be an early-stage moonshot before it hits the "Good" tier (70+).

⚠️ **Risk Level:** HIGH (still below 70)
🎯 **Opportunity:** Early entry before mainstream discovery

🔍 **Next Steps:**
1. Check Solscan: https://solscan.io/token/${token}
2. Verify liquidity and volume trends
3. Check holder distribution
4. DYOR before investing!

⏰ Alert sent: ${new Date().toLocaleString()}
`;

  try {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, message);
    
    // Log alert to database
    await supabase
      .from('gem_alerts_sent')
      .insert({
        token_address: token,
        alert_type: 'momentum',
        score: newScore,
        message: message.substring(0, 500) // Store truncated version
      });

    console.log(`[MOMENTUM-ALERT] ✅ Momentum alert sent for ${token}`);
    return { success: true };

  } catch (error) {
    console.error(`[MOMENTUM-ALERT] ❌ Error sending momentum alert:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send upgrade alert for token crossing 70+
 */
export async function sendUpgradeAlert(alertData) {
  const { token, oldScore, newScore, scoreChange, hoursElapsed } = alertData;

  console.log(`[MOMENTUM-ALERT] 💎 Sending upgrade alert for ${token}`);

  // Determine tier
  let tier = '';
  let emoji = '';
  if (newScore >= 80) {
    tier = 'EXCELLENT';
    emoji = '🔥';
  } else if (newScore >= 70) {
    tier = 'GOOD';
    emoji = '💎';
  }

  const message = `
${emoji}${emoji}${emoji} WATCHLIST UPGRADE! ${emoji}${emoji}${emoji}

**Token Crossed Into ${tier} Tier!**

📍 Token: \`${token}\`

📊 **Upgrade:**
• Previous Score: ${oldScore} (Risky/Speculative)
• Current Score: ${newScore} (${tier})
• Improvement: +${scoreChange} points
• Time: ${hoursElapsed}h

${emoji} **Status:** Now qualifies as a ${tier} gem!

💡 **What This Means:**
This token has improved significantly and now meets our quality standards for ${tier} gems. It was previously too risky to alert on, but has proven itself through improved metrics.

✅ **Validation:**
• Crossed the 70-point threshold
• Metrics have strengthened
• Risk level reduced

🔍 **Action:**
Check it out NOW: https://solscan.io/token/${token}

This was on our watchlist and just graduated to alert-worthy status!

⏰ Alert sent: ${new Date().toLocaleString()}
`;

  try {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, message);
    
    // Log alert to database
    await supabase
      .from('gem_alerts_sent')
      .insert({
        token_address: token,
        alert_type: 'upgrade',
        score: newScore,
        message: message.substring(0, 500)
      });

    console.log(`[MOMENTUM-ALERT] ✅ Upgrade alert sent for ${token}`);
    return { success: true };

  } catch (error) {
    console.error(`[MOMENTUM-ALERT] ❌ Error sending upgrade alert:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send weekly momentum digest
 */
export async function sendWeeklyDigest(digestData) {
  console.log('[MOMENTUM-ALERT] 📊 Sending weekly momentum digest');

  const { topMovers, upgrades, summary } = digestData;

  let message = `
📊📊📊 WEEKLY MOMENTUM DIGEST 📊📊📊

**Period:** ${digestData.period}

🚀 **TOP 5 FASTEST MOVERS:**
${topMovers.length > 0 ? topMovers.map((t, i) => 
  `${i + 1}. \`${t.token.substring(0, 8)}...\`
   Score: ${t.score} | Velocity: +${t.velocity}/h | Change: +${t.change}`
).join('\n\n') : 'No significant movers this week'}

💎 **WATCHLIST UPGRADES (Crossed 70+):**
${upgrades.length > 0 ? upgrades.map((u, i) =>
  `${i + 1}. \`${u.token.substring(0, 8)}...\`
   ${u.oldScore} → ${u.newScore} (+${u.change} points)`
).join('\n\n') : 'No upgrades this week'}

📈 **SUMMARY:**
• Total Top Movers: ${summary.totalTopMovers}
• Total Upgrades: ${summary.totalUpgrades}
• Fastest Gainer: ${summary.fastestGainer ? `\`${summary.fastestGainer.substring(0, 12)}...\`` : 'N/A'}
• Peak Velocity: +${summary.fastestVelocity}/hour

💡 **Insights:**
${upgrades.length > 0 ? 
  `${upgrades.length} token(s) graduated from risky to quality tier this week - these were early opportunities!` :
  'No tokens crossed the quality threshold this week - market may be slow or filters are working well.'}

🎯 **Action Items:**
1. Review top movers for continued momentum
2. Check upgraded tokens for entry opportunities
3. Adjust watchlist based on trends

⏰ Digest sent: ${new Date().toLocaleString()}
`;

  try {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, message);
    console.log('[MOMENTUM-ALERT] ✅ Weekly digest sent');
    return { success: true };

  } catch (error) {
    console.error('[MOMENTUM-ALERT] ❌ Error sending weekly digest:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process and send all momentum alerts
 */
export async function processMomentumAlerts(momentumAlerts, upgradeAlerts) {
  console.log(`[MOMENTUM-ALERT] Processing ${momentumAlerts.length} momentum + ${upgradeAlerts.length} upgrade alerts`);

  const results = {
    momentumSent: 0,
    upgradeSent: 0,
    errors: []
  };

  // Send momentum alerts
  for (const alert of momentumAlerts) {
    const result = await sendMomentumAlert(alert);
    if (result.success) {
      results.momentumSent++;
    } else {
      results.errors.push({ type: 'momentum', token: alert.token, error: result.error });
    }
  }

  // Send upgrade alerts
  for (const alert of upgradeAlerts) {
    const result = await sendUpgradeAlert(alert);
    if (result.success) {
      results.upgradeSent++;
    } else {
      results.errors.push({ type: 'upgrade', token: alert.token, error: result.error });
    }
  }

  console.log(`[MOMENTUM-ALERT] ✅ Sent ${results.momentumSent} momentum + ${results.upgradeSent} upgrade alerts`);
  if (results.errors.length > 0) {
    console.error(`[MOMENTUM-ALERT] ⚠️ ${results.errors.length} errors occurred`);
  }

  return results;
}

export default {
  sendMomentumAlert,
  sendUpgradeAlert,
  sendWeeklyDigest,
  processMomentumAlerts
};
