import pkg from 'pg';
const { Pool } = pkg;

// Direct PostgreSQL connection bypassing Supabase API
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[POSTGRES] ✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('[POSTGRES] ❌ Unexpected error on idle client', err);
});

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[POSTGRES] Query executed', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('[POSTGRES] Query error:', error.message);
    throw error;
  }
}

/**
 * Get the database pool for direct queries
 * @returns {Object} Database pool
 */
export function getDB() {
  return pool;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * Close all connections in the pool
 */
export async function end() {
  await pool.end();
  console.log('[POSTGRES] Connection pool closed');
}

export default { query, getDB, getClient, end };
