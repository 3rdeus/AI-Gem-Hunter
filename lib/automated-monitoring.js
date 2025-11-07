/**
 * Automated Monitoring System
 * Real-time alerts for suspicious patterns and opportunities
 * Can be run as a standalone service or integrated with n8n
 */

import { detectBundledLaunch } from './bundle-detection.js';
import { analyzeDeployerFunding } from './deployer-funding.js';
import { getSmartWalletActivity } from './smart-wallet-index.js';

/**
 * Alert types and their severity levels
 */
export const ALERT_TYPES = {
  BUNDLED_LAUNCH: { severity: 'CRITICAL', emoji: '🚨' },
  DEPLOYER_FUNDING: { severity: 'WARNING', emoji: '⚠️' },
  SMART_WALLET_QUORUM: { severity: 'OPPORTUNITY', emoji: '💰' },
  SECOND_WAVE: { severity: 'SIGNAL', emoji: '📊' },
  HONEYPOT_DETECTED: { severity: 'CRITICAL', emoji: '🚨' },
  MINT_AUTHORITY: { severity: 'WARNING', emoji: '⚠️' }
};

/**
 * Monitor a token and generate alerts
 * @param {string} tokenAddress - Token address to monitor
 * @returns {Promise<Object>} Monitoring results with alerts
 */
export async function monitorToken(tokenAddress) {
  try {
    console.log(`Monitoring token: ${tokenAddress}`);

    const alerts = [];
    const startTime = Date.now();

    // Run all detection modules in parallel
    const [bundleResult, fundingResult, smartWalletResult] = await Promise.allSettled([
      detectBundledLaunch(tokenAddress),
      analyzeDeployerFunding(tokenAddress),
      getSmartWalletActivity(tokenAddress)
    ]);

    // Process bundle detection
    if (bundleResult.status === 'fulfilled' && bundleResult.value?.success) {
      const bundle = bundleResult.value;
      
      if (bundle.is_bundled && bundle.bundle_analysis.risk_score >= 70) {
        alerts.push({
          type: 'BUNDLED_LAUNCH',
          severity: ALERT_TYPES.BUNDLED_LAUNCH.severity,
          title: '🚨 Bundled Launch Detected',
          message: `${bundle.bundle_analysis.coordinated_wallets} wallets bought in coordinated cluster`,
          details: bundle.bundle_analysis.evidence,
          risk_score: bundle.bundle_analysis.risk_score,
          action: 'DO NOT BUY - High insider trading risk',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Process deployer funding
    if (fundingResult.status === 'fulfilled' && fundingResult.value?.success) {
      const funding = fundingResult.value;
      
      if (funding.insider_confidence >= 0.7) {
        alerts.push({
          type: 'DEPLOYER_FUNDING',
          severity: ALERT_TYPES.DEPLOYER_FUNDING.severity,
          title: '⚠️ Deployer Funding Detected',
          message: `${funding.total_funded} early buyers funded by deployer (${funding.total_funding_sol.toFixed(2)} SOL)`,
          details: [
            `${funding.funded_percentage.toFixed(1)}% of early buyers funded`,
            `Insider confidence: ${(funding.insider_confidence * 100).toFixed(0)}%`
          ],
          risk_score: Math.round(funding.insider_confidence * 100),
          action: 'CAUTION - Possible insider trading',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Process smart wallet activity
    if (smartWalletResult.status === 'fulfilled' && smartWalletResult.value?.success) {
      const activity = smartWalletResult.value;
      
      // Smart wallet quorum alert
      if (activity.quorum?.quorum_met) {
        alerts.push({
          type: 'SMART_WALLET_QUORUM',
          severity: ALERT_TYPES.SMART_WALLET_QUORUM.severity,
          title: '💰 Smart Money Quorum',
          message: `${activity.quorum.elite_wallets_buying} elite wallets holding`,
          details: [
            `Average reputation: ${activity.quorum.avg_wallet_reputation}/100`,
            `Signal: ${activity.quorum.signal}`
          ],
          risk_score: 0, // This is a positive signal
          action: 'OPPORTUNITY - Consider buying',
          timestamp: new Date().toISOString()
        });
      }

      // Second-wave accumulation alert
      if (activity.second_wave?.second_wave_detected) {
        alerts.push({
          type: 'SECOND_WAVE',
          severity: ALERT_TYPES.SECOND_WAVE.severity,
          title: '📊 Second-Wave Accumulation',
          message: `${activity.second_wave.total_smart_wallets_accumulating} smart wallets re-entering`,
          details: [
            `Total re-invested: $${activity.second_wave.total_re_invested_usd.toFixed(0)}`,
            `Bullish confidence: ${(activity.second_wave.bullish_confidence * 100).toFixed(0)}%`,
            `Price drop from peak: ${(activity.second_wave.price_drop_from_peak * 100).toFixed(1)}%`
          ],
          risk_score: 0, // This is a positive signal
          action: 'SIGNAL - High-conviction buying detected',
          timestamp: new Date().toISOString()
        });
      }
    }

    const monitoringTime = Date.now() - startTime;

    return {
      success: true,
      token_address: tokenAddress,
      alerts: alerts,
      alert_count: alerts.length,
      critical_alerts: alerts.filter(a => a.severity === 'CRITICAL').length,
      warning_alerts: alerts.filter(a => a.severity === 'WARNING').length,
      opportunity_alerts: alerts.filter(a => a.severity === 'OPPORTUNITY').length,
      monitoring_time_ms: monitoringTime,
      monitored_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Token monitoring error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Monitor multiple tokens in batch
 * @param {Array<string>} tokenAddresses - Array of token addresses
 * @returns {Promise<Array>} Monitoring results for all tokens
 */
export async function monitorTokenBatch(tokenAddresses) {
  const results = [];

  for (const address of tokenAddresses) {
    const result = await monitorToken(address);
    results.push(result);
    
    // Rate limiting - wait 500ms between tokens
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Generate alert notification text for different channels
 * @param {Object} alert - Alert object
 * @param {string} format - Format type ('telegram', 'discord', 'email')
 * @returns {string} Formatted alert message
 */
export function formatAlertNotification(alert, format = 'telegram') {
  switch (format) {
    case 'telegram':
      return formatTelegramAlert(alert);
    case 'discord':
      return formatDiscordAlert(alert);
    case 'email':
      return formatEmailAlert(alert);
    default:
      return formatPlainTextAlert(alert);
  }
}

/**
 * Format alert for Telegram
 */
function formatTelegramAlert(alert) {
  let message = `${alert.title}\n\n`;
  message += `📍 *${alert.message}*\n\n`;
  
  if (alert.details && alert.details.length > 0) {
    message += `Details:\n`;
    alert.details.forEach(detail => {
      message += `• ${detail}\n`;
    });
    message += `\n`;
  }
  
  if (alert.risk_score > 0) {
    message += `⚠️ Risk Score: ${alert.risk_score}/100\n`;
  }
  
  message += `\n✅ Action: ${alert.action}`;
  
  return message;
}

/**
 * Format alert for Discord
 */
function formatDiscordAlert(alert) {
  return {
    embeds: [{
      title: alert.title,
      description: alert.message,
      color: getSeverityColor(alert.severity),
      fields: [
        ...(alert.details || []).map(detail => ({
          name: '📋 Detail',
          value: detail,
          inline: false
        })),
        {
          name: '🎯 Action',
          value: alert.action,
          inline: false
        }
      ],
      footer: {
        text: `Severity: ${alert.severity} | ${alert.timestamp}`
      }
    }]
  };
}

/**
 * Format alert for email
 */
function formatEmailAlert(alert) {
  return {
    subject: `[${alert.severity}] ${alert.title}`,
    body: `
      <h2>${alert.title}</h2>
      <p><strong>${alert.message}</strong></p>
      
      ${alert.details && alert.details.length > 0 ? `
        <h3>Details:</h3>
        <ul>
          ${alert.details.map(d => `<li>${d}</li>`).join('')}
        </ul>
      ` : ''}
      
      ${alert.risk_score > 0 ? `
        <p><strong>Risk Score:</strong> ${alert.risk_score}/100</p>
      ` : ''}
      
      <p><strong>Recommended Action:</strong> ${alert.action}</p>
      
      <hr>
      <p><small>Severity: ${alert.severity} | ${alert.timestamp}</small></p>
    `
  };
}

/**
 * Format alert as plain text
 */
function formatPlainTextAlert(alert) {
  let text = `${alert.title}\n`;
  text += `${alert.message}\n\n`;
  
  if (alert.details && alert.details.length > 0) {
    text += `Details:\n`;
    alert.details.forEach(detail => {
      text += `- ${detail}\n`;
    });
    text += `\n`;
  }
  
  if (alert.risk_score > 0) {
    text += `Risk Score: ${alert.risk_score}/100\n`;
  }
  
  text += `\nAction: ${alert.action}\n`;
  text += `Severity: ${alert.severity} | ${alert.timestamp}`;
  
  return text;
}

/**
 * Get Discord color for severity level
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return 0xFF0000; // Red
    case 'WARNING': return 0xFFA500; // Orange
    case 'OPPORTUNITY': return 0x00FF00; // Green
    case 'SIGNAL': return 0x0000FF; // Blue
    default: return 0x808080; // Gray
  }
}

/**
 * Send alert to Telegram
 * @param {Object} alert - Alert object
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 */
export async function sendTelegramAlert(alert, botToken, chatId) {
  try {
    const message = formatAlertNotification(alert, 'telegram');
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Telegram alert error:', error.message);
    return false;
  }
}

/**
 * Send alert to Discord
 * @param {Object} alert - Alert object
 * @param {string} webhookUrl - Discord webhook URL
 */
export async function sendDiscordAlert(alert, webhookUrl) {
  try {
    const payload = formatAlertNotification(alert, 'discord');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (error) {
    console.error('Discord alert error:', error.message);
    return false;
  }
}

/**
 * Create monitoring schedule configuration for n8n
 */
export function generateN8nWorkflow() {
  return {
    name: 'Token Safety Monitor',
    nodes: [
      {
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        parameters: {
          rule: {
            interval: [{ field: 'minutes', minutesInterval: 5 }]
          }
        }
      },
      {
        name: 'Get Tokens to Monitor',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: 'https://token-safety-api.vercel.app/api/watchlist',
          method: 'GET'
        }
      },
      {
        name: 'Monitor Each Token',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: 'https://token-safety-api.vercel.app/api/monitor',
          method: 'POST',
          bodyParametersJson: '={{ { "tokenAddress": $json.address } }}'
        }
      },
      {
        name: 'Filter Critical Alerts',
        type: 'n8n-nodes-base.filter',
        parameters: {
          conditions: {
            boolean: [{
              value1: '={{ $json.critical_alerts }}',
              operation: 'larger',
              value2: 0
            }]
          }
        }
      },
      {
        name: 'Send Telegram Alert',
        type: 'n8n-nodes-base.telegram',
        parameters: {
          chatId: '{{ $env.TELEGRAM_CHAT_ID }}',
          text: '={{ $json.alerts[0].title }}\n\n{{ $json.alerts[0].message }}'
        }
      }
    ],
    connections: {
      'Schedule Trigger': { main: [[{ node: 'Get Tokens to Monitor' }]] },
      'Get Tokens to Monitor': { main: [[{ node: 'Monitor Each Token' }]] },
      'Monitor Each Token': { main: [[{ node: 'Filter Critical Alerts' }]] },
      'Filter Critical Alerts': { main: [[{ node: 'Send Telegram Alert' }]] }
    }
  };
}

/**
 * Standalone monitoring service (can be run with Node.js)
 */
export async function startMonitoringService(config) {
  console.log('Starting Token Safety Monitoring Service...');
  
  const {
    tokens = [],
    interval = 300000, // 5 minutes
    telegramBotToken,
    telegramChatId,
    discordWebhook
  } = config;

  // Monitor tokens on interval
  setInterval(async () => {
    console.log(`Monitoring ${tokens.length} tokens...`);
    
    for (const tokenAddress of tokens) {
      const result = await monitorToken(tokenAddress);
      
      if (result.success && result.alerts.length > 0) {
        console.log(`Found ${result.alerts.length} alerts for ${tokenAddress}`);
        
        // Send critical alerts
        const criticalAlerts = result.alerts.filter(a => a.severity === 'CRITICAL');
        
        for (const alert of criticalAlerts) {
          if (telegramBotToken && telegramChatId) {
            await sendTelegramAlert(alert, telegramBotToken, telegramChatId);
          }
          
          if (discordWebhook) {
            await sendDiscordAlert(alert, discordWebhook);
          }
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, interval);
}
