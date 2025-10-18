import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowDown, ArrowUp } from 'lucide-react';

const CryptoScreener = () => {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [fetchErrors, setFetchErrors] = useState([]);
  const [filters, setFilters] = useState({
    minGapPercent: 10,
    minRoomPercent: 5,
    showOnlyGapFills: false,
    gapFillType: 'all',
    trendStatus: 'all',
    timeframe: '4h'
  });

  const TIMEFRAMES = [
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' },
    { value: '1d', label: '1D' }
  ];

  const calculateEMA = (data, period) => {
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  };

  const calculateSMA = (data, period) => {
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  };

  const analyzeCoin = (prices) => {
    if (!prices || prices.length < 300) return null;

    const closes = prices.map(p => p[1]);
    const currentPrice = closes[closes.length - 1];

    const ma100 = calculateSMA(closes, 100);
    const ema200 = calculateEMA(closes, 200);
    const ma300 = calculateSMA(closes, 300);

    const gapToMA100 = ((currentPrice - ma100) / ma100) * 100;
    const gapToEMA200 = ((currentPrice - ema200) / ema200) * 100;
    const gapToMA300 = ((currentPrice - ma300) / ma300) * 100;

    const aboveMA100 = currentPrice > ma100;
    const aboveEMA200 = currentPrice > ema200;
    const aboveMA300 = currentPrice > ma300;

    let trendStatus = 'neutral';
    if (aboveMA100 && aboveEMA200 && aboveMA300) trendStatus = 'bullish';
    else if (!aboveMA100 && !aboveEMA200 && !aboveMA300) trendStatus = 'bearish';
    else trendStatus = 'mixed';

    return {
      currentPrice,
      ma100,
      ema200,
      ma300,
      gapToMA100,
      gapToEMA200,
      gapToMA300,
      trendStatus
    };
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchErrors([]);

    try {
      console.log('Calling API endpoint...');
      const apiUrl = `/api/crypto-data?timeframe=${filters.timeframe}`;
      console.log('API URL:', apiUrl);

      // Call our serverless API endpoint
      const response = await fetch(apiUrl);

      console.log('Response received:', response.status, response.statusText);
      console.log('Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`API error: ${response.status} - ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API response data:', data);

      if (data.error) {
        setFetchErrors([data.error]);
        setCoins([]);
        return;
      }

      // Analyze each coin
      const analyzed = data.coins
        .map(coin => {
          const analysis = analyzeCoin(coin.prices);
          if (analysis) {
            return {
              id: coin.id,
              name: coin.name,
              ...analysis
            };
          }
          return null;
        })
        .filter(c => c !== null);

      setCoins(analyzed);
      setFetchErrors(data.errors || []);
      setLastUpdate(new Date());

      if (debugMode) {
        console.log('Fetched coins:', analyzed.length);
        console.log('Errors:', data.errors);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error stack:', error.stack);
      console.error('Error type:', error.constructor.name);
      setFetchErrors([`Failed to fetch: ${error.message} (${error.constructor.name})`]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filters.timeframe]);

  const calculateGapFills = (coin) => {
    const minGap = filters.minGapPercent;
    const minRoom = filters.minRoomPercent;

    const gapFillLong = coin.currentPrice < coin.ma100 &&
                        coin.currentPrice < coin.ema200 &&
                        coin.currentPrice < coin.ma300 &&
                        (Math.abs(coin.gapToMA100) > minGap || Math.abs(coin.gapToEMA200) > minGap) &&
                        Math.abs(coin.gapToEMA200) > minRoom;

    const gapFillShort = coin.currentPrice > coin.ma100 &&
                         coin.currentPrice > coin.ema200 &&
                         coin.currentPrice > coin.ma300 &&
                         (coin.gapToMA100 > minGap || coin.gapToEMA200 > minGap) &&
                         coin.gapToEMA200 > minRoom;

    return { gapFillLong, gapFillShort, hasGapFill: gapFillLong || gapFillShort };
  };

  const filteredCoins = coins.map(coin => ({
    ...coin,
    ...calculateGapFills(coin)
  })).filter(coin => {
    if (filters.showOnlyGapFills && !coin.hasGapFill) {
      return false;
    }

    if (filters.gapFillType === 'long' && !coin.gapFillLong) {
      return false;
    }

    if (filters.gapFillType === 'short' && !coin.gapFillShort) {
      return false;
    }

    if (filters.trendStatus !== 'all' && coin.trendStatus !== filters.trendStatus) {
      return false;
    }

    return true;
  });

  const sortedCoins = [...filteredCoins].sort((a, b) => {
    const aMaxGap = Math.max(Math.abs(a.gapToMA100), Math.abs(a.gapToEMA200), Math.abs(a.gapToMA300));
    const bMaxGap = Math.max(Math.abs(b.gapToMA100), Math.abs(b.gapToEMA200), Math.abs(b.gapToMA300));
    return bMaxGap - aMaxGap;
  });

  const displayCoins = debugMode ? coins.map(coin => ({
    ...coin,
    ...calculateGapFills(coin)
  })).sort((a, b) => {
    const aMaxGap = Math.max(Math.abs(a.gapToMA100), Math.abs(a.gapToEMA200), Math.abs(a.gapToMA300));
    const bMaxGap = Math.max(Math.abs(b.gapToMA100), Math.abs(b.gapToEMA200), Math.abs(b.gapToMA300));
    return bMaxGap - aMaxGap;
  }) : sortedCoins;

  const getTrendIcon = (status) => {
    if (status === 'bullish') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (status === 'bearish') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Crypto Gap Fill Screener</h1>
          <p className="text-gray-400">Based on Pierre's Gap Fill Strategy • Serverless Backend</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Filters</h2>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Timeframe</label>
              <select
                value={filters.timeframe}
                onChange={(e) => setFilters({...filters, timeframe: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Min Gap (%)</label>
              <input
                type="number"
                value={filters.minGapPercent}
                onChange={(e) => setFilters({...filters, minGapPercent: parseFloat(e.target.value)})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                step="1"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Min Room (%)</label>
              <input
                type="number"
                value={filters.minRoomPercent}
                onChange={(e) => setFilters({...filters, minRoomPercent: parseFloat(e.target.value)})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                step="0.5"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Gap Fill Type</label>
              <select
                value={filters.gapFillType}
                onChange={(e) => setFilters({...filters, gapFillType: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="long">Long Only</option>
                <option value="short">Short Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Trend Status</label>
              <select
                value={filters.trendStatus}
                onChange={(e) => setFilters({...filters, trendStatus: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="bullish">Bullish</option>
                <option value="bearish">Bearish</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showOnlyGapFills}
                  onChange={(e) => setFilters({...filters, showOnlyGapFills: e.target.checked})}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Only Gap Fills</span>
              </label>
            </div>
          </div>

          {lastUpdate && (
            <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
              <p className="text-gray-500">Last updated: {lastUpdate.toLocaleTimeString()}</p>
              <span className="text-blue-400">Timeframe: {TIMEFRAMES.find(tf => tf.value === filters.timeframe)?.label}</span>
              <span className="text-purple-400">{coins.length} coins loaded</span>
              <span className="text-green-400">{filteredCoins.length} matching filters</span>
              {fetchErrors.length > 0 && (
                <span className="text-red-400">{fetchErrors.length} errors</span>
              )}
              <button
                onClick={() => setDebugMode(!debugMode)}
                className="text-yellow-400 hover:text-yellow-300 underline"
              >
                {debugMode ? 'Hide' : 'Show'} Debug Info
              </button>
            </div>
          )}

          {debugMode && fetchErrors.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500 rounded text-xs">
              <strong className="text-red-400">Fetch Errors:</strong>
              <div className="mt-2 max-h-40 overflow-y-auto">
                {fetchErrors.map((err, i) => (
                  <div key={i} className="text-red-300">{err}</div>
                ))}
              </div>
            </div>
          )}

          {debugMode && coins.length > 0 && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500 rounded text-xs">
              <strong className="text-blue-400">Debug Info:</strong>
              <div className="mt-2 space-y-1">
                <div>Total coins fetched: {coins.length}</div>
                <div>Coins with gap fill long: {coins.filter(c => calculateGapFills(c).gapFillLong).length}</div>
                <div>Coins with gap fill short: {coins.filter(c => calculateGapFills(c).gapFillShort).length}</div>
                <div>Current filters: minGap={filters.minGapPercent}%, minRoom={filters.minRoomPercent}%</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-lg">Fetching data from serverless API...</p>
            <p className="text-sm text-gray-500 mt-2">This may take 10-20 seconds</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Coin</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-center">Trend</th>
                    <th className="px-4 py-3 text-right">Gap to 100MA</th>
                    <th className="px-4 py-3 text-right">Gap to 200EMA</th>
                    <th className="px-4 py-3 text-right">Gap to 300MA</th>
                    <th className="px-4 py-3 text-center">Setup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {displayCoins.map((coin) => {
                    return (
                      <tr key={coin.id} className={`hover:bg-gray-750 transition-colors ${
                        debugMode && !coin.hasGapFill ? 'opacity-50' : ''
                      }`}>
                        <td className="px-4 py-3 font-medium">{coin.name}</td>
                        <td className="px-4 py-3 text-right">
                          ${coin.currentPrice.toFixed(coin.currentPrice > 100 ? 2 : 4)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {getTrendIcon(coin.trendStatus)}
                            <span className="text-xs capitalize">{coin.trendStatus}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          coin.gapToMA100 > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {coin.gapToMA100 > 0 ? '+' : ''}{coin.gapToMA100.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          coin.gapToEMA200 > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {coin.gapToEMA200 > 0 ? '+' : ''}{coin.gapToEMA200.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          coin.gapToMA300 > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {coin.gapToMA300 > 0 ? '+' : ''}{coin.gapToMA300.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {coin.gapFillLong && (
                              <span className="bg-green-900 text-green-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                                <ArrowUp className="w-3 h-3" />
                                Gap Fill LONG
                              </span>
                            )}
                            {coin.gapFillShort && (
                              <span className="bg-red-900 text-red-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                                <ArrowDown className="w-3 h-3" />
                                Gap Fill SHORT
                              </span>
                            )}
                            {!coin.gapFillLong && !coin.gapFillShort && (
                              <span className="text-gray-500 text-xs">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {displayCoins.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                {coins.length === 0 ? (
                  <div>
                    <p className="text-lg mb-2">No data loaded</p>
                    <p className="text-sm">Click Refresh to fetch crypto data</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg mb-2">No coins match your filters</p>
                    <p className="text-sm">Try lowering the Min Gap % or Min Room %</p>
                    <button
                      onClick={() => setDebugMode(true)}
                      className="mt-3 text-yellow-400 hover:text-yellow-300 underline"
                    >
                      Show Debug Info
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          <h3 className="font-semibold text-white mb-2">Gap Fill Strategy Logic:</h3>
          <div className="space-y-2">
            <div className="border-l-4 border-green-500 pl-3">
              <strong className="text-green-400">Gap Fill LONG Setup:</strong>
              <ul className="mt-1 space-y-1 ml-4 list-disc">
                <li>Price is below ALL three MAs (100MA, 200EMA, 300MA)</li>
                <li>At least {filters.minGapPercent}%+ gap to 100MA or 200EMA (customizable)</li>
                <li>200 EMA is at least {filters.minRoomPercent}%+ above price (room to move up)</li>
                <li>Target: Reversion to 100MA/200EMA zone</li>
              </ul>
            </div>

            <div className="border-l-4 border-red-500 pl-3">
              <strong className="text-red-400">Gap Fill SHORT Setup:</strong>
              <ul className="mt-1 space-y-1 ml-4 list-disc">
                <li>Price is above ALL three MAs (100MA, 200EMA, 300MA)</li>
                <li>At least {filters.minGapPercent}%+ gap to 100MA or 200EMA (customizable)</li>
                <li>200 EMA is at least {filters.minRoomPercent}%+ below price (room to move down)</li>
                <li>Target: Reversion to 100MA/200EMA zone</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <p><strong className="text-yellow-400">Pierre's Rule:</strong> Don't take gap fill trades when the 200 EMA is too close - you need ROOM for the mean reversion move!</p>
              <p className="mt-2"><strong className="text-blue-400">Tip:</strong> Adjust "Min Gap" to find larger opportunities, and "Min Room" to ensure sufficient space for the move.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoScreener;
