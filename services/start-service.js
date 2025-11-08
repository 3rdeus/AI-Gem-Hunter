/**
 * Birdeye Integration Test Endpoint (Simplified)
 * Tests Birdeye API connectivity without complex imports
 */

export default async function handler(req, res) {
  const { test = 'all' } = req.query;

  try {
    const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
    
    if (!BIRDEYE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BIRDEYE_API_KEY not configured'
      });
    }

    let results = {};

    // Test 1: API Connectivity
    if (test === 'all' || test === 'connectivity') {
      try {
        // Test with USDC token
        const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const response = await fetch(
          `https://public-api.birdeye.so/defi/price?address=${testToken}`,
          {
            headers: {
              'X-API-KEY': BIRDEYE_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.connectivity = {
            success: true,
            message: 'Birdeye API connected successfully',
            testToken: testToken,
            price: data.data?.value || 'N/A'
          };
        } else {
          results.connectivity = {
            success: false,
            error: `API returned ${response.status}`
          };
        }
      } catch (error) {
        results.connectivity = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 2: Token Overview
    if (test === 'all' || test === 'overview') {
      try {
        const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const response = await fetch(
          `https://public-api.birdeye.so/defi/token_overview?address=${testToken}`,
          {
            headers: {
              'X-API-KEY': BIRDEYE_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.overview = {
            success: true,
            message: 'Token overview retrieved successfully',
            liquidity: data.data?.liquidity || 'N/A',
            volume24h: data.data?.v24hUSD || 'N/A'
          };
        } else {
          results.overview = {
            success: false,
            error: `API returned ${response.status}`
          };
        }
      } catch (error) {
        results.overview = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 3: Price History
    if (test === 'all' || test === 'history') {
      try {
        const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const response = await fetch(
          `https://public-api.birdeye.so/defi/history_price?address=${testToken}&address_type=token&type=1H&time_from=${Math.floor(Date.now() / 1000) - 3600}&time_to=${Math.floor(Date.now() / 1000)}`,
          {
            headers: {
              'X-API-KEY': BIRDEYE_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.history = {
            success: true,
            message: 'Price history retrieved successfully',
            dataPoints: data.data?.items?.length || 0
          };
        } else {
          results.history = {
            success: false,
            error: `API returned ${response.status}`
          };
        }
      } catch (error) {
        results.history = {
          success: false,
          error: error.message
        };
      }
    }

    // Summary
    const allSuccess = Object.values(results).every(r => r.success);

    return res.status(200).json({
      success: allSuccess,
      message: allSuccess
        ? '✅ All Birdeye API tests passed!'
        : '⚠️ Some tests failed',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Birdeye test error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
