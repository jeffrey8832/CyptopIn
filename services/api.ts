
import { GlobalData, CoinDetail, MarketChartResponse, ChartDataPoint, NewsItem, FearGreedData, Language } from '../types';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// API Key Storage
// Initialize directly from localStorage if available to ensure persistence across reloads
let COINGECKO_API_KEY = '';
if (typeof window !== 'undefined') {
  try {
    COINGECKO_API_KEY = localStorage.getItem('coingecko_api_key') || '';
  } catch (e) {
    console.warn('LocalStorage access denied', e);
  }
}

export const setApiKey = (key: string) => {
  COINGECKO_API_KEY = key;
  // Also update localStorage here to keep them in sync via the service
  if (typeof window !== 'undefined') {
      try {
        if (key) {
            localStorage.setItem('coingecko_api_key', key);
        } else {
            localStorage.removeItem('coingecko_api_key');
        }
      } catch (e) {
        console.warn('LocalStorage write failed', e);
      }
  }
  cache.clear();
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 120 * 1000; 
const inflight = new Map<string, Promise<any>>();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, retries = 3, backoff = 1000, useCache = true): Promise<any> => {
  let authUrl = url;
  // If API Key is present, we can be faster.
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
    // If we have a key, reduce the initial backoff significantly
    const currentBackoff = hasKey ? 500 : backoff;

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
        if (err.message === "NOT_FOUND") throw err; // Don't retry 404s
        
        const isNetworkError = err.name === 'TypeError' || err.message === 'Failed to fetch';
        const isRateLimit = err.message === "RATE_LIMIT";

        if (i === retries - 1 || (!isRateLimit && !isNetworkError)) {
          throw err;
        }

        // If we have a key, wait less. If no key, wait longer to respect free tier.
        const baseDelay = hasKey ? currentBackoff : currentBackoff * 2;
        const delay = baseDelay * Math.pow(1.5, i) + (Math.random() * 200);
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
  'btc': 'bitcoin',
  'bitcoin': 'bitcoin',
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'sol': 'solana',
  'solana': 'solana',
  'bnb': 'binancecoin',
  'binancecoin': 'binancecoin',
  'xrp': 'ripple',
  'ripple': 'ripple',
  'doge': 'dogecoin',
  'dogecoin': 'dogecoin',
  'ada': 'cardano',
  'cardano': 'cardano',
  'avax': 'avalanche-2',
  'dot': 'polkadot',
  'link': 'chainlink',
  'matic': 'matic-network',
  'trx': 'tron',
  'shib': 'shiba-inu',
  'ltc': 'litecoin',
  'usdt': 'tether',
  'usdc': 'usd-coin',
  'pepe': 'pepe'
};

// Ecosystem Coin Lists
const CATEGORY_COINS: Record<string, string> = {
  'all': 'bitcoin,ethereum,binancecoin,solana',
  'eth': 'ethereum,shiba-inu,uniswap,pepe',
  'sol': 'solana,render-token,bonk,jupiter-exchange-solana',
  'bsc': 'binancecoin,pancakeswap-token,trust-wallet-token,cake-monster',
  'arb': 'arbitrum,chainlink,lido-dao,gmx'
};

export const findCoinId = async (query: string): Promise<string> => {
  const lowerQuery = query.toLowerCase().trim();
  if (COMMON_COINS[lowerQuery]) {
    return COMMON_COINS[lowerQuery];
  }
  try {
    const data = await fetchWithRetry(`${BASE_URL}/search?query=${encodeURIComponent(query)}`, 2, 1000, true);
    if (data.coins && data.coins.length > 0) {
      const sortedCoins = data.coins.sort((a: any, b: any) => {
        const rankA = a.market_cap_rank || 10000;
        const rankB = b.market_cap_rank || 10000;
        return rankA - rankB;
      });
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
    return await fetchWithRetry(`${BASE_URL}/global`, 3, 2000, true);
  } catch (error) {
    return {
      data: {
        total_market_cap: { usd: 0 },
        total_volume: { usd: 0 },
        market_cap_percentage: { btc: 0 }
      }
    };
  }
};

export const fetchFearAndGreed = async (): Promise<FearGreedData | null> => {
  try {
    const response = await fetchWithRetry('https://api.alternative.me/fng/?limit=1', 2, 1000, true);
    if (response && response.data && response.data.length > 0) {
      return response.data[0] as FearGreedData;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const fetchCoinData = async (coinId: string): Promise<CoinDetail> => {
  const data = await fetchWithRetry(
    `${BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId.toLowerCase()}&order=market_cap_desc&per_page=1&page=1&sparkline=false`,
    3, 1000, true
  );
  if (Array.isArray(data) && data.length > 0) {
    return data[0] as CoinDetail;
  } else {
    throw new Error("NOT_FOUND");
  }
};

export const fetchCoinsMarketData = async (ids: string[]): Promise<CoinDetail[]> => {
  if (ids.length === 0) return [];
  try {
    const idString = ids.slice(0, 50).join(',');
    const data = await fetchWithRetry(
      `${BASE_URL}/coins/markets?vs_currency=usd&ids=${idString}&order=market_cap_desc&per_page=50&page=1&sparkline=false`,
      3, 1500, true
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

// Updated to support Categories
export const fetchTrendingCoins = async (category: string = 'all'): Promise<CoinDetail[]> => {
  try {
    const ids = CATEGORY_COINS[category] || CATEGORY_COINS['all'];
    const data = await fetchWithRetry(
      `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
      3, 1500, true
    );
    return data;
  } catch (error) {
    console.error("Failed to fetch trending coins", error);
    return [];
  }
};

export const fetchCoinHistory = async (coinId: string, days: number = 7): Promise<ChartDataPoint[]> => {
  try {
    const data: MarketChartResponse = await fetchWithRetry(
      `${BASE_URL}/coins/${coinId.toLowerCase()}/market_chart?vs_currency=usd&days=${days}`,
      2, 2000, true
    );
    return data.prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (error) {
    return []; 
  }
};

export const fetchNews = async (symbol: string, lang: Language = 'en'): Promise<NewsItem[]> => {
  try {
    const safeSymbol = symbol.toUpperCase();
    const langParam = lang === 'zh' ? 'ZH' : 'EN';
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=${langParam}&categories=${safeSymbol}`;
    // Limit retries for news as it's secondary
    const data = await fetchWithRetry(url, 1, 1000, true);
    
    if (data && data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
      return data.Data.slice(0, 5).map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.body,
        author: item.source,
        created_at: item.published_on * 1000
      }));
    }
    if (lang === 'zh') {
        const fallbackUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${safeSymbol}`;
        const fallbackData = await fetchWithRetry(fallbackUrl, 1, 1000, true);
        if (fallbackData && fallbackData.Data && Array.isArray(fallbackData.Data)) {
            return fallbackData.Data.slice(0, 5).map((item: any) => ({
                title: item.title,
                url: item.url,
                description: item.body,
                author: item.source,
                created_at: item.published_on * 1000
            }));
        }
    }
    throw new Error("No news found");
  } catch (error) {
    return [
      {
        title: `${symbol} Market Updates - Google News`,
        url: `https://www.google.com/search?q=${symbol}+crypto+news&tbm=nws`,
        description: `Click to view the latest aggregated news stories for ${symbol} on Google News.`,
        author: "Google News",
        created_at: Date.now()
      },
      {
        title: `${symbol} Community Discussion`,
        url: `https://twitter.com/search?q=%24${symbol}&src=typed_query`,
        description: `See what the community is saying about $${symbol} on X (Twitter).`,
        author: "X (Twitter)",
        created_at: Date.now()
      },
      {
        title: `${symbol} Price & Analysis`,
        url: `https://www.coingecko.com/en/coins/${symbol.toLowerCase()}`,
        description: "Deep dive into on-chain data and price action on CoinGecko.",
        author: "CoinGecko",
        created_at: Date.now()
      }
    ];
  }
};