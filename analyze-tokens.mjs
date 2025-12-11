// Use the same approach as gem-tracker.mjs which is working in production
import { createClient } from '@supabase/supabase-js';

// Use environment variable approach like the production code
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gparveoskfeajxkdmqrf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!SUPABASE_KEY);
console.log('SUPABASE_KEY length:', SUPABASE_KEY ? SUPABASE_KEY.length : 0);

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_ANON_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyzeTokens() {
  try {
    console.log('\nQuerying Supabase for last 10 tokens...\n');
    
    const { data, error } = await supabase
      .from('gem_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Supabase Error:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) {
      console.log('No tokens found in database');
      return;
    }
    
    console.log(`Found ${data.length} tokens\n`);
    console.log('='.repeat(80));
    
    data.forEach((token, index) => {
      console.log(`\n${index + 1}. Token: ${token.token_address}`);
      console.log(`   Score: ${token.score}/100 - ${token.tier}`);
      console.log(`   Discovered: ${token.discovered_at}`);
      console.log(`   Score Breakdown:`, token.score_breakdown);
      console.log(`   Metadata:`, JSON.stringify(token.metadata, null, 2));
      console.log('-'.repeat(80));
    });
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

analyzeTokens();
