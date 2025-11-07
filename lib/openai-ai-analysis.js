import OpenAI from 'openai';

/**
 * Generate enhanced AI risk analysis using OpenAI GPT-4
 * @param {Object} tokenData - Token data from various APIs
 * @param {Object} goplusData - Security analysis from GoPlus
 * @returns {Promise<Object>} AI-powered risk analysis
 */
export async function generateEnhancedRiskAnalysis(tokenData, goplusData) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return null;
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI();
    
    // Build comprehensive context for analysis
    const context = buildAnalysisContext(tokenData, goplusData);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      max_tokens: 800,
      messages: [{
        role: 'system',
        content: 'You are an expert blockchain security analyst specializing in detecting cryptocurrency scams, rug pulls, and honeypot tokens. Analyze token data and provide concise, actionable risk assessments.'
      }, {
        role: 'user',
        content: buildEnhancedPrompt(context)
      }]
    });
    
    // Parse AI response
    const analysis = parseAIResponse(completion.choices[0].message.content);
    
    return {
      ...analysis,
      raw_response: completion.choices[0].message.content
    };
  } catch (error) {
    console.error('OpenAI AI error:', error.message);
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
    symbol: tokenData.token_symbol || 'UNKNOWN',
    
    // Market metrics
    price: tokenData.price_usd || 0,
    marketCap: tokenData.market_cap_usd || 0,
    liquidity: tokenData.liquidity_usd || 0,
    volume24h: tokenData.volume_24h_usd || 0,
    priceChange24h: tokenData.price_change_24h || 0,
    holders: tokenData.holder_count || 0,
    
    // Security data from GoPlus
    isHoneypot: goplusData?.is_honeypot || false,
    isMintable: goplusData?.is_mintable || false,
    hasBlacklist: goplusData?.has_blacklist || false,
    topHolderPercent: goplusData?.top_holder_percent || 0,
    
    // Additional context
    hasLiquidity: (tokenData.liquidity_usd || 0) > 0,
    hasVolume: (tokenData.volume_24h_usd || 0) > 0,
    hasHolders: (tokenData.holder_count || 0) > 0
  };
  
  return context;
}

/**
 * Build enhanced prompt for AI analysis
 */
function buildEnhancedPrompt(context) {
  return `Analyze this Solana token for scam/rug pull risk:

TOKEN INFORMATION:
- Name: ${context.name}
- Symbol: ${context.symbol}

MARKET METRICS:
- Price: $${context.price.toFixed(6)}
- Market Cap: $${formatNumber(context.marketCap)}
- Liquidity: $${formatNumber(context.liquidity)}
- 24h Volume: $${formatNumber(context.volume24h)}
- 24h Price Change: ${context.priceChange24h.toFixed(2)}%
- Holder Count: ${formatNumber(context.holders)}

SECURITY ANALYSIS (GoPlus Labs):
- Honeypot Detected: ${context.isHoneypot ? 'YES ⚠️' : 'No'}
- Mintable (Unlimited Supply): ${context.isMintable ? 'YES ⚠️' : 'No'}
- Has Blacklist Function: ${context.hasBlacklist ? 'YES ⚠️' : 'No'}
- Top Holder Ownership: ${context.topHolderPercent.toFixed(1)}%

RESPOND IN THIS EXACT JSON FORMAT:
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0-1.0,
  "primary_concern": "Brief main risk (max 100 chars)",
  "scam_patterns": ["pattern1", "pattern2"],
  "key_findings": ["finding1", "finding2", "finding3"]
}

SCAM PATTERNS TO DETECT:
- Honeypot (can buy but cannot sell)
- Rug pull indicators (low liquidity, concentrated ownership)
- Pump and dump schemes (extreme volatility, no fundamentals)
- Fake tokens impersonating legitimate projects
- Tokens with blacklist/freeze functions
- Unlimited minting capability
- Suspicious holder distribution
- No trading activity despite claims
- Missing social media/website

RISK LEVEL CRITERIA:
- LOW: Established token, high liquidity (>$100k), many holders (>1000), no security issues
- MEDIUM: Moderate liquidity ($10k-$100k), some concerns but tradeable
- HIGH: Low liquidity (<$10k), security warnings, or suspicious patterns
- CRITICAL: Confirmed honeypot, rug pull indicators, or multiple red flags

Be concise and actionable. Focus on the most critical risks first.`;
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(text) {
  try {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        risk_level: parsed.risk_level || 'UNKNOWN',
        confidence: parsed.confidence || 0.5,
        primary_concern: parsed.primary_concern || 'Unable to assess',
        scam_patterns: parsed.scam_patterns || [],
        key_findings: parsed.key_findings || []
      };
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error.message);
  }
  
  // Fallback if parsing fails
  return {
    risk_level: 'UNKNOWN',
    confidence: 0.3,
    primary_concern: 'AI analysis failed to parse',
    scam_patterns: [],
    key_findings: [text.substring(0, 200)]
  };
}

/**
 * Format large numbers with K/M/B suffixes
 */
function formatNumber(num) {
  if (num === 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
