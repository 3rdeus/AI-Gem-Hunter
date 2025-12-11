import { createClient } from '@supabase/supabase-js';

// Supabase credentials from deployment
const SUPABASE_URL = 'https://gparveoskfeajxkdmqrf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwY3JjM2lpZHp4YmhtZnp6c2lzbG4iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyNDIzMTEzNTA3LCJuYmYiOjE3MjQyMzExMzUwNywiZXhwIjoyMDM5ODA3MTM1MDd9.Fub24iLCJpYXQiOjE3MjQyMzExMzUwNywiZXhwIjoyMDM5ODA3MTM1MDd9';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getLastTokens() {
  const { data, error } = await supabase
    .from('gem_discoveries')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  console.log(JSON.stringify(data, null, 2));
}

getLastTokens();
