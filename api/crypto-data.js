// api/crypto-data.js
// Vercel Serverless Function to fetch crypto data

const CRYPTO_SYMBOLS = [
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'SOL-USD', name: 'Solana' },
  { symbol: 'XRP-USD', name: 'XRP' },
  { symbol: 'ADA-USD', name: 'Cardano' },
  { symbol: 'AVAX-USD', name: 'Avalanche' },
  { symbol: 'DOT-USD', name: 'Polkadot' },
  { symbol: 'MATIC-USD', name: 'Polygon' },
  { symbol: 'LINK-USD', name: 'Chainlink' },
  { symbol: 'UNI-USD', name: 'Uniswap' },
  { symbol: 'LTC-USD', name: 'Litecoin' },
  { symbol: 'NEAR-USD', name: 'NEAR' },
  { symbol: 'DOGE-USD', name: 'Dogecoin' },
  { symbol: 'XLM-USD', name: 'Stellar' },
  { symbol: 'ATOM-USD', name: 'Cosmos' }
];

const TIMEFRAME_CONFIG = {
  '1h': { granularity: 3600, candles: 500 },    // 1 hour in seconds
  '4h': { granularity: 14400, candles: 500 },   // 4 hours in seconds
  '1d': { granularity: 86400, candles: 500 }    // 1 day in seconds
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
    console.log('Processing', CRYPTO_SYMBOLS.length, 'symbols with', timeframeConfig.candles, 'candles');

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const start = now - (timeframeConfig.candles * timeframeConfig.granularity);

    // Process coins in batches - Coinbase has good rate limits
    const BATCH_SIZE = 5;
    const batches = [];

    for (let i = 0; i < CRYPTO_SYMBOLS.length; i += BATCH_SIZE) {
      batches.push(CRYPTO_SYMBOLS.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map(async (crypto) => {
        try {
          // Coinbase Pro API endpoint - use ISO timestamps
          const startISO = new Date(start * 1000).toISOString();
          const endISO = new Date(now * 1000).toISOString();
          const url = `https://api.exchange.coinbase.com/products/${crypto.symbol}/candles?start=${startISO}&end=${endISO}&granularity=${timeframeConfig.granularity}`;

          console.log('Fetching:', crypto.name, 'URL:', url);

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'crypto-screener/1.0'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.log('Error for', crypto.name, ':', response.status, errorText);
            errors.push(`${crypto.name}: HTTP ${response.status} - ${response.statusText} - ${errorText}`);
            return null;
          }

          const result = await response.json();

          if (!result || result.length === 0) {
            errors.push(`${crypto.name}: No candle data returned`);
            return null;
          }

          // Convert Coinbase format to [timestamp, price]
          // Coinbase returns: [timestamp, low, high, open, close, volume]
          const prices = result.map(candle => [candle[0] * 1000, parseFloat(candle[4])]); // [timestamp in ms, close price]

          // Sort by timestamp (Coinbase returns newest first)
          prices.sort((a, b) => a[0] - b[0]);

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
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('Successfully fetched', results.length, 'coins with', errors.length, 'errors');

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'All coins processed via Coinbase API',
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
