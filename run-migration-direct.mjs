import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gparveoskfeajxkdmqrf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYXJ2ZW9za2ZlYWp4a2RtcXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjY2NTU5MywiZXhwIjoyMDQ4MjQxNTkzfQ.Levl8_1WFXQ4EpvDhLMIrKJZdZ_pSjCjuXZULNEa3Gk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔄 Running database migration...');

// Run the migration
const { data, error } = await supabase.rpc('exec_sql', {
  query: `
    ALTER TABLE gem_discoveries
      ADD COLUMN IF NOT EXISTS potential_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS volume_plus_holders_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_early_token BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX IF NOT EXISTS idx_gem_discoveries_early_gems 
    ON gem_discoveries(is_early_token, potential_score DESC) 
    WHERE is_early_token = TRUE;
    
    CREATE INDEX IF NOT EXISTS idx_gem_discoveries_high_potential 
    ON gem_discoveries(potential_score DESC) 
    WHERE is_early_token = TRUE AND potential_score >= 76;
  `
});

if (error) {
  console.error('❌ Migration failed:', error);
  
  // Try direct SQL query instead
  console.log('🔄 Trying alternative approach...');
  
  const { data: alterData, error: alterError } = await supabase
    .from('gem_discoveries')
    .select('*')
    .limit(0);
  
  if (alterError) {
    console.error('❌ Alternative approach failed:', alterError);
    process.exit(1);
  }
  
  console.log('✅ Table accessible, columns might already exist');
} else {
  console.log('✅ Migration completed successfully!');
  console.log('Data:', data);
}

// Verify columns exist
console.log('\n🔍 Verifying columns...');
const { data: testData, error: testError } = await supabase
  .from('gem_discoveries')
  .select('potential_score, volume_plus_holders_score, is_early_token')
  .limit(1);

if (testError) {
  console.error('❌ Verification failed:', testError.message);
  console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
  console.log(`
ALTER TABLE gem_discoveries
  ADD COLUMN IF NOT EXISTS potential_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume_plus_holders_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_early_token BOOLEAN DEFAULT FALSE;
  `);
} else {
  console.log('✅ Columns verified successfully!');
  console.log('Sample data:', testData);
}
