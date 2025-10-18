# Environment Setup for Crypto Screener

## 🔐 Secure Binance API Configuration

This application uses Binance API with proper authentication and environment variable security.

### 1. Get Binance API Credentials

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Click "Create API"
3. **IMPORTANT**: Only enable "Enable Reading" permission
4. **DO NOT** enable trading permissions for security
5. Copy your API Key and Secret Key

### 2. Local Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your credentials:
   ```
   BINANCE_API_KEY=your_actual_api_key_here
   BINANCE_SECRET_KEY=your_actual_secret_key_here
   ```

3. The `.env.local` file is automatically ignored by git for security

### 3. Vercel Production Setup

1. Go to your Vercel dashboard
2. Select your project → Settings → Environment Variables
3. Add these variables:
   - `BINANCE_API_KEY` = your API key
   - `BINANCE_SECRET_KEY` = your secret key
4. Set for Production, Preview, and Development environments

### 4. Security Best Practices

✅ **DO:**
- Only enable "Enable Reading" permission on your API key
- Keep your secret key private and secure
- Use environment variables for all credentials
- Never commit API keys to git

❌ **DON'T:**
- Enable trading permissions
- Put API keys directly in code
- Share your secret key
- Commit .env.local to git

### 5. API Features

With authenticated Binance API, you get:
- ✅ High rate limits (1200 requests/minute)
- ✅ Reliable data from world's largest crypto exchange
- ✅ All timeframes (1h, 4h, 1d)
- ✅ 20+ cryptocurrencies
- ✅ Real-time professional trading data

## 🚀 Ready to Deploy!

Once environment variables are configured, your crypto screener will have enterprise-grade data reliability.