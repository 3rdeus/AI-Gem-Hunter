# Token Safety API

Fast, lightweight, and extensible API server for Solana token safety checks with AI-powered risk analysis. Guaranteed sub-5 second response times.

---

## Features

- **Parallel API Calls**: Fetches data from Birdeye, Solscan, and Supabase simultaneously for maximum speed.
- **AI Risk Analysis**: Uses Anthropic Claude to analyze token data for sophisticated scam patterns.
- **Sub-5 Second Guarantee**: Hard timeout at 4.5 seconds to ensure fast responses.
- **Secure Credential Management**: Uses `.env` file for API keys, never exposed in code.
- **Extensible Architecture**: Easily add new API integrations or analysis modules.
- **Serverless Ready**: Deploy to Vercel or Supabase Edge Functions with one command.
- **Health Monitoring**: `/api/health` endpoint for uptime checks.
- **Structured Logging**: Clean, informative logs without sensitive data.

---

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd token-safety-api

# Install dependencies
pnpm install
```

### 2. Configuration

Copy the `.env.example` file to `.env` and add your API keys:

```bash
cp .env.example .env
```

**Edit `.env`:**

```
# Anthropic API (Claude AI for risk analysis)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Supabase (Database and additional token data)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Server Configuration
PORT=3000
API_TIMEOUT_MS=4500
```

### 3. Run Locally

```bash
# Start the development server
pnpm dev
```

The API will be available at `http://localhost:3000/api/check-token`.

### 4. Test the API

```bash
curl -X POST http://localhost:3000/api/check-token \
  -H "Content-Type: application/json" \
  -d '{"tokenAddress":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "token_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "token_name": "USD Coin",
    "safety_score": 95,
    "warnings": [],
    "ai_analysis": "This token appears to be safe...",
    "checked_at": "2025-11-06T14:00:00.000Z"
  }
}
```

---

## Deployment

### Option 1: Vercel (Recommended)

1. **Push to GitHub**
2. **Import Project on Vercel**
   - Go to your Vercel dashboard and import the repository.
   - Vercel will automatically detect the `vercel.json` file.
3. **Add Environment Variables**
   - In your Vercel project settings, add the API keys from your `.env` file.
4. **Deploy**
   - Vercel will build and deploy the serverless functions.

Your API will be live at `https://your-project.vercel.app/api/check-token`.

### Option 2: Supabase Edge Functions

1. **Install Supabase CLI**

   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**

   ```bash
   supabase login
   ```

3. **Link Your Project**

   ```bash
   supabase link --project-ref <your-project-id>
   ```

4. **Set Secrets**

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=your-key-here
   supabase secrets set SUPABASE_URL=your-url-here
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key-here
   ```

5. **Deploy the Function**

   ```bash
   supabase functions deploy check-token
   ```

Your API will be live at `https://<your-project-id>.supabase.co/functions/v1/check-token`.

### Option 3: Traditional Node.js Server

1. **Build for Production**

   ```bash
   # No build step needed for this simple setup
   ```

2. **Run on Server**

   ```bash
   # Make sure .env file is present
   NODE_ENV=production node api/check-token.js
   ```

   Use a process manager like `pm2` for production:

   ```bash
   pm2 start api/check-token.js --name token-safety-api
   ```

---

## API Endpoints

### `POST /api/check-token`

Checks the safety of a Solana token.

**Request Body:**

```json
{
  "tokenAddress": "string"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "token_address": "string",
    "token_name": "string",
    "safety_score": 0-100,
    "warnings": ["string"],
    "ai_analysis": "string",
    "checked_at": "ISO timestamp"
  }
}
```

**Error Response (4xx/5xx):**

```json
{
  "success": false,
  "error": "Error message"
}
```

### `GET /api/health`

Checks the health of the API and its dependencies.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "ISO timestamp",
  "services": {
    "anthropic": true,
    "supabase": true
  }
}
```

---

## Architecture

- **`api/`**: Serverless function entry points.
  - `check-token.js`: Main API logic.
  - `health.js`: Health check endpoint.
- **`lib/`**: API integration modules.
  - `birdeye.js`: Birdeye API integration.
  - `solscan.js`: Solscan API integration.
  - `supabase.js`: Supabase database integration.
  - `anthropic-ai.js`: Anthropic Claude AI analysis.
  - `logger.js`: Structured logging.
- **`config/`**: (Future use) Configuration files for different environments.
- **`supabase/`**: Supabase-specific files.
  - `functions/`: Edge function code.
  - `schema.sql`: Database schema.

---

## Extending the API

### Adding a New API

1. **Create a new module** in `lib/` (e.g., `pumpfun.js`).
2. **Export a fetch function** (e.g., `fetchPumpFunData`).
3. **Add it to the `apiPromises` array** in `api/check-token.js`.
4. **Process the results** and add to the final response.

### Adding New Analysis

1. **Create an analysis function** in the relevant module (e.g., `analyzePumpFunData`).
2. **Call it** in `api/check-token.js`.
3. **Add warnings and risk score** to the aggregates.

---

## Security

- **Never commit `.env` files** to version control.
- **Use environment variables** for all secrets.
- **HTTPS is enforced** by Vercel and Supabase.
- **Structured logging** prevents accidental exposure of sensitive data.

---

## Troubleshooting

- **Timeout Errors**: Increase `API_TIMEOUT_MS` in `.env` or optimize API calls.
- **401 Unauthorized**: Check your API keys in `.env`.
- **500 Internal Server Error**: Check the server logs (Vercel dashboard or `pm2 logs`).
- **CORS Errors**: Ensure your frontend is sending the correct headers. The server is configured to allow all origins (`*`).

---

## References

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Anthropic API](https://docs.anthropic.com/)
- [Birdeye API](https://docs.birdeye.so/)
- [Solscan API](https://docs.solscan.io/)


## Birdeye Integration

- **WebSocket**: Real-time data streaming
- **Wallet Tracking**: Monitor wallet performance
- **Liquidity Monitoring**: Track pool liquidity changes
- **Historical Data**: Analyze price patterns

Test endpoint: `/api/birdeye-test`


<!-- Force deployment trigger -->
<!-- Reconnect webhook test -->
