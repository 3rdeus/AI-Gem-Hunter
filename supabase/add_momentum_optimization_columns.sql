-- Add momentum optimization columns to gem_discoveries table
-- Migration for smart tiered rescoring

-- Add last_rescored_at timestamp
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS last_rescored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add rescore_tier for tiered rescoring (high/medium/low/dead)
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS rescore_tier TEXT DEFAULT 'medium';

-- Add is_dead flag for dead token detection
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS is_dead BOOLEAN DEFAULT FALSE;

-- Add last_volume_24h for volume change detection
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS last_volume_24h NUMERIC DEFAULT 0;

-- Add last_holders for holder change detection
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS last_holders INTEGER DEFAULT 0;

-- Add zero_volume_hours counter
ALTER TABLE gem_discoveries ADD COLUMN IF NOT EXISTS zero_volume_hours INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN gem_discoveries.last_rescored_at IS 'Timestamp of last momentum rescore. Used to determine when next rescore is due.';
COMMENT ON COLUMN gem_discoveries.rescore_tier IS 'Rescoring tier: high (1h), medium (3h), low (12h), dead (skip). Based on potential_score.';
COMMENT ON COLUMN gem_discoveries.is_dead IS 'Flag indicating if token is dead (zero volume/holders for 24h+). Dead tokens are skipped in rescoring.';
COMMENT ON COLUMN gem_discoveries.last_volume_24h IS 'Last recorded 24h volume. Used to detect volume changes and dead tokens.';
COMMENT ON COLUMN gem_discoveries.last_holders IS 'Last recorded holder count. Used to detect holder changes and dead tokens.';
COMMENT ON COLUMN gem_discoveries.zero_volume_hours IS 'Consecutive hours with zero volume. Used to mark tokens as dead after 24h.';

-- Create index for efficient tier-based queries
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_rescore_tier 
ON gem_discoveries(rescore_tier, last_rescored_at) 
WHERE is_dead = FALSE;

-- Create index for dead token queries
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_dead_tokens 
ON gem_discoveries(is_dead, zero_volume_hours) 
WHERE is_dead = TRUE;

-- Create index for volume filtering
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_volume_filter 
ON gem_discoveries(last_volume_24h DESC) 
WHERE is_dead = FALSE AND last_volume_24h > 100;

COMMENT ON INDEX idx_gem_discoveries_rescore_tier IS 'Index for efficiently querying tokens by rescore tier and last rescore time.';
COMMENT ON INDEX idx_gem_discoveries_dead_tokens IS 'Index for efficiently querying dead tokens for potential reactivation checks.';
COMMENT ON INDEX idx_gem_discoveries_volume_filter IS 'Index for efficiently filtering tokens with meaningful volume (>$100).';
