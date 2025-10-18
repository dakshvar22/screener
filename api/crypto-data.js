// api/crypto-data.js
// Vercel Serverless Function to fetch crypto data using Alpha Vantage

const CRYPTO_SYMBOLS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'DOGE', name: 'Dogecoin' }
];

// Alpha Vantage API key
const API_KEY = 'JWP1USI7NXB04KOP';

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

  const { timeframe = '1d' } = req.query;

  // Alpha Vantage only provides daily data, so timeframe is informational only
  console.log('Requested timeframe:', timeframe, '(using daily data for all timeframes)');

  const results = [];
  const errors = [];

  console.log('Starting crypto data fetch using Alpha Vantage...');

  try {
    console.log('Processing', CRYPTO_SYMBOLS.length, 'symbols');

    // Process coins sequentially to avoid rate limits
    for (const crypto of CRYPTO_SYMBOLS) {
      try {
        // Alpha Vantage daily crypto endpoint
        const url = `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${crypto.symbol}&market=USD&apikey=${API_KEY}`;

        console.log('Fetching:', crypto.name);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'crypto-screener/1.0'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log('Error for', crypto.name, ':', response.status, errorText);
          errors.push(`${crypto.name}: HTTP ${response.status} - ${response.statusText}`);
          continue;
        }

        const result = await response.json();

        if (result.error || !result['Time Series (Digital Currency Daily)']) {
          errors.push(`${crypto.name}: ${result.error || 'No time series data'}`);
          continue;
        }

        // Convert Alpha Vantage format to [timestamp, price]
        const timeSeries = result['Time Series (Digital Currency Daily)'];
        const prices = Object.entries(timeSeries)
          .map(([date, data]) => [
            new Date(date).getTime(),
            parseFloat(data['4a. close (USD)'])
          ])
          .sort((a, b) => a[0] - b[0]); // Sort by timestamp

        // Take last 400 days to have enough data for 300-day MA
        const recentPrices = prices.slice(-400);

        if (recentPrices && recentPrices.length >= 300) {
          results.push({
            id: crypto.symbol,
            name: crypto.name,
            prices: recentPrices
          });
          console.log(`✓ ${crypto.name}: ${recentPrices.length} data points`);
        } else {
          errors.push(`${crypto.name}: Not enough data (${recentPrices?.length || 0} days)`);
        }

        // Rate limiting - Alpha Vantage free tier allows 5 calls per minute
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 second delay

      } catch (err) {
        console.error('Error for', crypto.name, ':', err);
        errors.push(`${crypto.name}: ${err.message}`);
      }
    }

    console.log('Successfully fetched', results.length, 'coins with', errors.length, 'errors');

    return res.status(200).json({
      coins: results,
      errors: errors,
      debug: {
        message: 'All coins processed via Alpha Vantage API',
        totalCoins: CRYPTO_SYMBOLS.length,
        successfulCoins: results.length,
        apiUsed: 'Alpha Vantage Daily Data'
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
