/**
 * Test All Alert Types API Endpoint
 * Sends all 9 alert types to verify bot functionality
 */

import {
  sendGemAlert,
  sendCriticalWarning,
  sendPumpAlert,
  sendDumpAlert,
  sendExitSignal,
  sendSmartMoneyAlert,
  sendEntrySignal,
  sendVolatilityWarning,
  sendProfitTargetAlert
} from '../lib/telegram-bot.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('Sending all test alerts...');
    
    const results = [];

    // 1. Gem Discovery Alert
    console.log('1/9: Sending gem alert...');
    const gemResult = await sendGemAlert({
      tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      basicData: {
        name: 'USD Coin',
        symbol: 'USDC',
        liquidity_usd: 1130000000,
        holder_count: 5600000,
        volume_24h_usd: 450000000,
        price_usd: 1.0,
        market_cap_usd: 35000000000,
        top_holder_percent: 5.2
      },
      gemScore: 95,
      source: 'Raydium',
      filters: {
        volumeAuthenticity: {
          isAuthentic: true,
          uniqueBuyers: 15000,
          washTradingRatio: 0.02
        },
        walletClustering: {
          clusteringScore: 0.05,
          isSuspicious: false
        }
      }
    });
    results.push({ type: 'gem_alert', success: gemResult.success });
    await sleep(2000);

    // 2. Critical Warning
    console.log('2/9: Sending critical warning...');
    const warningResult = await sendCriticalWarning({
      tokenAddress: 'ScamToken123456789',
      tokenName: 'Fake Token',
      tokenSymbol: 'SCAM',
      warningType: 'Bundled Launch Detected',
      details: [
        '15 wallets bought in coordinated cluster',
        '12 wallets funded by deployer',
        'Average 1.2s between buys - highly coordinated',
        'Top holder owns 45% of supply'
      ]
    });
    results.push({ type: 'critical_warning', success: warningResult.success });
    await sleep(2000);

    // 3. Entry Signal (NEW)
    console.log('3/9: Sending entry signal...');
    const entryResult = await sendEntrySignal({
      tokenAddress: 'EntryToken123456789',
      tokenName: 'Perfect Entry Token',
      tokenSymbol: 'ENTRY',
      currentPrice: 0.00001234,
      gemScore: 88,
      liquidity: 125000,
      holders: 450,
      reason: 'Price dipped to support level + Smart money accumulating + Volume spike'
    });
    results.push({ type: 'entry_signal', success: entryResult.success });
    await sleep(2000);

    // 4. Pump Alert
    console.log('4/9: Sending pump alert...');
    const pumpResult = await sendPumpAlert({
      tokenAddress: 'PumpToken123456789',
      tokenName: 'Pumping Token',
      tokenSymbol: 'PUMP',
      priceChange: 157.3,
      volumeChange: 450.2,
      timeframe: '15 minutes'
    });
    results.push({ type: 'pump_alert', success: pumpResult.success });
    await sleep(2000);

    // 5. Volatility Spike (NEW)
    console.log('5/9: Sending volatility warning...');
    const volatilityResult = await sendVolatilityWarning({
      tokenAddress: 'VolatileToken123456789',
      tokenName: 'Volatile Token',
      tokenSymbol: 'VOL',
      volatilityPercent: 85.5,
      priceSwing: -32.7,
      timeframe: '5 minutes',
      recommendation: 'EXIT'
    });
    results.push({ type: 'volatility_warning', success: volatilityResult.success });
    await sleep(2000);

    // 6. Dump Alert
    console.log('6/9: Sending dump alert...');
    const dumpResult = await sendDumpAlert({
      tokenAddress: 'DumpToken123456789',
      tokenName: 'Dumping Token',
      tokenSymbol: 'DUMP',
      priceChange: -45.7,
      reason: 'Top 3 holders sold 60% of their positions'
    });
    results.push({ type: 'dump_alert', success: dumpResult.success });
    await sleep(2000);

    // 7. Profit Target (NEW)
    console.log('7/9: Sending profit target alert...');
    const profitResult = await sendProfitTargetAlert({
      tokenAddress: 'ProfitToken123456789',
      tokenName: 'Profit Token',
      tokenSymbol: 'PROFIT',
      entryPrice: 0.00001,
      currentPrice: 0.00005,
      profitPercent: 400,
      targetMultiple: 5,
      totalGainUsd: 2500
    });
    results.push({ type: 'profit_target', success: profitResult.success });
    await sleep(2000);

    // 8. Exit Signal
    console.log('8/9: Sending exit signal...');
    const exitResult = await sendExitSignal({
      tokenAddress: 'ExitToken123456789',
      tokenName: 'Exit Token',
      tokenSymbol: 'EXIT',
      signalType: 'Stop Loss Triggered',
      currentPrice: 0.00000800,
      entryPrice: 0.00001000,
      profitPercent: -20
    });
    results.push({ type: 'exit_signal', success: exitResult.success });
    await sleep(2000);

    // 9. Smart Money Alert
    console.log('9/9: Sending smart money alert...');
    const smartResult = await sendSmartMoneyAlert({
      tokenAddress: 'SmartToken123456789',
      tokenName: 'Smart Money Token',
      tokenSymbol: 'SMART',
      eliteWallets: 5,
      totalInvested: 145000,
      signal: 'STRONG_BUY'
    });
    results.push({ type: 'smart_money_alert', success: smartResult.success });

    console.log('All alerts sent!');

    const successCount = results.filter(r => r.success).length;

    return res.status(200).json({
      success: true,
      message: `Sent ${successCount}/9 alerts successfully`,
      results,
      chatId: process.env.TELEGRAM_CHAT_ID
    });

  } catch (error) {
    console.error('Test all alerts error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
