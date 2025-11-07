/**
 * Enhanced Anthropic AI Integration
 * Uses Claude with sophisticated prompting for accurate risk assessment
 */

import Anthropic from '@anthropic-ai/sdk';

let anthropicClient = null;

/**
 * Initialize Anthropic client
 */
function getAnthropicClient() {
  if (anthropicClient) {
    return anthropicClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('Anthropic API key not configured');
    return null;
  }

  anthropicClient = new Anthropic({
    apiKey: apiKey,
  });

  return anthropicClient;
}

/**
 * Enhanced AI analysis with sophisticated prompt
 */
export async function analyzeWithAI(tokenAddress, tokenData) {
  try {
    const client = getAnthropicClient();
    if (!client) {
      return { success: false, error: 'Anthropic not configured' };
    }

    const prompt = `You are an elite cryptocurrency security analyst specializing in Solana token risk assessment. Your analysis has prevented millions in losses from rug pulls, honeypots, and scams.

## Token Analysis Request

**Token Address:** ${tokenAddress}

**Market Data:**
${JSON.stringify(tokenData, null, 2)}

## Your Task

Analyze this token for security risks, scam patterns, and investment safety. Consider:

### Critical Risk Indicators
1. **Honeypot Detection**: Can tokens be sold after purchase? Look for:
   - Extremely low liquidity relative to market cap
   - No recent sell transactions
   - Suspicious contract patterns

2. **Rug Pull Signals**: Will developers abandon the project? Check for:
   - Single wallet holding >50% of supply
   - Unlocked liquidity pools
   - Anonymous team with no social presence
   - Rapid price pump followed by developer selling

3. **Wash Trading**: Is volume fake? Indicators:
   - Volume >10x market cap (artificial activity)
   - Few unique holders despite high volume
   - Repetitive transaction patterns

4. **Pump and Dump**: Coordinated manipulation? Signs:
   - Extreme price volatility (>100% in 24h)
   - Sudden volume spikes
   - Social media hype with no fundamentals

5. **Low Liquidity Trap**: Can you exit your position?
   - Liquidity < $10K = extreme risk
   - Liquidity < $50K = high slippage risk

### Positive Indicators
- Large holder count (>10,000)
- Established market cap (>$10M)
- Verified social presence (website, Twitter)
- Listed on major exchanges
- Audited smart contract
- Active development team

### Reference Ranges (Solana Ecosystem)
- **Safe Liquidity**: >$100K
- **Safe Market Cap**: >$1M
- **Safe Holders**: >1,000
- **Healthy Volume/MC Ratio**: 0.1 - 2.0
- **Acceptable Volatility**: <20% daily

## Output Format

Provide your analysis as a structured JSON response:

{
  "risk_level": "low|medium|high|critical",
  "confidence": 85,
  "primary_concern": "Brief description of the biggest risk",
  "scam_patterns_detected": ["honeypot", "wash_trading"],
  "risk_factors": [
    "Top holder owns 75% of supply",
    "Liquidity only $5K - extreme slippage risk"
  ],
  "positive_factors": [
    "Listed on CoinGecko",
    "5,000+ holders"
  ],
  "recommendation": "AVOID|CAUTION|ACCEPTABLE|SAFE",
  "reasoning": "2-3 sentence explanation of your assessment",
  "action_items": [
    "Verify contract on Solscan",
    "Check liquidity lock status"
  ]
}

## Confidence Calibration
- 90-100%: Clear scam patterns or established safe token
- 70-89%: Strong indicators but some uncertainty
- 50-69%: Mixed signals, insufficient data
- <50%: Very limited data, mostly speculation

## Critical Rules
1. Be conservative - better to warn about a safe token than miss a scam
2. Use specific numbers from the data ("75% held by top wallet" not "high concentration")
3. If data is missing, state it explicitly and lower confidence
4. Recognize established tokens (USDC, SOL, USDT, etc.) as safe
5. New tokens (<1 week old) are inherently higher risk

Provide your analysis now:`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.2, // Lower temperature for more consistent analysis
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    const responseText = message.content[0].text;
    
    // Try to parse JSON from response
    let analysis;
    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', responseText);
      
      // Fallback: create basic analysis
      analysis = {
        risk_level: 'medium',
        confidence: 30,
        primary_concern: 'AI analysis parsing failed',
        scam_patterns_detected: [],
        risk_factors: ['Unable to parse AI response'],
        positive_factors: [],
        recommendation: 'CAUTION',
        reasoning: responseText.substring(0, 200),
        action_items: ['Review token manually'],
      };
    }

    return {
      success: true,
      data: {
        risk_level: analysis.risk_level || 'medium',
        confidence: analysis.confidence || 50,
        primary_concern: analysis.primary_concern || 'Unknown',
        scam_patterns: analysis.scam_patterns_detected || [],
        risk_factors: analysis.risk_factors || [],
        positive_factors: analysis.positive_factors || [],
        recommendation: analysis.recommendation || 'CAUTION',
        reasoning: analysis.reasoning || 'No reasoning provided',
        action_items: analysis.action_items || [],
        raw_response: responseText,
      },
    };
  } catch (error) {
    console.error('Anthropic AI error:', error);
    
    // Check for specific error types
    if (error.status === 429) {
      return { success: false, error: 'Rate limit exceeded' };
    }
    
    if (error.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }

    return { success: false, error: error.message };
  }
}

/**
 * Quick AI pattern check (faster, less detailed)
 */
export async function quickPatternCheck(tokenAddress, basicData) {
  try {
    const client = getAnthropicClient();
    if (!client) {
      return { success: false, error: 'Anthropic not configured' };
    }

    const prompt = `Quick scam assessment for Solana token ${tokenAddress}:

Data:
- Liquidity: $${(basicData.liquidity || 0).toLocaleString()}
- Market Cap: $${(basicData.marketCap || 0).toLocaleString()}
- Holders: ${(basicData.holders || 0).toLocaleString()}
- Top Holder: ${(basicData.topHolderPercent || 0).toFixed(1)}%
- 24h Volume: $${(basicData.volume24h || 0).toLocaleString()}

Provide instant verdict: SAFE, SUSPICIOUS, or DANGER
Then one sentence explaining why.

Format: VERDICT: reason`;

    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Faster model
      max_tokens: 150,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const response = message.content[0].text.trim();
    
    let verdict = 'SUSPICIOUS';
    if (response.toUpperCase().includes('SAFE')) verdict = 'SAFE';
    if (response.toUpperCase().includes('DANGER')) verdict = 'DANGER';

    return {
      success: true,
      data: {
        verdict,
        reason: response,
      },
    };
  } catch (error) {
    console.error('Anthropic quick check error:', error);
    return { success: false, error: error.message };
  }
}

export { getAnthropicClient };
