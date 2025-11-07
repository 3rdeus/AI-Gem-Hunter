import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate enhanced AI risk analysis incorporating GoPlus security findings
 * @param {Object} tokenData - Token data from various APIs
 * @param {Object} goplusData - Security analysis from GoPlus
 * @returns {Promise<Object>} AI-powered risk analysis
 */
export async function generateEnhancedRiskAnalysis(tokenData, goplusData) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Anthropic API key not configured');
      return null;
    }
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Build comprehensive context for Claude
    const context = buildAnalysisContext(tokenData, goplusData);
    
    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      temperature: 0.3, // Lower temperature for more consistent analysis
      messages: [{
        role: 'user',
        content: buildEnhancedPrompt(context)
      }]
    });

    // Parse Claude's response
    const analysis = parseAIResponse(message.content[0].text);
    
    return {
      ...analysis,
      raw_response: message.content[0].text
    };
  } catch (error) {
    console.error('Anthropic AI error:', error.message);
    return null;
  }
}

/**
 * Build comprehensive analysis context from all data sources
 */
function buildAnalysisContext(tokenData, goplusData) {
  const context = {
    // Basic token info
    name: tokenData.token_name || 'Unknown',
    symbol: tokenData.token_symbol || 'Unknown',
    
    // Market data
    price: tokenData.price_usd || 0,
    market_cap: tokenData.market_cap_usd || 0,
    liquidity: tokenData.liquidity_usd || 0,
    volume_24h: tokenData.volume_24h_usd || 0,
    price_change_24h: tokenData.price_change_24h || 0,
    holder_count: tokenData.holder_count || 0,
    
    // GoPlus security findings
    goplus_available: goplusData?.available || false,
    trusted_token: goplusData?.trusted_token || false,
    
    // Honeypot analysis
    is_honeypot: goplusData?.honeypot?.is_honeypot || false,
    honeypot_confidence: goplusData?.honeypot?.confidence || 0,
    honeypot_risks: goplusData?.honeypot?.risks || [],
    
    // Mint authority
    has_mint_authority: goplusData?.mint_authority?.has_mint_authority || false,
    malicious_mint_authority: goplusData?.mint_authority?.is_malicious || false,
    mint_authority_warning: goplusData?.mint_authority?.warning || null,
    
    // Other security risks
    security_risks: goplusData?.other_risks || [],
    
    // Calculated risk score
    goplus_score_penalty: goplusData?.total_score_penalty || 0
  };
  
  return context;
}

/**
 * Build enhanced prompt incorporating GoPlus findings
 */
function buildEnhancedPrompt(context) {
  return `You are an expert Solana token security analyst. Analyze the following token and provide a comprehensive risk assessment.

## Token Information

**Name**: ${context.name}
**Symbol**: ${context.symbol}

## Market Data

- **Price**: $${context.price.toFixed(6)}
- **Market Cap**: $${formatLargeNumber(context.market_cap)}
- **Liquidity**: $${formatLargeNumber(context.liquidity)}
- **24h Volume**: $${formatLargeNumber(context.volume_24h)}
- **24h Price Change**: ${context.price_change_24h.toFixed(2)}%
- **Holder Count**: ${formatLargeNumber(context.holder_count)}

## On-Chain Security Analysis (GoPlus Labs)

${context.goplus_available ? `
### Honeypot Detection
- **Is Honeypot**: ${context.is_honeypot ? 'YES ⚠️' : 'NO ✓'}
- **Confidence**: ${context.honeypot_confidence}%
${context.honeypot_risks.length > 0 ? `- **Specific Risks**: ${context.honeypot_risks.join(', ')}` : ''}

### Mint Authority
- **Has Mint Authority**: ${context.has_mint_authority ? 'YES' : 'NO'}
- **Malicious Authority**: ${context.malicious_mint_authority ? 'YES ⚠️' : 'NO'}
${context.mint_authority_warning ? `- **Warning**: ${context.mint_authority_warning}` : ''}

### Additional Security Risks
${context.security_risks.length > 0 ? context.security_risks.map(r => 
  `- **${r.type}** (${r.severity}): ${r.message}`
).join('\n') : '- No additional risks detected'}

### Trust Status
- **Trusted Token**: ${context.trusted_token ? 'YES ✓' : 'NO'}
- **GoPlus Score Penalty**: -${context.goplus_score_penalty} points
` : '- On-chain security data not available'}

## Your Task

Provide a comprehensive risk assessment considering:

1. **On-Chain Security**: GoPlus has already analyzed smart contract risks. Focus on interpreting these findings in context.

2. **Market Health**: Evaluate liquidity, volume, holder distribution, and price stability.

3. **Scam Pattern Recognition**: Look for combinations of factors that indicate:
   - Rug pull preparation (low liquidity + mint authority + few holders)
   - Pump and dump (extreme volume spikes + high price volatility)
   - Wash trading (volume/liquidity ratio > 10x)
   - Abandoned project (zero volume + declining holders)

4. **Context-Aware Analysis**: 
   - If GoPlus marks it as "trusted_token", acknowledge this but still evaluate market health
   - If honeypot detected, this is CRITICAL - emphasize the danger
   - If malicious mint authority found, this is an immediate red flag
   - Consider that legitimate stablecoins may have mint authority (e.g., USDC)

5. **Confidence Calibration**:
   - High confidence (85-100%): Clear evidence from multiple sources
   - Medium confidence (60-84%): Some indicators but not conclusive
   - Low confidence (0-59%): Limited data or conflicting signals

## Response Format

Provide your analysis in JSON format:

\`\`\`json
{
  "risk_level": "safe|low|medium|high|critical",
  "confidence": 85,
  "primary_concern": "Brief statement of the main risk or 'No major concerns'",
  "scam_patterns_detected": ["pattern1", "pattern2"],
  "key_findings": [
    "Finding 1 with specific numbers",
    "Finding 2 with specific numbers",
    "Finding 3 with specific numbers"
  ],
  "recommendation": "SAFE|ACCEPTABLE|CAUTION|AVOID|EXTREME_DANGER",
  "reasoning": "2-3 sentence explanation of your assessment"
}
\`\`\`

**Important Guidelines:**

- If GoPlus detected a honeypot with >70% confidence, risk_level MUST be "critical"
- If malicious mint authority detected, risk_level MUST be at least "high"
- If trusted_token = true AND no honeypot, risk_level should be "safe" or "low"
- Use specific numbers in key_findings (e.g., "Only 12 holders" not "Few holders")
- Be direct and actionable in your recommendation
- If GoPlus found critical issues, acknowledge them prominently

Analyze now:`;
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(text) {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                     text.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        risk_level: parsed.risk_level || 'medium',
        confidence: parsed.confidence || 50,
        primary_concern: parsed.primary_concern || 'Unable to assess',
        scam_patterns_detected: parsed.scam_patterns_detected || [],
        key_findings: parsed.key_findings || [],
        recommendation: parsed.recommendation || 'CAUTION',
        reasoning: parsed.reasoning || 'Analysis incomplete'
      };
    }
    
    // Fallback if JSON parsing fails
    return {
      risk_level: 'medium',
      confidence: 50,
      primary_concern: 'Unable to parse AI response',
      scam_patterns_detected: [],
      key_findings: [],
      recommendation: 'CAUTION',
      reasoning: text.substring(0, 200)
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      risk_level: 'medium',
      confidence: 0,
      primary_concern: 'AI analysis failed',
      scam_patterns_detected: [],
      key_findings: [],
      recommendation: 'CAUTION',
      reasoning: 'Unable to complete analysis'
    };
  }
}

/**
 * Format large numbers for readability
 */
function formatLargeNumber(num) {
  if (num === 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
