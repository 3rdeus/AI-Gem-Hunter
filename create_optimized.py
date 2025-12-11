# Read the original file
with open('lib/momentum-tracker-original.mjs', 'r') as f:
    original = f.read()

# Create optimized version with proper modifications
optimized = '''/**
 * Optimized Momentum Tracking System
 * Smart tiered rescoring to reduce API calls and improve efficiency
 */

import { calculateGemScore } from './token-scorer.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

// Tiered rescoring intervals (in hours)
const RESCORE_INTERVALS = {
  high: 1,    // potential_score >= 70
  medium: 3,  // potential_score 40-69
  low: 12,    // potential_score < 40
  dead: null  // Skip entirely
};

const MOMENTUM_THRESHOLD = 10; // Points gained in interval
const MOMENTUM_SCORE_MIN = 40;
const MOMENTUM_SCORE_MAX = 69;
const UPGRADE_THRESHOLD = 70;
const DEAD_TOKEN_HOURS = 24; // Hours of zero volume before marking dead
const MIN_VOLUME_USD = 100; // Minimum 24h volume to rescore
const CHANGE_THRESHOLD_PERCENT = 5; // Minimum % change in any metric
'''

# Write to file
with open('lib/momentum-tracker.mjs', 'w') as f:
    f.write(optimized)

print("Created optimized header")
