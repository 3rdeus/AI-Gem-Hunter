-- Phase 1: Smart Money Intelligence Schema
-- Creates tables for whale tracking, holder quality, and liquidity monitoring

-- 1. Smart Wallets Table
-- Tracks known successful wallets (whales) and their performance
CREATE TABLE IF NOT EXISTS smart_wallets (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL DEFAULT 'solana',
  success_rate NUMERIC DEFAULT 0, -- % of tokens held that went 2x+
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  wallet_age_days INTEGER DEFAULT 0,
  portfolio_value_usd NUMERIC DEFAULT 0,
  monthly_tx_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP DEFAULT NOW(),
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_smart_wallets_address ON smart_wallets(address);
CREATE INDEX IF NOT EXISTS idx_smart_wallets_success_rate ON smart_wallets(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_smart_wallets_active ON smart_wallets(is_active) WHERE is_active = TRUE;

-- 2. Smart Money Signals Table
-- Tracks when smart wallets buy tokens
CREATE TABLE IF NOT EXISTS smart_money_signals (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'BUY', 'SELL', 'ACCUMULATION'
  amount_usd NUMERIC,
  transaction_hash TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (wallet_address) REFERENCES smart_wallets(address)
);

CREATE INDEX IF NOT EXISTS idx_smart_money_signals_token ON smart_money_signals(token_address, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_signals_wallet ON smart_money_signals(wallet_address, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_signals_recent ON smart_money_signals(detected_at DESC);

-- 3. Token Holder Quality Table
-- Stores detailed holder analysis for each token
CREATE TABLE IF NOT EXISTS token_holder_quality (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  total_holders INTEGER DEFAULT 0,
  quality_score NUMERIC DEFAULT 0, -- 0-100 score
  avg_wallet_age_days NUMERIC DEFAULT 0,
  avg_success_rate NUMERIC DEFAULT 0,
  avg_portfolio_value_usd NUMERIC DEFAULT 0,
  bot_percentage NUMERIC DEFAULT 0, -- Estimated % of bot holders
  whale_count INTEGER DEFAULT 0, -- Holders with >$100K portfolio
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holder_quality_token ON token_holder_quality(token_address);
CREATE INDEX IF NOT EXISTS idx_holder_quality_score ON token_holder_quality(quality_score DESC);

-- 4. Liquidity History Table
-- Tracks liquidity changes over time for inflection detection
CREATE TABLE IF NOT EXISTS liquidity_history (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  liquidity_usd NUMERIC NOT NULL,
  volume_24h_usd NUMERIC DEFAULT 0,
  price_usd NUMERIC DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liquidity_history_token ON liquidity_history(token_address, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_history_recent ON liquidity_history(recorded_at DESC);

-- 5. Historical 100x Tokens Table
-- Database of tokens that achieved 100x for pattern matching
CREATE TABLE IF NOT EXISTS historical_100x_tokens (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  launch_date TIMESTAMP NOT NULL,
  launch_mcap_usd NUMERIC,
  launch_liquidity_usd NUMERIC,
  launch_holder_count INTEGER,
  narrative TEXT, -- 'AI_AGENTS', 'RWA', 'MEME_CAT', etc.
  peak_mcap_usd NUMERIC,
  peak_date TIMESTAMP,
  multiplier NUMERIC, -- How many X it did
  days_to_10x INTEGER,
  days_to_100x INTEGER,
  smart_wallets_early TEXT[], -- Array of smart wallet addresses that bought early
  initial_social_score NUMERIC,
  initial_safety_score NUMERIC,
  notes TEXT,
  added_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_100x_narrative ON historical_100x_tokens(narrative);
CREATE INDEX IF NOT EXISTS idx_historical_100x_multiplier ON historical_100x_tokens(multiplier DESC);

-- 6. Alert Performance Table
-- Tracks performance of every alert sent
CREATE TABLE IF NOT EXISTS alert_performance (
  id SERIAL PRIMARY KEY,
  alert_id TEXT UNIQUE,
  token_address TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'GOOD', 'EXCELLENT', 'EARLY_GEM', 'SMART_MONEY', etc.
  alert_score NUMERIC NOT NULL,
  price_at_alert NUMERIC NOT NULL,
  liquidity_at_alert NUMERIC,
  holders_at_alert INTEGER,
  sent_at TIMESTAMP DEFAULT NOW(),
  
  -- Performance tracking
  price_24h NUMERIC,
  price_7d NUMERIC,
  price_30d NUMERIC,
  performance_24h_pct NUMERIC,
  performance_7d_pct NUMERIC,
  performance_30d_pct NUMERIC,
  hit_2x BOOLEAN DEFAULT FALSE,
  hit_10x BOOLEAN DEFAULT FALSE,
  hit_100x BOOLEAN DEFAULT FALSE,
  
  last_checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_performance_token ON alert_performance(token_address);
CREATE INDEX IF NOT EXISTS idx_alert_performance_type ON alert_performance(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_performance_sent ON alert_performance(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_performance_success ON alert_performance(hit_10x DESC, hit_2x DESC);

-- 7. Add new columns to existing gem_discoveries table
-- (These may already exist from previous migrations, using IF NOT EXISTS)
ALTER TABLE gem_discoveries 
  ADD COLUMN IF NOT EXISTS holder_quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_money_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquidity_change_6h_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquidity_change_24h_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pattern_match_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pattern_match_similar_to TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_holder_quality ON gem_discoveries(holder_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_smart_money ON gem_discoveries(smart_money_count DESC);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_pattern_match ON gem_discoveries(pattern_match_score DESC);

-- Comments for documentation
COMMENT ON TABLE smart_wallets IS 'Tracks known successful whale wallets for smart money detection';
COMMENT ON TABLE smart_money_signals IS 'Records when smart wallets buy/sell tokens';
COMMENT ON TABLE token_holder_quality IS 'Stores holder quality analysis for each token';
COMMENT ON TABLE liquidity_history IS 'Tracks liquidity changes over time for inflection detection';
COMMENT ON TABLE historical_100x_tokens IS 'Database of tokens that achieved 100x for pattern matching';
COMMENT ON TABLE alert_performance IS 'Tracks performance of every alert sent for learning';
