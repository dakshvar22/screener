// api/crypto-data.js
// Vercel Serverless Function to fetch crypto data

const CRYPTO_IDS = [
  { id: 'bitcoin', name: 'Bitcoin' },
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'binancecoin', name: 'BNB' },
  { id: 'solana', name: 'Solana' },
  { id: 'ripple', name: 'XRP' },
  { id: 'cardano', name: 'Cardano' },
  { id: 'avalanche-2', name: 'Avalanche' },
  { id: 'polkadot', name: 'Polkadot' },
  { id: 'matic-network', name: 'Polygon' },
  { id: 'chainlink', name: 'Chainlink' },
  { id: 'uniswap', name: 'Uniswap' },
  { id: 'litecoin', name: 'Litecoin' },
  { id: 'near', name: 'NEAR' },
  { id: 'aptos', name: 'Aptos' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'dogecoin', name: 'Dogecoin' },
  { id: 'stellar', name: 'Stellar' },
  { id: 'cosmos', name: 'Cosmos' },
  { id: 'injective-protocol', name: 'Injective' }
];

const TIMEFRAME_CONFIG = {
  '1h': { interval: 'h1', candles: 300 },
  '4h': { interval: 'h1', candles: 300, aggregate: 4 },
  '1d': { interval: 'd1', candles: 300 }
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
    // Calculate common parameters
    const now = Date.now();
    const candlesNeeded = timeframeConfig.aggregate ?
      timeframeConfig.candles * timeframeConfig.aggregate :
      timeframeConfig.candles;

    const days = Math.min(Math.max(Math.ceil(candlesNeeded / 24), 2), 90);

    console.log('Processing', CRYPTO_IDS.length, 'coins with', days, 'days of data');

    // Process coins in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    const batches = [];

    for (let i = 0; i < CRYPTO_IDS.length; i += BATCH_SIZE) {
      batches.push(CRYPTO_IDS.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map(async (crypto) => {
        try {
          const url = `https://api.coingecko.com/api/v3/coins/${crypto.id}/market_chart?vs_currency=usd&days=${days}`;

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

          if (!result.prices || result.prices.length === 0) {
            errors.push(`${crypto.name}: No price data returned`);
            return null;
          }

          // Convert CoinGecko format [timestamp, price] - already in correct format
          let prices = result.prices;

          // Aggregate to 4H if needed
          if (timeframeConfig.aggregate) {
            prices = aggregateCandles(prices, timeframeConfig.aggregate);
          }

          if (prices && prices.length >= 200) {
            return {
              id: crypto.id,
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

      // Small delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('Successfully fetched', results.length, 'coins with', errors.length, 'errors');

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'All coins processed',
        totalCoins: CRYPTO_IDS.length,
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
