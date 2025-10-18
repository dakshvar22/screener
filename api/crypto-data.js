// api/crypto-data.js
// Vercel Serverless Function to fetch crypto data

const CRYPTO_IDS = [
  { id: 'bitcoin', name: 'Bitcoin' },
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'binancecoin', name: 'BNB' },
  { id: 'solana', name: 'Solana' },
  { id: 'ripple', name: 'XRP' }
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
    // Test with just one coin first
    const testCrypto = CRYPTO_IDS[0]; // Bitcoin

    try {
      const now = Date.now();
      const candlesNeeded = timeframeConfig.aggregate ?
        timeframeConfig.candles * timeframeConfig.aggregate :
        timeframeConfig.candles;

      let startTime, endTime;
      if (timeframeConfig.interval === 'h1') {
        startTime = now - (candlesNeeded * 60 * 60 * 1000);
      } else {
        startTime = now - (candlesNeeded * 24 * 60 * 60 * 1000);
      }
      endTime = now;

      // Use CoinGecko API instead of CoinCap since CoinCap DNS is failing
      const days = Math.ceil(candlesNeeded / 24); // Convert candles to days
      const url = `https://api.coingecko.com/api/v3/coins/${testCrypto.id}/market_chart?vs_currency=usd&days=${days}&interval=hourly`;

      console.log('Fetching URL:', url);
      console.log('Days requested:', days);
      console.log('Candles needed:', candlesNeeded);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'crypto-screener/1.0'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', JSON.stringify([...response.headers.entries()]));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        errors.push(`${testCrypto.name}: HTTP ${response.status} - ${response.statusText} - ${errorText}`);
        return res.status(200).json({
          coins: [],
          errors: errors,
          debug: {
            url,
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText
          },
          timestamp: new Date().toISOString(),
          timeframe: timeframe
        });
      }

      const result = await response.json();
      console.log('Response data keys:', Object.keys(result));
      console.log('Prices array length:', result.prices?.length || 0);

      if (!result.prices || result.prices.length === 0) {
        errors.push(`${testCrypto.name}: No price data returned`);
        return res.status(200).json({
          coins: [],
          errors: errors,
          debug: {
            url,
            responseKeys: Object.keys(result),
            pricesLength: result.prices?.length || 0
          },
          timestamp: new Date().toISOString(),
          timeframe: timeframe
        });
      }

      // Convert CoinGecko format [timestamp, price] - already in correct format
      let prices = result.prices;

      // Aggregate to 4H if needed
      if (timeframeConfig.aggregate) {
        prices = aggregateCandles(prices, timeframeConfig.aggregate);
      }

      console.log('Final prices length:', prices.length);

      if (prices && prices.length >= 200) { // Lowered threshold for testing
        results.push({
          id: testCrypto.id,
          name: testCrypto.name,
          prices: prices
        });
      } else {
        errors.push(`${testCrypto.name}: Not enough data (${prices?.length || 0} candles)`);
      }

    } catch (err) {
      console.error('Fetch error:', err);
      errors.push(`${testCrypto.name}: ${err.message}`);
    }

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'Single coin test mode',
        coinTested: testCrypto.name,
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
