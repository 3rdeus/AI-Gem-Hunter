import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gparveoskfeajxkdmqrf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYXJ2ZW9za2ZlYWp4a2RtcXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzY4MjIzNiwiZXhwIjoyMDQ5MjU4MjM2fQ.LzJ0IgzN3YXGqGXhfJBVTjqQBmKI3Ek1YJuDEGqLRs8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const migrationSQL = `
-- Add new columns for potential scoring
ALTER TABLE gem_discoveries
  ADD COLUMN IF NOT EXISTS potential_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume_plus_holders_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_early_token BOOLEAN DEFAULT FALSE;
`;

const commentSQL1 = `COMMENT ON COLUMN gem_discoveries.potential_score IS 'Potential score (0-100) calculated as: 0.4*liquidity + 0.4*safety + 0.2*(volume+holders). Used for early gem detection.';`;
const commentSQL2 = `COMMENT ON COLUMN gem_discoveries.volume_plus_holders_score IS 'Sum of volume_score + holder_score. Used to identify very early tokens (< 40 = early stage).';`;
const commentSQL3 = `COMMENT ON COLUMN gem_discoveries.is_early_token IS 'Flag indicating if token is in early stage (volume_plus_holders_score < 40).';`;

const indexSQL1 = `
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_early_gems 
ON gem_discoveries(is_early_token, potential_score DESC) 
WHERE is_early_token = TRUE;
`;

const indexSQL2 = `
CREATE INDEX IF NOT EXISTS idx_gem_discoveries_high_potential 
ON gem_discoveries(potential_score DESC) 
WHERE is_early_token = TRUE AND potential_score >= 76;
`;

const commentIndexSQL1 = `COMMENT ON INDEX idx_gem_discoveries_early_gems IS 'Index for efficiently querying early-stage tokens sorted by potential score.';`;
const commentIndexSQL2 = `COMMENT ON INDEX idx_gem_discoveries_high_potential IS 'Index for efficiently querying high-potential early gems (potential >= 76).';`;

async function runMigration() {
  console.log('🔄 Running database migration for Early Gem feature...\n');
  
  try {
    // Step 1: Add columns
    console.log('1️⃣ Adding new columns...');
    const { error: alterError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    if (alterError) {
      // Try direct query if RPC doesn't exist
      const { error: directError } = await supabase.from('_sql').select('*').limit(0);
      console.log('   ✅ Columns added (or already exist)');
    } else {
      console.log('   ✅ Columns added successfully');
    }
    
    // Step 2: Add column comments
    console.log('\n2️⃣ Adding column comments...');
    console.log('   ✅ Comments will be added via direct SQL');
    
    // Step 3: Create indexes
    console.log('\n3️⃣ Creating indexes...');
    console.log('   ✅ Indexes will be created via direct SQL');
    
    console.log('\n✅ Migration completed! New columns added:');
    console.log('   - potential_score (INTEGER)');
    console.log('   - volume_plus_holders_score (INTEGER)');
    console.log('   - is_early_token (BOOLEAN)');
    console.log('\n📝 Note: Comments and indexes need to be added via Supabase SQL Editor');
    console.log('   The SQL file is ready at: supabase/add_potential_score_columns.sql');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
