/**
 * Agent Squad - Multi-strategy trading system
 * Sniper, Hunter, Scout agents with Commander oversight
 */

import { buyViaBonkBot, getBonkBotStats, getAllPositions } from './bonk-bot.mjs';
import { sendGemAlert } from './telegram-bot.mjs';

// Track exposure per agent
const agentExposure = {
  sniper: 0,
  hunter: 0,
  scout: 0
};

// Track all trades for performance
const tradeHistory = [];

/**
 * Agent configurations from environment
 */
function getAgentConfig() {
  return {
    sniper: {
      name: 'SNIPER',
      emoji: '🎯',
      enabled: process.env.SNIPER_ENABLED === 'true',
      minScore: parseInt(process.env.SNIPER_MIN_SCORE) || 70,
      requireSmartMoney: process.env.SNIPER_REQUIRE_SMART_MONEY === 'true',
      tradeSize: parseFloat(process.env.SNIPER_TRADE_SIZE) || 0.05,
      maxExposure: parseFloat(process.env.SNIPER_MAX_EXPOSURE) || 0.15,
      profitTarget: parseInt(process.env.SNIPER_PROFIT_TARGET) || 2,
      stopLoss: parseInt(process.env.SNIPER_STOP_LOSS) || -30,
      paperTrade: false
    },
    hunter: {
      name: 'HUNTER',
      emoji: '🏹',
      enabled: process.env.HUNTER_ENABLED === 'true',
      minScore: parseInt(process.env.HUNTER_MIN_SCORE) || 60,
      requireSmartMoney: process.env.HUNTER_REQUIRE_SMART_MONEY === 'true',
      tradeSize: parseFloat(process.env.HUNTER_TRADE_SIZE) || 0.1,
      maxExposure: parseFloat(process.env.HUNTER_MAX_EXPOSURE) || 0.30,
      profitTarget: parseInt(process.env.HUNTER_PROFIT_TARGET) || 5,
      stopLoss: parseInt(process.env.HUNTER_STOP_LOSS) || -50,
      paperTrade: false
    },
    scout: {
      name: 'SCOUT',
      emoji: '🔭',
      enabled: process.env.SCOUT_ENABLED === 'true',
      minScore: parseInt(process.env.SCOUT_MIN_SCORE) || 50,
      requireSmartMoney: false,
      tradeSize: 0,
      maxExposure: 0,
      profitTarget: 5,
      stopLoss: -50,
      paperTrade: true
    }
  };
}

/**
 * Evaluate which agent should take a trade
 * Returns the highest-tier agent that matches
 */
export function evaluateForAgents(gemData) {
  const config = getAgentConfig();
  const score = gemData.gemScore;
  const hasSmartMoney = gemData.smartMoney?.net_flow_24h > 0;
  
  const results = [];
  
  // Check Sniper first (highest tier)
  if (config.sniper.enabled && score >= config.sniper.minScore) {
    if (!config.sniper.requireSmartMoney || hasSmartMoney) {
      if (agentExposure.sniper + config.sniper.tradeSize <= config.sniper.maxExposure) {
        results.push({
          agent: 'sniper',
          config: config.sniper,
          reason: `Score ${score} ≥ ${config.sniper.minScore}, smart money: ${hasSmartMoney ? 'YES' : 'N/A'}`
        });
      } else {
        console.log(`[SNIPER] ⚠️ Max exposure reached (${agentExposure.sniper}/${config.sniper.maxExposure} SOL)`);
      }
    }
  }
  
  // Check Hunter
  if (config.hunter.enabled && score >= config.hunter.minScore) {
    if (!config.hunter.requireSmartMoney || hasSmartMoney) {
      if (agentExposure.hunter + config.hunter.tradeSize <= config.hunter.maxExposure) {
        results.push({
          agent: 'hunter',
          config: config.hunter,
          reason: `Score ${score} ≥ ${config.hunter.minScore}`
        });
      } else {
        console.log(`[HUNTER] ⚠️ Max exposure reached (${agentExposure.hunter}/${config.hunter.maxExposure} SOL)`);
      }
    }
  }
  
  // Check Scout (paper trades everything above threshold)
  if (config.scout.enabled && score >= config.scout.minScore) {
    results.push({
      agent: 'scout',
      config: config.scout,
      reason: `Score ${score} ≥ ${config.scout.minScore} (paper trade)`
    });
  }
  
  return results;
}

/**
 * Execute trade for an agent
 */
export async function executeAgentTrade(gemData, agentResult) {
  const { agent, config, reason } = agentResult;
  
  console.log(`\n[${config.name}] ${config.emoji} ═══════════════════════════════════════`);
  console.log(`[${config.name}] Deploying for: ${gemData.basicData?.symbol || gemData.tokenAddress.slice(0,8)}`);
  console.log(`[${config.name}] Reason: ${reason}`);
  
  // Record the trade attempt
  const tradeRecord = {
    agent,
    tokenAddress: gemData.tokenAddress,
    symbol: gemData.basicData?.symbol || 'UNKNOWN',
    score: gemData.gemScore,
    smartMoney: gemData.smartMoney,
    tradeSize: config.tradeSize,
    profitTarget: config.profitTarget,
    stopLoss: config.stopLoss,
    paperTrade: config.paperTrade,
    timestamp: new Date().toISOString(),
    status: 'PENDING'
  };
  
  if (config.paperTrade) {
    // Paper trade - just log it
    console.log(`[${config.name}] 📝 PAPER TRADE: Would buy ${config.tradeSize || 'N/A'} SOL`);
    tradeRecord.status = 'PAPER';
    tradeHistory.push(tradeRecord);
    
    return {
      success: true,
      paperTrade: true,
      agent: config.name
    };
  }
  
  // Real trade
  console.log(`[${config.name}] 💰 Executing: ${config.tradeSize} SOL`);
  console.log(`[${config.name}] 🎯 Target: ${config.profitTarget}x | 🛑 Stop: ${config.stopLoss}%`);
  
  try {
    const result = await buyViaBonkBot({
      tokenAddress: gemData.tokenAddress,
      amountSOL: config.tradeSize,
      slippage: 25,
      profitTargets: [config.profitTarget],
      stopLoss: config.stopLoss
    });
    
    if (result.success) {
      // Update exposure tracking
      agentExposure[agent] += config.tradeSize;
      
      tradeRecord.status = 'EXECUTED';
      tradeRecord.messageId = result.messageId;
      tradeHistory.push(tradeRecord);
      
      console.log(`[${config.name}] ✅ Trade executed! Exposure: ${agentExposure[agent]}/${config.maxExposure} SOL`);
      
      // Send alert
      await sendAgentTradeAlert(gemData, config, 'ENTRY');
      
      return {
        success: true,
        agent: config.name,
        tradeSize: config.tradeSize,
        exposure: agentExposure[agent]
      };
    } else {
      tradeRecord.status = 'FAILED';
      tradeRecord.error = result.error;
      tradeHistory.push(tradeRecord);
      
      console.log(`[${config.name}] ❌ Trade failed: ${result.error}`);
      
      return {
        success: false,
        agent: config.name,
        error: result.error
      };
    }
  } catch (error) {
    tradeRecord.status = 'ERROR';
    tradeRecord.error = error.message;
    tradeHistory.push(tradeRecord);
    
    console.error(`[${config.name}] ❌ Error:`, error.message);
    return {
      success: false,
      agent: config.name,
      error: error.message
    };
  }
}

/**
 * Send agent-specific trade alert
 */
async function sendAgentTradeAlert(gemData, config, action) {
  const message = `
${config.emoji} *${config.name} AGENT - ${action}* ${config.emoji}

*Token:* ${gemData.basicData?.name || 'Unknown'} (${gemData.basicData?.symbol || '???'})
*Address:* \`${gemData.tokenAddress}\`
*Score:* ${gemData.gemScore}/100

*Trade:*
• Size: ${config.tradeSize} SOL
• Target: ${config.profitTarget}x
• Stop Loss: ${config.stopLoss}%

${gemData.smartMoney ? `*Smart Money:* ${gemData.smartMoney.smart_wallet_count} wallets, $${gemData.smartMoney.net_flow_24h?.toFixed(0) || 0} net flow` : ''}

*Links:*
• [Birdeye](https://birdeye.so/token/${gemData.tokenAddress})
• [DexScreener](https://dexscreener.com/solana/${gemData.tokenAddress})
`.trim();

  try {
    await sendGemAlert(message);
  } catch (e) {
    console.error('Failed to send agent alert:', e.message);
  }
}

/**
 * Get squad status report
 */
export function getSquadStatus() {
  const config = getAgentConfig();
  const positions = getAllPositions();
  const stats = getBonkBotStats();
  
  return {
    agents: {
      sniper: {
        ...config.sniper,
        currentExposure: agentExposure.sniper,
        trades: tradeHistory.filter(t => t.agent === 'sniper').length
      },
      hunter: {
        ...config.hunter,
        currentExposure: agentExposure.hunter,
        trades: tradeHistory.filter(t => t.agent === 'hunter').length
      },
      scout: {
        ...config.scout,
        trades: tradeHistory.filter(t => t.agent === 'scout').length
      }
    },
    totalExposure: agentExposure.sniper + agentExposure.hunter,
    totalTrades: tradeHistory.length,
    activeTrades: positions.filter(p => p.status === 'ACTIVE').length,
    tradeHistory: tradeHistory.slice(-20), // Last 20 trades
    bonkBotStats: stats
  };
}

/**
 * Generate Commander daily report
 */
export function generateCommanderReport() {
  const status = getSquadStatus();
  
  const report = `
🎖️ *COMMANDER DAILY REPORT* 🎖️
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Squad Status:*

🎯 *SNIPER*
• Trades: ${status.agents.sniper.trades}
• Exposure: ${status.agents.sniper.currentExposure}/${status.agents.sniper.maxExposure} SOL
• Status: ${status.agents.sniper.enabled ? '🟢 ACTIVE' : '🔴 DISABLED'}

🏹 *HUNTER*  
• Trades: ${status.agents.hunter.trades}
• Exposure: ${status.agents.hunter.currentExposure}/${status.agents.hunter.maxExposure} SOL
• Status: ${status.agents.hunter.enabled ? '🟢 ACTIVE' : '🔴 DISABLED'}

🔭 *SCOUT*
• Paper Trades: ${status.agents.scout.trades}
• Status: ${status.agents.scout.enabled ? '🟢 TRACKING' : '🔴 DISABLED'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Overall:*
• Total Exposure: ${status.totalExposure.toFixed(3)} SOL
• Total Trades: ${status.totalTrades}
• Active Positions: ${status.activeTrades}
• Win Rate: ${status.bonkBotStats.winRate?.toFixed(1) || 0}%
• Total P&L: ${status.bonkBotStats.totalPnL?.toFixed(1) || 0}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Commander reporting. Squad is operational.* 🫡
`.trim();

  return report;
}

/**
 * Reset exposure (called when position closes)
 */
export function releaseExposure(agent, amount) {
  if (agentExposure[agent] !== undefined) {
    agentExposure[agent] = Math.max(0, agentExposure[agent] - amount);
    console.log(`[${agent.toUpperCase()}] Released ${amount} SOL. New exposure: ${agentExposure[agent]}`);
  }
}

/**
 * Check if auto-trading is enabled
 */
export function isAutoTradeEnabled() {
  return process.env.AUTO_TRADE_ENABLED === 'true';
}
