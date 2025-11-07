-- Supabase Database Schema for Token Safety API

-- Table: token_cache
-- Stores cached token safety data to reduce API calls
CREATE TABLE IF NOT EXISTS token_cache (
  id BIGSERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_cache_address ON token_cache(address);
CREATE INDEX IF NOT EXISTS idx_token_cache_updated_at ON token_cache(updated_at);

-- Table: token_blacklist
-- Known scam tokens and rug pulls
CREATE TABLE IF NOT EXISTS token_blacklist (
  id BIGSERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  reported_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for blacklist lookups
CREATE INDEX IF NOT EXISTS idx_token_blacklist_address ON token_blacklist(address);

-- Table: community_reports
-- User-submitted reports about suspicious tokens
CREATE TABLE IF NOT EXISTS community_reports (
  id BIGSERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'scam', 'rug', 'honeypot', 'safe'
  description TEXT,
  reporter_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for community reports
CREATE INDEX IF NOT EXISTS idx_community_reports_token ON community_reports(token_address);
CREATE INDEX IF NOT EXISTS idx_community_reports_type ON community_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_community_reports_created_at ON community_reports(created_at DESC);

-- Table: api_logs
-- Track API usage and performance
CREATE TABLE IF NOT EXISTS api_logs (
  id BIGSERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  response_time_ms INTEGER,
  safety_score INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_token ON api_logs(token_address);

-- Function: Clean old cache entries (older than 24 hours)
CREATE OR REPLACE FUNCTION clean_old_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM token_cache
  WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (optional, for multi-tenant setups)
ALTER TABLE token_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to cache (for API)
CREATE POLICY "Allow public read access to cache"
  ON token_cache FOR SELECT
  USING (true);

-- Policy: Allow service role to insert/update cache
CREATE POLICY "Allow service role to modify cache"
  ON token_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow public read access to blacklist
CREATE POLICY "Allow public read access to blacklist"
  ON token_blacklist FOR SELECT
  USING (true);

-- Policy: Allow service role to modify blacklist
CREATE POLICY "Allow service role to modify blacklist"
  ON token_blacklist FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow public read access to community reports
CREATE POLICY "Allow public read access to reports"
  ON community_reports FOR SELECT
  USING (true);

-- Policy: Allow authenticated users to submit reports
CREATE POLICY "Allow authenticated users to submit reports"
  ON community_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Policy: Allow service role full access to logs
CREATE POLICY "Allow service role access to logs"
  ON api_logs FOR ALL
  USING (auth.role() = 'service_role');
