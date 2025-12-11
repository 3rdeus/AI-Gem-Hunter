-- Initial Whale Wallet Database
-- Curated list of known successful Solana traders to track
-- These wallets have historically made 10x+ returns on tokens

-- Insert initial smart wallets
-- Note: These are example addresses - you should replace with real successful wallets
-- Sources: Twitter crypto influencers, Dune Analytics top traders, public whale lists

INSERT INTO smart_wallets (address, chain, success_rate, notes, is_active) VALUES
-- Example successful Solana traders (replace with real addresses)
('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'solana', 0.65, 'Known early meme coin investor', true),
('GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', 'solana', 0.58, 'AI token specialist', true),
('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', 'solana', 0.72, 'DeFi whale', true),
('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', 'solana', 0.61, 'NFT and token flipper', true),
('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', 'solana', 0.69, 'RWA early adopter', true),
('C6kYXcaRUMqeBF5fhg165RWU7AnpT9z92fvKNoMqjmz6', 'solana', 0.55, 'GameFi investor', true),
('8UviNr47S8eL6J3WfDxMRa3hvLta1VDJwNWqsDgtN3Cv', 'solana', 0.63, 'Pump.fun early buyer', true),
('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana', 0.70, 'Raydium sniper', true),
('FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5', 'solana', 0.59, 'Multi-chain whale', true),
('3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw', 'solana', 0.66, 'Virtuals Protocol early investor', true)
ON CONFLICT (address) DO NOTHING;

-- Add more wallets (you should research and add real successful wallets)
-- Good sources:
-- 1. Twitter: @lookonchain, @whale_alert followers
-- 2. Dune Analytics: Top Solana traders by profit
-- 3. Nansen: Smart Money labels (if you have access)
-- 4. Solscan: Top holders of successful tokens
-- 5. Public whale lists from crypto communities

COMMENT ON TABLE smart_wallets IS 'Curated list of successful whale wallets to track for smart money signals';
