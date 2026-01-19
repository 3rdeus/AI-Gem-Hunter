import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const GMGN_WS_URL = 'wss://gmgn.ai/ws';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BONKBOT_USERNAME = '@bonkbot_bot';

// Scoring thresholds for unfair advantage
const SCORING_CONFIG = {
  marketCap: {
    min: 10000,        // $10K minimum
    max: 500000,       // $500K maximum (early stage)
    optimal: 100000,   // $100K optimal
    weight: 0.25
  },
  volume24h: {
    min: 5000,         // $5K minimum
    minRatio: 0.1,     // 10% of market cap
    weight: 0.20
  },
  liquidity: {
    min: 5000,         // $5K minimum
    minRatio: 0.15,    // 15% of market cap
    weight: 0.20
  },
  momentum: {
    priceChange1h: 0.05,  // 5% minimum
    holders: 50,          // Minimum holder count
    weight: 0.20
  },
  smartMoney: {
    minBuys: 2,        // At least 2 smart wallet buys
    weight: 0.15
  }
};

const SCORE_THRESHOLD = 70; // Minimum score to alert

class GmGnMonitoringService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.seenTokens = new Set();
    this.alertedTokens = new Set();
  }

  async start() {
    console.log('🚀 Starting GMGN Monitoring Service...');
    this.connect();
  }

  connect() {
    try {
      console.log('🔌 Connecting to GMGN WebSocket...');
      this.ws = new WebSocket(GMGN_WS_URL);

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', () => this.onClose());
    } catch (error) {
      console.error('❌ Connection error:', error);
      this.reconnect();
    }
  }

  onOpen() {
    console.log('✅ Connected to GMGN WebSocket');
    this.reconnectAttempts = 0;

    // Subscribe to new pools on Solana
    const subscribeMessage = {
      type: 'subscribe',
      channel: 'new_pools',
      chain: 'sol'
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('📡 Subscribed to Solana new pools');

    // Heartbeat to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  async onMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'pong') {
        return;
      }

      if (message.type === 'new_pool' && message.data) {
        await this.processNewPool(message.data);
      }
    } catch (error) {
      console.error('❌ Message processing error:', error);
    }
  }

  async processNewPool(poolData) {
    try {
      const tokenAddress = poolData.token_address || poolData.address;
      
      if (this.seenTokens.has(tokenAddress)) {
        return;
      }
      
      this.seenTokens.add(tokenAddress);
      console.log(`\n🆕 New pool detected: ${poolData.token_symbol || 'Unknown'}`);

      // Score the token
      const score = this.calculateScore(poolData);
      console.log(`📊 Score: ${score.total}/100`);

      if (score.total >= SCORE_THRESHOLD && !this.alertedTokens.has(tokenAddress)) {
        this.alertedTokens.add(tokenAddress);
        await this.sendTelegramAlert(poolData, score);
      }
    } catch (error) {
      console.error('❌ Pool processing error:', error);
    }
  }

  calculateScore(data) {
    const scores = {
      marketCap: 0,
      volume: 0,
      liquidity: 0,
      momentum: 0,
      smartMoney: 0
    };

    const marketCap = parseFloat(data.market_cap || data.mc || 0);
    const volume24h = parseFloat(data.volume_24h || data.v24 || 0);
    const liquidity = parseFloat(data.liquidity_usd || data.liq || 0);
    const priceChange1h = parseFloat(data.price_change_1h || 0);
    const holders = parseInt(data.holders || 0);

    // Market Cap Score (0-100)
    if (marketCap >= SCORING_CONFIG.marketCap.min && marketCap <= SCORING_CONFIG.marketCap.max) {
      const distanceFromOptimal = Math.abs(marketCap - SCORING_CONFIG.marketCap.optimal);
      const maxDistance = SCORING_CONFIG.marketCap.max - SCORING_CONFIG.marketCap.min;
      scores.marketCap = (1 - (distanceFromOptimal / maxDistance)) * 100;
    }

    // Volume Score (0-100)
    const volumeRatio = marketCap > 0 ? volume24h / marketCap : 0;
    if (volume24h >= SCORING_CONFIG.volume24h.min && volumeRatio >= SCORING_CONFIG.volume24h.minRatio) {
      scores.volume = Math.min(100, (volumeRatio / SCORING_CONFIG.volume24h.minRatio) * 100);
    }

    // Liquidity Score (0-100)
    const liquidityRatio = marketCap > 0 ? liquidity / marketCap : 0;
    if (liquidity >= SCORING_CONFIG.liquidity.min && liquidityRatio >= SCORING_CONFIG.liquidity.minRatio) {
      scores.liquidity = Math.min(100, (liquidityRatio / SCORING_CONFIG.liquidity.minRatio) * 100);
    }

    // Momentum Score (0-100)
    if (priceChange1h >= SCORING_CONFIG.momentum.priceChange1h) {
      scores.momentum += 50;
    }
    if (holders >= SCORING_CONFIG.momentum.holders) {
      scores.momentum += 50;
    }

    // Smart Money Score (0-100)
    const smartBuys = parseInt(data.smart_buys || 0);
    if (smartBuys >= SCORING_CONFIG.smartMoney.minBuys) {
      scores.smartMoney = Math.min(100, (smartBuys / SCORING_CONFIG.smartMoney.minBuys) * 50);
    }

    // Calculate weighted total
    const total = Math.round(
      scores.marketCap * SCORING_CONFIG.marketCap.weight +
      scores.volume * SCORING_CONFIG.volume24h.weight +
      scores.liquidity * SCORING_CONFIG.liquidity.weight +
      scores.momentum * SCORING_CONFIG.momentum.weight +
      scores.smartMoney * SCORING_CONFIG.smartMoney.weight
    );

    return {
      total,
      breakdown: scores,
      metrics: { marketCap, volume24h, liquidity, priceChange1h, holders }
    };
  }

  async sendTelegramAlert(poolData, score) {
    try {
      const tokenAddress = poolData.token_address || poolData.address;
      const symbol = poolData.token_symbol || poolData.symbol || 'Unknown';
      const name = poolData.token_name || poolData.name || 'Unknown';

      const message = `
🚀 *HIGH SCORE GEM DETECTED* 🚀

📊 *Score:* ${score.total}/100

💎 *Token:* ${symbol} (${name})
📍 *Contract:* \`${tokenAddress}\`

📈 *Metrics:*
• Market Cap: $${score.metrics.marketCap.toLocaleString()}
• Volume 24h: $${score.metrics.volume24h.toLocaleString()}
• Liquidity: $${score.metrics.liquidity.toLocaleString()}
• Price Change 1h: ${score.metrics.priceChange1h.toFixed(2)}%
• Holders: ${score.metrics.holders}

🎯 *Score Breakdown:*
• Market Cap: ${score.breakdown.marketCap.toFixed(1)}
• Volume: ${score.breakdown.volume.toFixed(1)}
• Liquidity: ${score.breakdown.liquidity.toFixed(1)}
• Momentum: ${score.breakdown.momentum.toFixed(1)}
• Smart Money: ${score.breakdown.smartMoney.toFixed(1)}

🔗 [View on Solscan](https://solscan.io/token/${tokenAddress})
🔗 [View on GMGN](https://gmgn.ai/sol/token/${tokenAddress})

💰 *Execute Trade:*
To buy via BONKbot, send this command:
\`/buy ${tokenAddress} 0.1\`
      `.trim();

      await this.sendToTelegram(message);
      console.log(`✅ Alert sent for ${symbol}`);
    } catch (error) {
      console.error('❌ Telegram alert error:', error);
    }
  }

  async sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
  }

  onError(error) {
    console.error('❌ WebSocket error:', error);
  }

  onClose() {
    console.log('⚠️  WebSocket connection closed');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.reconnect();
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => this.connect(), delay);
  }

  stop() {
    console.log('🛑 Stopping GMGN Monitoring Service...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.ws) {
      this.ws.close();
    }
  }
}

// Start the service
const service = new GmGnMonitoringService();
service.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  service.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  service.stop();
  process.exit(0);
});

export default GmGnMonitoringService;
