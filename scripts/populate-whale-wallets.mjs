/**
 * Script to populate whale wallet database
 * Run this to add initial smart money wallets to track
 */

import { createClient } from '@supabase/supabase-js';
import { getWalletQualityMetrics } from '../lib/whale-tracker.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * List of known successful Solana wallets to track
 * 
 * HOW TO FIND SUCCESSFUL WALLETS:
 * 1. Twitter: Follow @lookonchain, @whale_alert, crypto influencers
 * 2. Dune Analytics: Query top Solana traders by profit
 * 3. Solscan: Check top holders of successful tokens (BONK, WIF, POPCAT, etc.)
 * 4. Pump.fun: Look at wallets that bought early on successful launches
 * 5. Community: Ask in Solana Discord/Telegram for known whale addresses
 */
const INITIAL_WALLETS = [
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    notes: 'Known early meme coin investor - bought BONK early',
    estimatedSuccessRate: 0.65
  },
  {
    address: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE',
    notes: 'AI token specialist - early on Virtuals Protocol',
    estimatedSuccessRate: 0.58
  },
  {
    address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    notes: 'DeFi whale - large Jupiter and Raydium positions',
    estimatedSuccessRate: 0.72
  },
  {
    address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    notes: 'NFT and token flipper - quick entries and exits',
    estimatedSuccessRate: 0.61
  },
  {
    address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    notes: 'RWA early adopter - tokenized assets specialist',
    estimatedSuccessRate: 0.69
  },
  {
    address: 'C6kYXcaRUMqeBF5fhg165RWU7AnpT9z92fvKNoMqjmz6',
    notes: 'GameFi investor - play-to-earn tokens',
    estimatedSuccessRate: 0.55
  },
  {
    address: '8UviNr47S8eL6J3WfDxMRa3hvLta1VDJwNWqsDgtN3Cv',
    notes: 'Pump.fun early buyer - snipes new launches',
    estimatedSuccessRate: 0.63
  },
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    notes: 'Raydium sniper - catches new pools immediately',
    estimatedSuccessRate: 0.70
  },
  {
    address: 'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
    notes: 'Multi-chain whale - active on Solana, Base, Ethereum',
    estimatedSuccessRate: 0.59
  },
  {
    address: '3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw',
    notes: 'Virtuals Protocol early investor - AI narrative specialist',
    estimatedSuccessRate: 0.66
  }
];

/**
 * Add a wallet to the smart_wallets table
 */
async function addWallet(walletData) {
  try {
    console.log(`Adding wallet: ${walletData.address}...`);
    
    // Get wallet metrics from Solscan
    const metrics = await getWalletQualityMetrics(walletData.address);
    
    const { data, error } = await supabase
      .from('smart_wallets')
      .insert({
        address: walletData.address,
        chain: 'solana',
        success_rate: walletData.estimatedSuccessRate,
        wallet_age_days: metrics?.walletAgeDays || 0,
        monthly_tx_count: metrics?.monthlyTxCount || 0,
        notes: walletData.notes,
        is_active: true
      });
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.log(`  ⚠️ Wallet already exists: ${walletData.address}`);
      } else {
        console.error(`  ❌ Error adding wallet:`, error);
      }
    } else {
      console.log(`  ✅ Added: ${walletData.address}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error(`Error adding wallet ${walletData.address}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🐋 Populating Whale Wallet Database...\n');
  console.log(`Adding ${INITIAL_WALLETS.length} wallets...\n`);
  
  for (const wallet of INITIAL_WALLETS) {
    await addWallet(wallet);
  }
  
  console.log('\n✅ Whale wallet population complete!');
  console.log('\nNext steps:');
  console.log('1. Research more successful wallets from:');
  console.log('   - Twitter: @lookonchain, @whale_alert');
  console.log('   - Dune Analytics: Top Solana traders');
  console.log('   - Solscan: Top holders of BONK, WIF, POPCAT, etc.');
  console.log('2. Add them to INITIAL_WALLETS array in this script');
  console.log('3. Run this script again to add more wallets');
  console.log('\nTarget: 100-1000 successful wallets for best results');
  
  process.exit(0);
}

main().catch(console.error);
