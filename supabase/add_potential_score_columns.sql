-- Add potential score columns to gem_discoveries table
-- Migration for Early Gem detection feature

-- Add new columns for potential scoring
ALTER TABLE gem_discoveries
  ADD COLUMN IF NOT EXISTS potential_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume_plus_holders_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_early_token BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN gem_discoveries.potential_score IS 'Potential score (0-100) calculated as: 0.4*liquidity + 0.4*safety + 0.2*(volume+holders). Used for early gem detection.';
COMMENT ON COLUMN gem_discoveries.volume_plus_holders_score IS 'Sum of volume_score + holder_score. Used to identify very early tokens (< 40 = early stage).';
COMMENT ON COLUMN gem_discoveries.is_early_token IS 'Flag indicating if token is in early stage (volume_plus_holders_score < 40).';

-- Create index for querying early gems
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_early_gems 
ON gem_discoveries(is_early_token, potential_score DESC) 
WHERE is_early_token = TRUE;

-- Create index for high-potential early gems
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_high_potential 
ON gem_discoveries(potential_score DESC) 
WHERE is_early_token = TRUE AND potential_score >= 76;

COMMENT ON INDEX idx_gem_discoveries_early_gems IS 'Index for efficiently querying early-stage tokens sorted by potential score.';
COMMENT ON INDEX idx_gem_discoveries_high_potential IS 'Index for efficiently querying high-potential early gems (potential >= 76).';
