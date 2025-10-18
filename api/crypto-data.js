// api/crypto-data.js
// Professional Binance API implementation with secure environment variables

const crypto = require('crypto');

const CRYPTO_SYMBOLS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'ADAUSDT', name: 'Cardano' },
  { symbol: 'AVAXUSDT', name: 'Avalanche' },
  { symbol: 'DOTUSDT', name: 'Polkadot' },
  { symbol: 'MATICUSDT', name: 'Polygon' },
  { symbol: 'LINKUSDT', name: 'Chainlink' },
  { symbol: 'UNIUSDT', name: 'Uniswap' },
  { symbol: 'LTCUSDT', name: 'Litecoin' },
  { symbol: 'NEARUSDT', name: 'NEAR' },
  { symbol: 'APTUSDT', name: 'Aptos' },
  { symbol: 'ARBUSDT', name: 'Arbitrum' },
  { symbol: 'OPUSDT', name: 'Optimism' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'XLMUSDT', name: 'Stellar' },
  { symbol: 'ATOMUSDT', name: 'Cosmos' },
  { symbol: 'INJUSDT', name: 'Injective' }
];

const TIMEFRAME_CONFIG = {
  '1h': { interval: '1h', limit: 500 },
  '4h': { interval: '4h', limit: 500 },
  '1d': { interval: '1d', limit: 400 }
};

// Create HMAC signature for Binance API authentication
function createSignature(queryString, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
}

// Build authenticated Binance API URL
function buildBinanceUrl(symbol, interval, limit, apiKey, secret) {
  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&interval=${interval}&limit=${limit}&timestamp=${timestamp}`;
  const signature = createSignature(queryString, secret);

  return `https://api.binance.com/api/v3/klines?${queryString}&signature=${signature}`;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get API credentials from environment variables
  const API_KEY = process.env.BINANCE_API_KEY;
  const SECRET_KEY = process.env.BINANCE_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    return res.status(500).json({
      error: 'Binance API credentials not configured',
      coins: [],
      errors: ['Missing BINANCE_API_KEY or BINANCE_SECRET_KEY environment variables'],
      debug: {
        message: 'API credentials required',
        hasApiKey: !!API_KEY,
        hasSecretKey: !!SECRET_KEY
      }
    });
  }

  const { timeframe = '4h' } = req.query;
  const config = TIMEFRAME_CONFIG[timeframe];

  if (!config) {
    return res.status(400).json({
      error: 'Invalid timeframe. Use 1h, 4h, or 1d',
      coins: [],
      errors: [`Invalid timeframe: ${timeframe}`]
    });
  }

  const results = [];
  const errors = [];

  console.log(`Starting secure Binance API fetch for ${CRYPTO_SYMBOLS.length} symbols using ${timeframe} timeframe`);

  try {
    // Process coins in batches to respect rate limits
    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < CRYPTO_SYMBOLS.length; i += BATCH_SIZE) {
      batches.push(CRYPTO_SYMBOLS.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map(async (crypto) => {
        try {
          const url = buildBinanceUrl(
            crypto.symbol,
            config.interval,
            config.limit,
            API_KEY,
            SECRET_KEY
          );

          console.log(`Fetching ${crypto.name} (${crypto.symbol})`);

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'X-MBX-APIKEY': API_KEY,
              'User-Agent': 'crypto-screener/1.0'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP Error for ${crypto.name}:`, response.status, errorText);
            return { error: `${crypto.name}: HTTP ${response.status} - ${response.statusText}`, coin: null };
          }

          const result = await response.json();

          if (!Array.isArray(result) || result.length === 0) {
            console.error(`No kline data for ${crypto.name}`);
            return { error: `${crypto.name}: No kline data returned`, coin: null };
          }

          // Convert Binance kline format to [timestamp, price]
          // Binance returns: [openTime, open, high, low, close, volume, closeTime, ...]
          const prices = result.map(kline => [
            parseInt(kline[0]), // timestamp
            parseFloat(kline[4]) // close price
          ]);

          // Ensure we have enough data for 300-period moving average
          if (prices.length < 300) {
            console.error(`Insufficient data for ${crypto.name}: ${prices.length} candles`);
            return { error: `${crypto.name}: Only ${prices.length} data points (need 300+)`, coin: null };
          }

          console.log(`✓ ${crypto.name}: ${prices.length} data points`);

          return {
            error: null,
            coin: {
              id: crypto.symbol,
              name: crypto.name,
              prices: prices
            }
          };

        } catch (err) {
          console.error(`Exception for ${crypto.name}:`, err.message);
          return { error: `${crypto.name}: ${err.message}`, coin: null };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(promises);

      // Process batch results
      batchResults.forEach(({ error, coin }) => {
        if (error) {
          errors.push(error);
        } else if (coin) {
          results.push(coin);
        }
      });

      // Small delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    console.log(`Binance API fetch completed: ${successCount} successful, ${errorCount} errors`);

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'Secure Binance API fetch completed',
        totalRequested: CRYPTO_SYMBOLS.length,
        successfulCoins: successCount,
        failedCoins: errorCount,
        timeframe: timeframe,
        apiUsed: 'Binance (Authenticated)',
        hasCredentials: true
      },
      timestamp: new Date().toISOString(),
      timeframe: timeframe
    });

  } catch (error) {
    console.error('Fatal error in Binance API fetch:', error);
    return res.status(500).json({
      error: `Server error: ${error.message}`,
      coins: [],
      errors: [`Fatal error: ${error.message}`],
      debug: {
        stack: error.stack,
        message: error.message,
        timeframe: timeframe,
        apiUsed: 'Binance (Authenticated)'
      }
    });
  }
}