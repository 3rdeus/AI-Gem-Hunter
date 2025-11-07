/**
 * Telegram Bot Integration for AI Gem Hunter
 * Sends real-time alerts for discovered gems, pump/dump signals, and exit alerts
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '7697687181';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Alert types with emoji and formatting
 */
const ALERT_TYPES = {
  GEM_DISCOVERED: {
    emoji: '💎',
    color: '🟢',
    title: 'NEW GEM DISCOVERED'
  },
  CRITICAL_WARNING: {
    emoji: '🚨',
    color: '🔴',
    title: 'CRITICAL WARNING'
  },
  PUMP_DETECTED: {
    emoji: '🚀',
    color: '🟡',
    title: 'PUMP DETECTED'
  },
  DUMP_DETECTED: {
    emoji: '📉',
    color: '🔴',
    title: 'DUMP DETECTED'
  },
  EXIT_SIGNAL: {
    emoji: '🎯',
    color: '🟠',
    title: 'EXIT SIGNAL'
  },
  SMART_MONEY: {
    emoji: '🧠',
    color: '🟢',
    title: 'SMART MONEY ALERT'
  },
  ENTRY_SIGNAL: {
    emoji: '🎯',
    color: '🟢',
    title: 'ENTRY SIGNAL'
  },
  VOLATILITY_SPIKE: {
    emoji: '⚡',
    color: '🟡',
    title: 'VOLATILITY SPIKE WARNING'
  },
  PROFIT_TARGET: {
    emoji: '💰',
    color: '🟢',
    title: 'PROFIT TARGET HIT'
  }
};

/**
 * Send a message to Telegram
 * @param {string} message - Message text (supports Markdown)
 * @param {Object} options - Additional options
 */
export async function sendTelegramMessage(message, options = {}) {
  try {
    const {
      chatId = TELEGRAM_CHAT_ID,
      parseMode = 'Markdown',
      disableWebPagePreview = true,
      disableNotification = false
    } = options;

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: disableWebPagePreview,
        disable_notification: disableNotification
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return { success: false, error: data.description };
    }

    return { success: true, messageId: data.result.message_id };
  } catch (error) {
    console.error('Telegram send error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send gem discovery alert
 * @param {Object} gemData - Gem discovery data
 */
export async function sendGemAlert(gemData) {
  const {
    tokenAddress,
    basicData,
    gemScore,
    source,
    filters
  } = gemData;

  const alert = ALERT_TYPES.GEM_DISCOVERED;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  // Token info
  message += `*Token:* ${basicData.name} (${basicData.symbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n`;
  message += `*Source:* ${source}\n\n`;
  
  // Gem score
  message += `*💎 Gem Score:* ${gemScore}/100\n\n`;
  
  // Key metrics
  message += `*📊 Key Metrics:*\n`;
  message += `• Liquidity: $${formatNumber(basicData.liquidity_usd)}\n`;
  message += `• Holders: ${formatNumber(basicData.holder_count)}\n`;
  message += `• Volume 24h: $${formatNumber(basicData.volume_24h_usd)}\n`;
  message += `• Price: $${basicData.price_usd.toFixed(8)}\n`;
  message += `• Market Cap: $${formatNumber(basicData.market_cap_usd)}\n`;
  message += `• Top Holder: ${basicData.top_holder_percent.toFixed(1)}%\n\n`;
  
  // Volume authenticity
  if (filters.volumeAuthenticity?.isAuthentic) {
    message += `✅ *Volume Authentic*\n`;
    message += `• Unique buyers: ${filters.volumeAuthenticity.uniqueBuyers}\n`;
    message += `• Wash trading: ${(filters.volumeAuthenticity.washTradingRatio * 100).toFixed(1)}%\n\n`;
  }
  
  // Wallet clustering
  if (filters.walletClustering) {
    const clusterStatus = filters.walletClustering.isSuspicious ? '⚠️' : '✅';
    message += `${clusterStatus} *Wallet Clustering:* ${(filters.walletClustering.clusteringScore * 100).toFixed(1)}%\n\n`;
  }
  
  // Links
  message += `*🔗 Quick Links:*\n`;
  message += `• [Birdeye](https://birdeye.so/token/${tokenAddress})\n`;
  message += `• [Solscan](https://solscan.io/token/${tokenAddress})\n`;
  message += `• [DexScreener](https://dexscreener.com/solana/${tokenAddress})\n`;
  message += `• [Axiom Pro](https://axiom.trade/token/${tokenAddress})\n\n`;
  
  // Action recommendation
  if (gemScore >= 80) {
    message += `🎯 *Action:* STRONG BUY - High quality gem\n`;
  } else if (gemScore >= 60) {
    message += `🎯 *Action:* CONSIDER BUY - Good potential\n`;
  } else {
    message += `🎯 *Action:* WATCH - Monitor for improvements\n`;
  }
  
  message += `\n⏰ Discovered: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Send critical warning alert
 * @param {Object} warningData - Warning data
 */
export async function sendCriticalWarning(warningData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    warningType,
    details
  } = warningData;

  const alert = ALERT_TYPES.CRITICAL_WARNING;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*⚠️ Warning:* ${warningType}\n\n`;
  
  message += `*Details:*\n`;
  details.forEach(detail => {
    message += `• ${detail}\n`;
  });
  
  message += `\n🚨 *Action:* DO NOT BUY - High risk detected\n`;
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message, { disableNotification: false });
}

/**
 * Send pump detection alert
 * @param {Object} pumpData - Pump detection data
 */
export async function sendPumpAlert(pumpData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    priceChange,
    volumeChange,
    timeframe
  } = pumpData;

  const alert = ALERT_TYPES.PUMP_DETECTED;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*📈 Pump Metrics:*\n`;
  message += `• Price change: +${priceChange.toFixed(1)}% in ${timeframe}\n`;
  message += `• Volume change: +${volumeChange.toFixed(1)}%\n\n`;
  
  message += `🎯 *Action:* Consider taking profits or setting stop loss\n`;
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Send dump detection alert
 * @param {Object} dumpData - Dump detection data
 */
export async function sendDumpAlert(dumpData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    priceChange,
    reason
  } = dumpData;

  const alert = ALERT_TYPES.DUMP_DETECTED;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*📉 Dump Detected:*\n`;
  message += `• Price change: ${priceChange.toFixed(1)}%\n`;
  message += `• Reason: ${reason}\n\n`;
  
  message += `🚨 *Action:* SELL IMMEDIATELY - Dump in progress\n`;
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message, { disableNotification: false });
}

/**
 * Send exit signal alert
 * @param {Object} exitData - Exit signal data
 */
export async function sendExitSignal(exitData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    signalType,
    currentPrice,
    entryPrice,
    profitPercent
  } = exitData;

  const alert = ALERT_TYPES.EXIT_SIGNAL;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*🎯 Exit Signal:* ${signalType}\n\n`;
  
  message += `*Performance:*\n`;
  message += `• Entry: $${entryPrice.toFixed(8)}\n`;
  message += `• Current: $${currentPrice.toFixed(8)}\n`;
  message += `• P&L: ${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(1)}%\n\n`;
  
  if (profitPercent >= 100) {
    message += `🎉 *Action:* Take profits - Excellent gain!\n`;
  } else if (profitPercent >= 50) {
    message += `💰 *Action:* Consider taking partial profits\n`;
  } else if (profitPercent < 0) {
    message += `🛑 *Action:* Cut losses - Stop loss triggered\n`;
  } else {
    message += `🎯 *Action:* Review position and decide\n`;
  }
  
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Send smart money alert
 * @param {Object} smartMoneyData - Smart money activity data
 */
export async function sendSmartMoneyAlert(smartMoneyData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    eliteWallets,
    totalInvested,
    signal
  } = smartMoneyData;

  const alert = ALERT_TYPES.SMART_MONEY;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*🏆 Smart Money Activity:*\n`;
  message += `• Elite wallets: ${eliteWallets}\n`;
  message += `• Total invested: $${formatNumber(totalInvested)}\n`;
  message += `• Signal: ${signal}\n\n`;
  
  if (signal === 'STRONG_BUY') {
    message += `💰 *Action:* STRONG BUY - Elite wallets accumulating\n`;
  } else if (signal === 'BUY') {
    message += `💰 *Action:* Consider buying - Smart money interest\n`;
  } else {
    message += `👀 *Action:* WATCH - Monitor smart wallet activity\n`;
  }
  
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Send daily summary
 * @param {Object} summaryData - Daily summary data
 */
export async function sendDailySummary(summaryData) {
  const {
    gemsDiscovered,
    alertsSent,
    topGems,
    performance
  } = summaryData;

  let message = `📊 *DAILY SUMMARY* 📊\n\n`;
  
  message += `*Activity:*\n`;
  message += `• Gems discovered: ${gemsDiscovered}\n`;
  message += `• Alerts sent: ${alertsSent}\n\n`;
  
  if (topGems && topGems.length > 0) {
    message += `*🏆 Top Gems:*\n`;
    topGems.slice(0, 5).forEach((gem, index) => {
      message += `${index + 1}. ${gem.name} (${gem.symbol}) - Score: ${gem.score}/100\n`;
    });
    message += `\n`;
  }
  
  if (performance) {
    message += `*📈 Performance:*\n`;
    message += `• Avg gem score: ${performance.avgScore.toFixed(1)}/100\n`;
    message += `• Accuracy: ${performance.accuracy.toFixed(1)}%\n`;
    message += `• Best performer: ${performance.bestPerformer}\n\n`;
  }
  
  message += `⏰ ${new Date().toLocaleDateString('en-US')}`;

  return sendTelegramMessage(message);
}

/**
 * Send test message
 */
export async function sendTestMessage() {
  const message = `🤖 *AI Gem Hunter Bot - Test Message*\n\n` +
    `✅ Bot is connected and working!\n\n` +
    `Your Telegram ID: \`${TELEGRAM_CHAT_ID}\`\n\n` +
    `You will receive alerts for:\n` +
    `• 💎 New gem discoveries\n` +
    `• 🚨 Critical warnings\n` +
    `• 🚀 Pump detections\n` +
    `• 📉 Dump alerts\n` +
    `• 🎯 Exit signals\n` +
    `• 🧠 Smart money activity\n\n` +
    `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Format large numbers with K, M, B suffixes
 */
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/**
 * Set up bot commands (call this once during setup)
 */
export async function setupBotCommands() {
  try {
    const commands = [
      { command: 'start', description: 'Start receiving alerts' },
      { command: 'stop', description: 'Stop receiving alerts' },
      { command: 'status', description: 'Check bot status' },
      { command: 'summary', description: 'Get daily summary' },
      { command: 'help', description: 'Show help message' }
    ];

    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });

    const data = await response.json();
    return { success: data.ok };
  } catch (error) {
    console.error('Setup commands error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle incoming messages (for bot commands)
 */
export async function handleBotUpdate(update) {
  try {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.toLowerCase();

    let response = '';

    switch (text) {
      case '/start':
        response = `🤖 *AI Gem Hunter Bot*\n\nWelcome! You will now receive real-time alerts for:\n\n` +
          `• 💎 New gem discoveries\n` +
          `• 🚨 Critical warnings\n` +
          `• 🚀 Pump/dump signals\n` +
          `• 🎯 Exit signals\n` +
          `• 🧠 Smart money activity\n\n` +
          `Use /help to see all commands.`;
        break;

      case '/stop':
        response = `⏸️ Alerts paused. Use /start to resume.`;
        break;

      case '/status':
        response = `✅ *Bot Status*\n\nBot is active and monitoring the blockchain 24/7.\n\n` +
          `Your chat ID: \`${chatId}\``;
        break;

      case '/summary':
        // Would fetch real summary data
        response = `📊 *Daily Summary*\n\nNo data available yet. Check back after 24 hours of monitoring.`;
        break;

      case '/help':
        response = `🤖 *AI Gem Hunter Bot - Help*\n\n` +
          `*Commands:*\n` +
          `/start - Start receiving alerts\n` +
          `/stop - Pause alerts\n` +
          `/status - Check bot status\n` +
          `/summary - Get daily summary\n` +
          `/help - Show this message\n\n` +
          `*Alert Types:*\n` +
          `💎 Gem Discovery - New high-quality tokens\n` +
          `🚨 Critical Warning - Dangerous tokens to avoid\n` +
          `🚀 Pump Alert - Price surge detected\n` +
          `📉 Dump Alert - Price crash detected\n` +
          `🎯 Exit Signal - Time to sell\n` +
          `🧠 Smart Money - Elite wallets buying\n\n` +
          `Questions? Contact support.`;
        break;

      default:
        response = `Unknown command. Use /help to see available commands.`;
    }

    await sendTelegramMessage(response, { chatId });
  } catch (error) {
    console.error('Handle update error:', error.message);
  }
}

/**
 * Get webhook info
 */
export async function getWebhookInfo() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Get webhook info error:', error.message);
    return null;
  }
}

/**
 * Set webhook for receiving updates
 * @param {string} webhookUrl - Your webhook URL
 */
export async function setWebhook(webhookUrl) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    return { success: data.ok, description: data.description };
  } catch (error) {
    console.error('Set webhook error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send entry signal alert
 * @param {Object} entryData - Entry signal data
 */
export async function sendEntrySignal(entryData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    currentPrice,
    gemScore,
    liquidity,
    holders,
    reason
  } = entryData;

  const alert = ALERT_TYPES.ENTRY_SIGNAL;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*📊 Entry Metrics:*\n`;
  message += `• Price: $${currentPrice.toFixed(8)}\n`;
  message += `• Gem Score: ${gemScore}/100\n`;
  message += `• Liquidity: $${formatNumber(liquidity)}\n`;
  message += `• Holders: ${formatNumber(holders)}\n\n`;
  
  message += `*💡 Reason:* ${reason}\n\n`;
  
  message += `🎯 *Action:* ENTER NOW - Optimal entry point detected\n`;
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}

/**
 * Send volatility spike warning
 * @param {Object} volatilityData - Volatility data
 */
export async function sendVolatilityWarning(volatilityData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    volatilityPercent,
    priceSwing,
    timeframe,
    recommendation
  } = volatilityData;

  const alert = ALERT_TYPES.VOLATILITY_SPIKE;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*⚡ Volatility Metrics:*\n`;
  message += `• Volatility: ${volatilityPercent.toFixed(1)}%\n`;
  message += `• Price swing: ${priceSwing >= 0 ? '+' : ''}${priceSwing.toFixed(1)}%\n`;
  message += `• Timeframe: ${timeframe}\n\n`;
  
  message += `⚠️ *Warning:* High volatility detected - Price may swing rapidly\n\n`;
  
  if (recommendation === 'EXIT') {
    message += `🚨 *Action:* EXIT ADVISED - Volatility too high, protect profits\n`;
  } else if (recommendation === 'REDUCE') {
    message += `⚠️ *Action:* REDUCE POSITION - Consider taking partial profits\n`;
  } else {
    message += `👀 *Action:* MONITOR CLOSELY - Set tight stop loss\n`;
  }
  
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message, { disableNotification: false });
}

/**
 * Send profit target hit alert
 * @param {Object} profitData - Profit target data
 */
export async function sendProfitTargetAlert(profitData) {
  const {
    tokenAddress,
    tokenName,
    tokenSymbol,
    entryPrice,
    currentPrice,
    profitPercent,
    targetMultiple,
    totalGainUsd
  } = profitData;

  const alert = ALERT_TYPES.PROFIT_TARGET;
  
  let message = `${alert.emoji} *${alert.title}* ${alert.color}\n\n`;
  
  message += `*Token:* ${tokenName} (${tokenSymbol})\n`;
  message += `*Address:* \`${tokenAddress}\`\n\n`;
  
  message += `*🎉 Profit Target:* ${targetMultiple}x\n\n`;
  
  message += `*Performance:*\n`;
  message += `• Entry: $${entryPrice.toFixed(8)}\n`;
  message += `• Current: $${currentPrice.toFixed(8)}\n`;
  message += `• Gain: +${profitPercent.toFixed(1)}%\n`;
  if (totalGainUsd) {
    message += `• Total profit: $${formatNumber(totalGainUsd)}\n`;
  }
  message += `\n`;
  
  if (targetMultiple >= 10) {
    message += `🚀 *Action:* TAKE PROFITS NOW - Exceptional gain! Consider selling 50-75%\n`;
  } else if (targetMultiple >= 5) {
    message += `💰 *Action:* TAKE PROFITS - Excellent gain! Consider selling 30-50%\n`;
  } else if (targetMultiple >= 2) {
    message += `✅ *Action:* SECURE PROFITS - Good gain! Consider selling 20-30%\n`;
  } else {
    message += `📊 *Action:* PARTIAL PROFITS - Consider taking some off the table\n`;
  }
  
  message += `\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  return sendTelegramMessage(message);
}
