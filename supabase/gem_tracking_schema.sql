-- Gem Discovery Tracking Schema
-- Track discovered tokens and their performance over time

-- Table: gem_discoveries
-- Store every token discovered by the AI Gem Hunter
CREATE TABLE IF NOT EXISTS gem_discoveries (
  id BIGSERIAL PRIMARY KEY,
  token_address TEXT UNIQUE NOT NULL,
  
  -- Basic info
  name TEXT,
  symbol TEXT,
  source TEXT NOT NULL, -- 'raydium', 'orca', 'pumpfun'
  
  -- Discovery metrics
  discovery_score INTEGER NOT NULL,
  discovery_tier TEXT NOT NULL, -- 'excellent', 'good', 'risky', 'avoid'
  
  -- Initial metrics at discovery
  initial_price DECIMAL,
  initial_liquidity DECIMAL,
  initial_volume_24h DECIMAL,
  initial_holders INTEGER,
  initial_market_cap DECIMAL,
  
  -- Score breakdown
  score_liquidity INTEGER,
  score_volume INTEGER,
  score_holders INTEGER,
  score_social INTEGER,
  score_safety INTEGER,
  
  -- Social links
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  
  -- Alert status
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_tier TEXT,
  
  -- Timestamps
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: gem_performance_updates
-- Track price/performance updates over time
CREATE TABLE IF NOT EXISTS gem_performance_updates (
  id BIGSERIAL PRIMARY KEY,
  token_address TEXT NOT NULL REFERENCES gem_discoveries(token_address),
  
  -- Current metrics
  current_price DECIMAL,
  current_liquidity DECIMAL,
  current_volume_24h DECIMAL,
  current_holders INTEGER,
  current_market_cap DECIMAL,
  
  -- Performance calculations
  price_change_percent DECIMAL,
  liquidity_change_percent DECIMAL,
  volume_change_percent DECIMAL,
  holders_change_percent DECIMAL,
  
  -- Time since discovery
  hours_since_discovery INTEGER,
  
  -- Status
  status TEXT, -- 'active', 'dead', 'rugged', 'mooning'
  
  -- Timestamp
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: gem_alerts_sent
-- Log of all Telegram alerts sent
CREATE TABLE IF NOT EXISTS gem_alerts_sent (
  id BIGSERIAL PRIMARY KEY,
  token_address TEXT NOT NULL REFERENCES gem_discoveries(token_address),
  
  -- Alert details
  alert_tier TEXT NOT NULL,
  score INTEGER NOT NULL,
  message TEXT,
  
  -- Timestamp
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_address ON gem_discoveries(token_address);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_score ON gem_discoveries(discovery_score DESC);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_tier ON gem_discoveries(discovery_tier);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_discovered_at ON gem_discoveries(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_source ON gem_discoveries(source);

CREATE INDEX IF NOT EXISTS idx_gem_performance_token ON gem_performance_updates(token_address);
CREATE INDEX IF NOT EXISTS idx_gem_performance_updated_at ON gem_performance_updates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gem_performance_hours ON gem_performance_updates(hours_since_discovery);

CREATE INDEX IF NOT EXISTS idx_gem_alerts_token ON gem_alerts_sent(token_address);
CREATE INDEX IF NOT EXISTS idx_gem_alerts_sent_at ON gem_alerts_sent(sent_at DESC);

-- Enable Row Level Security
ALTER TABLE gem_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gem_performance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gem_alerts_sent ENABLE ROW LEVEL SECURITY;

-- Policies: Allow service role full access
CREATE POLICY "Allow service role access to discoveries"
  ON gem_discoveries FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role access to performance"
  ON gem_performance_updates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role access to alerts"
  ON gem_alerts_sent FOR ALL
  USING (auth.role() = 'service_role');

-- Policies: Allow public read access
CREATE POLICY "Allow public read access to discoveries"
  ON gem_discoveries FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to performance"
  ON gem_performance_updates FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to alerts"
  ON gem_alerts_sent FOR SELECT
  USING (true);

-- Function: Get top performing gems
CREATE OR REPLACE FUNCTION get_top_performers(time_window_hours INTEGER DEFAULT 24, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  token_address TEXT,
  name TEXT,
  symbol TEXT,
  discovery_score INTEGER,
  price_change_percent DECIMAL,
  hours_since_discovery INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gd.token_address,
    gd.name,
    gd.symbol,
    gd.discovery_score,
    gpu.price_change_percent,
    gpu.hours_since_discovery
  FROM gem_discoveries gd
  JOIN gem_performance_updates gpu ON gd.token_address = gpu.token_address
  WHERE gpu.hours_since_discovery <= time_window_hours
    AND gpu.price_change_percent IS NOT NULL
  ORDER BY gpu.price_change_percent DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get worst performing gems (rug pulls)
CREATE OR REPLACE FUNCTION get_worst_performers(time_window_hours INTEGER DEFAULT 24, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  token_address TEXT,
  name TEXT,
  symbol TEXT,
  discovery_score INTEGER,
  price_change_percent DECIMAL,
  hours_since_discovery INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gd.token_address,
    gd.name,
    gd.symbol,
    gd.discovery_score,
    gpu.price_change_percent,
    gpu.hours_since_discovery
  FROM gem_discoveries gd
  JOIN gem_performance_updates gpu ON gd.token_address = gpu.token_address
  WHERE gpu.hours_since_discovery <= time_window_hours
    AND gpu.price_change_percent IS NOT NULL
  ORDER BY gpu.price_change_percent ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(time_window_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_discovered INTEGER,
  total_alerted INTEGER,
  avg_score DECIMAL,
  avg_price_change DECIMAL,
  winners INTEGER,
  losers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT gd.token_address)::INTEGER as total_discovered,
    COUNT(DISTINCT CASE WHEN gd.alert_sent THEN gd.token_address END)::INTEGER as total_alerted,
    AVG(gd.discovery_score)::DECIMAL as avg_score,
    AVG(gpu.price_change_percent)::DECIMAL as avg_price_change,
    COUNT(DISTINCT CASE WHEN gpu.price_change_percent > 0 THEN gd.token_address END)::INTEGER as winners,
    COUNT(DISTINCT CASE WHEN gpu.price_change_percent < 0 THEN gd.token_address END)::INTEGER as losers
  FROM gem_discoveries gd
  LEFT JOIN gem_performance_updates gpu ON gd.token_address = gpu.token_address
  WHERE gd.discovered_at >= NOW() - INTERVAL '1 hour' * time_window_hours;
END;
$$ LANGUAGE plpgsql;
