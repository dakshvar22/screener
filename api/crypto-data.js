// api/crypto-data.js
// Vercel Serverless Function to fetch crypto data

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
  '1d': { interval: '1d', limit: 500 }
};

const aggregateCandles = (prices, interval) => {
  if (!interval || interval === 1) return prices;

  const aggregated = [];
  for (let i = 0; i < prices.length; i += interval) {
    if (i + interval - 1 < prices.length) {
      const candle = prices.slice(i, i + interval);
      const close = candle[candle.length - 1][1];
      const timestamp = candle[0][0];
      aggregated.push([timestamp, close]);
    }
  }
  return aggregated;
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { timeframe = '4h' } = req.query;
  const timeframeConfig = TIMEFRAME_CONFIG[timeframe];

  if (!timeframeConfig) {
    return res.status(400).json({ error: 'Invalid timeframe' });
  }

  const results = [];
  const errors = [];

  console.log('Starting crypto data fetch...');

  try {
    console.log('Processing', CRYPTO_SYMBOLS.length, 'symbols with', timeframeConfig.limit, 'candles');

    // Process coins in batches - Binance has much higher rate limits
    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < CRYPTO_SYMBOLS.length; i += BATCH_SIZE) {
      batches.push(CRYPTO_SYMBOLS.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map(async (crypto) => {
        try {
          // Binance klines API endpoint
          const url = `https://api.binance.com/api/v3/klines?symbol=${crypto.symbol}&interval=${timeframeConfig.interval}&limit=${timeframeConfig.limit}`;

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'crypto-screener/1.0'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`${crypto.name}: HTTP ${response.status} - ${response.statusText}`);
            return null;
          }

          const result = await response.json();

          if (!result || result.length === 0) {
            errors.push(`${crypto.name}: No kline data returned`);
            return null;
          }

          // Convert Binance kline format to [timestamp, price]
          // Binance returns: [openTime, open, high, low, close, volume, closeTime, ...]
          const prices = result.map(kline => [kline[0], parseFloat(kline[4])]); // [timestamp, close price]

          if (prices && prices.length >= 200) {
            return {
              id: crypto.symbol,
              name: crypto.name,
              prices: prices
            };
          } else {
            errors.push(`${crypto.name}: Not enough data (${prices?.length || 0} candles)`);
            return null;
          }
        } catch (err) {
          errors.push(`${crypto.name}: ${err.message}`);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(r => r !== null));

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Successfully fetched', results.length, 'coins with', errors.length, 'errors');

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'All coins processed via Binance API',
        totalCoins: CRYPTO_SYMBOLS.length,
        successfulCoins: results.length,
        timeframeConfig: timeframeConfig
      },
      timestamp: new Date().toISOString(),
      timeframe: timeframe
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return res.status(500).json({
      error: `Server error: ${error.message}`,
      coins: [],
      errors: [error.message],
      debug: {
        stack: error.stack,
        message: error.message
      }
    });
  }
}
