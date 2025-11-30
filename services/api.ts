
import { GlobalData, CoinDetail, MarketChartResponse, ChartDataPoint, NewsItem, FearGreedData, Language, OnChainData } from '../types';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Integrated API Key (Hidden from UI)
const COINGECKO_API_KEY = 'CG-Aie3gThzRVom6f1PPUXoq5R1';

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 120 * 1000; 
const inflight = new Map<string, Promise<any>>();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, retries = 3, backoff = 1000, useCache = true): Promise<any> => {
  let authUrl = url;
  const hasKey = !!COINGECKO_API_KEY;
  
  if (hasKey && url.includes('coingecko.com')) {
    const separator = url.includes('?') ? '&' : '?';
    authUrl = `${url}${separator}x_cg_demo_api_key=${COINGECKO_API_KEY}`;
  }

  if (useCache) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  if (inflight.has(url)) {
    return inflight.get(url);
  }

  const fetchPromise = (async () => {
    // Aggressive retry strategy since we have a key
    const currentBackoff = hasKey ? 200 : backoff;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(authUrl);
        
        if (response.status === 429) {
          throw new Error("RATE_LIMIT");
        }
        
        if (!response.ok) {
          if (response.status === 404) throw new Error("NOT_FOUND");
          throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (useCache) {
          cache.set(url, { data, timestamp: Date.now() });
        }

        return data;
      } catch (err: any) {
        if (err.message === "NOT_FOUND") throw err; 
        
        const isNetworkError = err.name === 'TypeError' || err.message === 'Failed to fetch';
        const isRateLimit = err.message === "RATE_LIMIT";

        if (i === retries - 1 || (!isRateLimit && !isNetworkError)) {
          throw err;
        }

        const baseDelay = hasKey ? currentBackoff : currentBackoff * 2;
        const delay = baseDelay * Math.pow(1.5, i) + (Math.random() * 100);
        await wait(delay);
      }
    }
    throw new Error("Max retries exceeded");
  })();

  inflight.set(url, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inflight.delete(url);
  }
};

const COMMON_COINS: Record<string, string> = {
  'btc': 'bitcoin', 'bitcoin': 'bitcoin',
  'eth': 'ethereum', 'ethereum': 'ethereum',
  'sol': 'solana', 'solana': 'solana',
  'bnb': 'binancecoin', 'binancecoin': 'binancecoin',
  'xrp': 'ripple', 'ripple': 'ripple',
  'doge': 'dogecoin', 'dogecoin': 'dogecoin',
  'ada': 'cardano', 'cardano': 'cardano',
  'avax': 'avalanche-2', 'dot': 'polkadot', 'link': 'chainlink',
  'matic': 'matic-network', 'trx': 'tron', 'shib': 'shiba-inu',
  'ltc': 'litecoin', 'usdt': 'tether', 'usdc': 'usd-coin', 'pepe': 'pepe',
  'uni': 'uniswap', 'aave': 'aave', 'dai': 'dai', 'wbtc': 'wrapped-bitcoin'
};

const CATEGORY_COINS: Record<string, string> = {
  'all': 'bitcoin,ethereum,binancecoin,solana',
  'eth': 'ethereum,shiba-inu,uniswap,pepe',
  'sol': 'solana,render-token,bonk,jupiter-exchange-solana',
  'bsc': 'binancecoin,pancakeswap-token,trust-wallet-token,cake-monster',
  'arb': 'arbitrum,chainlink,lido-dao,gmx'
};

export const findCoinId = async (query: string): Promise<string> => {
  const lowerQuery = query.toLowerCase().trim();
  if (COMMON_COINS[lowerQuery]) return COMMON_COINS[lowerQuery];
  try {
    const data = await fetchWithRetry(`${BASE_URL}/search?query=${encodeURIComponent(query)}`, 2, 500, true);
    if (data.coins && data.coins.length > 0) {
      const sortedCoins = data.coins.sort((a: any, b: any) => (a.market_cap_rank || 10000) - (b.market_cap_rank || 10000));
      const exactSymbol = sortedCoins.find((c: any) => c.symbol.toLowerCase() === lowerQuery);
      if (exactSymbol) return exactSymbol.id;
      const exactName = sortedCoins.find((c: any) => c.name.toLowerCase() === lowerQuery);
      if (exactName) return exactName.id;
      return sortedCoins[0].id;
    }
    return lowerQuery;
  } catch (error) {
    return lowerQuery;
  }
};

export const fetchGlobalData = async (): Promise<GlobalData> => {
  try {
    return await fetchWithRetry(`${BASE_URL}/global`, 3, 1000, true);
  } catch (error) {
    return { data: { total_market_cap: { usd: 0 }, total_volume: { usd: 0 }, market_cap_percentage: { btc: 0 } } };
  }
};

export const fetchFearAndGreed = async (): Promise<FearGreedData | null> => {
  try {
    const response = await fetchWithRetry('https://api.alternative.me/fng/?limit=1', 2, 1000, true);
    return (response && response.data && response.data.length > 0) ? response.data[0] : null;
  } catch (error) { return null; }
};

export const fetchCoinData = async (coinId: string): Promise<CoinDetail> => {
  const data = await fetchWithRetry(
    `${BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId.toLowerCase()}&order=market_cap_desc&per_page=1&page=1&sparkline=false`,
    3, 500, true
  );
  if (Array.isArray(data) && data.length > 0) return data[0];
  throw new Error("NOT_FOUND");
};

export const fetchCoinsMarketData = async (ids: string[]): Promise<CoinDetail[]> => {
  if (ids.length === 0) return [];
  try {
    const idString = ids.slice(0, 50).join(',');
    const data = await fetchWithRetry(
      `${BASE_URL}/coins/markets?vs_currency=usd&ids=${idString}&order=market_cap_desc&per_page=50&page=1&sparkline=false`,
      3, 1000, true
    );
    return Array.isArray(data) ? data : [];
  } catch (error) { return []; }
};

export const fetchTrendingCoins = async (category: string = 'all'): Promise<CoinDetail[]> => {
  try {
    const ids = CATEGORY_COINS[category] || CATEGORY_COINS['all'];
    return await fetchWithRetry(
      `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
      3, 1000, true
    );
  } catch (error) { return []; }
};

export const fetchCoinHistory = async (coinId: string, days: number = 7): Promise<ChartDataPoint[]> => {
  try {
    const data: MarketChartResponse = await fetchWithRetry(
      `${BASE_URL}/coins/${coinId.toLowerCase()}/market_chart?vs_currency=usd&days=${days}`,
      2, 1000, true
    );
    return data.prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (error) { return []; }
};

// Returns a simple list of { symbol: string, balance: number }
export const fetchEVMAssets = async (address: string): Promise<{symbol: string, balance: number}[]> => {
  try {
    // Using Ethplorer free API (Key: freekey)
    const url = `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`;
    const response = await fetchWithRetry(url, 2, 1000, false); // Don't use CoinGecko cache logic
    
    const assets: {symbol: string, balance: number}[] = [];
    
    // ETH Balance
    if (response.ETH && response.ETH.balance > 0) {
      assets.push({ symbol: 'ETH', balance: response.ETH.balance });
    }

    // Tokens
    if (response.tokens && Array.isArray(response.tokens)) {
      response.tokens.forEach((t: any) => {
        if (t.tokenInfo && t.tokenInfo.symbol && t.balance > 0) {
          const decimals = parseInt(t.tokenInfo.decimals) || 18;
          // Note: Ethplorer returns balance as integer string (e.g. 1000000000000000000)
          const rawBalance = parseFloat(t.balance); // Ethplorer actually returns exact number in balance for ETH, but for tokens it can be raw.
          // Wait, Ethplorer `balance` field in `tokens` array is RAW.
          const balance = rawBalance / Math.pow(10, decimals);
          
          // Filter dust
          if (balance > 0.00001) {
            assets.push({ symbol: t.tokenInfo.symbol.toLowerCase(), balance });
          }
        }
      });
    }
    return assets;
  } catch (error) {
    console.error("Failed to fetch EVM assets", error);
    return [];
  }
};

export const fetchNews = async (coinSymbol: string, lang: Language = 'en'): Promise<NewsItem[]> => {
    return [];
};

export const fetchOnChainData = (coin: CoinDetail): OnChainData => {
  // Simulates On-Chain data based on available market metrics
  
  // 1. Unlocks
  const circ = coin.circulating_supply || 0;
  const total = coin.total_supply || coin.max_supply || circ;
  const unlockProgress = total > 0 ? (circ / total) * 100 : 100;
  
  // 2. Whale Activity (Turnover Ratio)
  // High Volume / Market Cap ratio suggests high activity (whales or high frequency)
  const turnover = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0;
  let whaleActivity: 'Low' | 'Medium' | 'High' | 'Very High' = 'Low';
  let whaleScore = 20;
  
  if (turnover > 0.3) { whaleActivity = 'Very High'; whaleScore = 95; }
  else if (turnover > 0.15) { whaleActivity = 'High'; whaleScore = 75; }
  else if (turnover > 0.05) { whaleActivity = 'Medium'; whaleScore = 50; }
  
  // 3. Net Flow (Simulated via Price Momentum & Volume)
  const isUp = coin.price_change_percentage_24h > 0;
  const isStrong = Math.abs(coin.price_change_percentage_24h) > 5;
  let netFlowScore = 0;
  
  if (isUp && isStrong) netFlowScore = 80 + Math.random() * 20;
  else if (isUp) netFlowScore = 20 + Math.random() * 30;
  else if (!isUp && isStrong) netFlowScore = -80 - Math.random() * 20;
  else netFlowScore = -20 - Math.random() * 30;
  
  return {
    unlockProgress,
    lockedPercent: 100 - unlockProgress,
    whaleActivity,
    whaleScore,
    netFlowStatus: netFlowScore > 0 ? 'Inflow' : netFlowScore < 0 ? 'Outflow' : 'Neutral',
    netFlowScore,
    holders: Math.floor(coin.market_cap / 5000) + 1000, // Rough heuristic
    fdvGap: coin.fully_diluted_valuation && coin.market_cap ? coin.fully_diluted_valuation / coin.market_cap : 1
  };
};
