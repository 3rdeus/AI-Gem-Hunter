/**
 * Anthropic AI Integration
 * Uses Claude to analyze token data and detect scam patterns
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
 * Analyze token data with Claude AI
 */
export async function analyzeWithAI(tokenData) {
  try {
    const client = getAnthropicClient();
    if (!client) {
      return { success: false, error: 'Anthropic not configured' };
    }

    // Prepare data summary for AI analysis
    const dataSummary = {
      tokenName: tokenData.metadata?.name || 'Unknown',
      tokenSymbol: tokenData.metadata?.symbol || 'UNKNOWN',
      liquidity: tokenData.birdeye?.liquidity || 0,
      marketCap: tokenData.birdeye?.marketCap || 0,
      volume24h: tokenData.birdeye?.volume24h || 0,
      priceChange24h: tokenData.birdeye?.priceChange24h || 0,
      holders: tokenData.birdeye?.holders || tokenData.metadata?.holder || 0,
      topHolderPercent: tokenData.holders?.topHolderPercent || 0,
      hasWebsite: !!tokenData.metadata?.website,
      hasTwitter: !!tokenData.metadata?.twitter,
      transactionCount: tokenData.transactions?.count || 0,
      communityReports: tokenData.communityReports?.totalReports || 0,
      isBlacklisted: tokenData.blacklist?.isBlacklisted || false,
    };

    const prompt = `You are a cryptocurrency security expert analyzing a Solana token for potential scams, rug pulls, and honeypots.

Token Data:
- Name: ${dataSummary.tokenName}
- Symbol: ${dataSummary.tokenSymbol}
- Liquidity: $${dataSummary.liquidity.toLocaleString()}
- Market Cap: $${dataSummary.marketCap.toLocaleString()}
- 24h Volume: $${dataSummary.volume24h.toLocaleString()}
- 24h Price Change: ${dataSummary.priceChange24h.toFixed(2)}%
- Holders: ${dataSummary.holders}
- Top Holder Owns: ${dataSummary.topHolderPercent.toFixed(2)}%
- Has Website: ${dataSummary.hasWebsite ? 'Yes' : 'No'}
- Has Twitter: ${dataSummary.hasTwitter ? 'Yes' : 'No'}
- Recent Transactions: ${dataSummary.transactionCount}
- Community Reports: ${dataSummary.communityReports}
- Blacklisted: ${dataSummary.isBlacklisted ? 'YES' : 'No'}

Analyze this token for:
1. Honeypot indicators (can't sell after buying)
2. Rug pull risk (developers can drain liquidity)
3. Wash trading (fake volume)
4. Pump and dump schemes
5. Suspicious holder concentration
6. Missing or fake social media presence
7. Any other red flags

Provide:
1. A risk score from 0-100 (0=safe, 100=extreme danger)
2. A list of specific warnings/red flags found
3. A brief explanation of the main concerns
4. A confidence level (0-100) in your analysis

Format your response as JSON:
{
  "riskScore": <number 0-100>,
  "confidence": <number 0-100>,
  "warnings": [<array of warning strings>],
  "analysis": "<brief explanation>",
  "isHoneypot": <boolean>,
  "isRugPull": <boolean>,
  "recommendation": "<SAFE|CAUTION|DANGER|EXTREME_DANGER>"
}`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0.3,
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
      // Fallback: create basic analysis
      analysis = {
        riskScore: 50,
        confidence: 30,
        warnings: ['AI analysis failed to parse'],
        analysis: responseText.substring(0, 200),
        isHoneypot: false,
        isRugPull: false,
        recommendation: 'CAUTION',
      };
    }

    return {
      success: true,
      data: {
        riskScore: analysis.riskScore || 50,
        confidence: analysis.confidence || 50,
        warnings: analysis.warnings || [],
        analysis: analysis.analysis || 'No analysis provided',
        isHoneypot: analysis.isHoneypot || false,
        isRugPull: analysis.isRugPull || false,
        recommendation: analysis.recommendation || 'CAUTION',
        rawResponse: responseText,
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

    const prompt = `Quick scam check for Solana token ${tokenAddress}:
- Liquidity: $${basicData.liquidity || 0}
- Holders: ${basicData.holders || 0}
- Top holder: ${basicData.topHolderPercent || 0}%

Is this likely a scam? Reply with just: SAFE, SUSPICIOUS, or DANGER and one sentence why.`;

    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Faster model
      max_tokens: 100,
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
    if (response.includes('SAFE')) verdict = 'SAFE';
    if (response.includes('DANGER')) verdict = 'DANGER';

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
