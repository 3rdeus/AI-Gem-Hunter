/**
 * Health Check Endpoint
 * Used by Chrome extension to verify API is operational
 */

import 'dotenv/config';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const startTime = Date.now();

  try {
    // Check environment variables
    const checks = {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      birdeye: true, // Public API, no key required
      solscan: true, // Public API, no key required
    };

    const allHealthy = Object.values(checks).every(v => v);

    // Quick API connectivity test (optional)
    let apiConnectivity = 'not_tested';
    
    if (req.query.test === 'full') {
      try {
        // Test Birdeye API
        const birdeyeTest = await fetch('https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        
        apiConnectivity = birdeyeTest.ok ? 'healthy' : 'degraded';
      } catch (error) {
        apiConnectivity = 'unhealthy';
      }
    }

    const responseTime = Date.now() - startTime;

    return res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      services: checks,
      api_connectivity: apiConnectivity,
      version: '1.0.0',
      uptime: process.uptime ? Math.floor(process.uptime()) : 'n/a',
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}
