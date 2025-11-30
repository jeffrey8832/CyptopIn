
import { GlobalData, CoinDetail, MarketChartResponse, ChartDataPoint, NewsItem, FearGreedData, Language } from '../types';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// API Key Storage
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
        if (err.message === "NOT_FOUND") throw err; 
        
        const isNetworkError = err.name === 'TypeError' || err.message === 'Failed to fetch';
        const isRateLimit = err.message === "RATE_LIMIT";

        if (i === retries - 1 || (!isRateLimit && !isNetworkError)) {
          throw err;
        }

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
  'btc': 'bitcoin', 'bitcoin': 'bitcoin',
  'eth': 'ethereum', 'ethereum': 'ethereum',
  'sol': 'solana', 'solana': 'solana',
  'bnb': 'binancecoin', 'binancecoin': 'binancecoin',
  'xrp': 'ripple', 'ripple': 'ripple',
  'doge': 'dogecoin', 'dogecoin': 'dogecoin',
  'ada': 'cardano', 'cardano': 'cardano',
  'avax': 'avalanche-2', 'dot': 'polkadot', 'link': 'chainlink',
  'matic': 'matic-network', 'trx': 'tron', 'shib': 'shiba-inu',
  'ltc': 'litecoin', 'usdt': 'tether', 'usdc': 'usd-coin', 'pepe': 'pepe'
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
    const data = await fetchWithRetry(`${BASE_URL}/search?query=${encodeURIComponent(query)}`, 2, 1000, true);
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
    return await fetchWithRetry(`${BASE_URL}/global`, 3, 2000, true);
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
    3, 1000, true
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
      3, 1500, true
    );
    return Array.isArray(data) ? data : [];
  } catch (error) { return []; }
};

export const fetchTrendingCoins = async (category: string = 'all'): Promise<CoinDetail[]> => {
  try {
    const ids = CATEGORY_COINS[category] || CATEGORY_COINS['all'];
    return await fetchWithRetry(
      `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
      3, 1500, true
    );
  } catch (error) { return []; }
};

export const fetchCoinHistory = async (coinId: string, days: number = 7): Promise<ChartDataPoint[]> => {
  try {
    const data: MarketChartResponse = await fetchWithRetry(
      `${BASE_URL}/coins/${coinId.toLowerCase()}/market_chart?vs_currency=usd&days=${days}`,
      2, 2000, true
    );
    return data.prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (error) { return []; }
};

export const fetchNews = async (symbol: string, lang: Language = 'en'): Promise<NewsItem[]> => {
  try {
    const langParam = lang === 'zh' ? 'ZH' : 'EN';
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=${langParam}&categories=${symbol.toUpperCase()}`;
    const data = await fetchWithRetry(url, 1, 1000, true);
    
    if (data?.Data?.length > 0) {
      return data.Data.slice(0, 5).map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.body,
        author: item.source,
        created_at: item.published_on * 1000
      }));
    }
    return [];
  } catch (error) { return []; }
};

// --- Advanced Market News Fetcher ---

const RSS_JSON_PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

// Helper to normalize RSS items
const normalizeRSS = (item: any, source: string) => ({
    title: item.title,
    url: item.link,
    description: (item.description || item.content || '').replace(/<[^>]+>/g, '').slice(0, 180) + '...',
    author: source,
    created_at: new Date(item.pubDate).getTime(),
    imageurl: item.thumbnail || item.enclosure?.link || '' 
});

// Helper to fetch single RSS via JSON Proxy
const fetchRSS = async (rssUrl: string, sourceName: string) => {
    try {
        const res = await fetch(`${RSS_JSON_PROXY}${encodeURIComponent(rssUrl)}`);
        const data = await res.json();
        if (data.status === 'ok' && Array.isArray(data.items)) {
            return data.items.map((i: any) => normalizeRSS(i, sourceName));
        }
        return [];
    } catch (e) {
        return [];
    }
};

// Special Handler for BlockBeats using Raw Proxy + XML Parsing
// This bypasses CORS strictness of RSS2JSON for BlockBeats
const fetchBlockBeatsRaw = async (): Promise<NewsItem[]> => {
  try {
    // api.allorigins.win allows requesting raw content
    const targetUrl = 'https://rss.theblockbeats.info/rss';
    // Add cache buster
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&t=${Date.now()}`;
    
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Proxy fetch failed");
    
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    const items = Array.from(xml.querySelectorAll("item"));
    
    return items.map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        const descHtml = item.querySelector("description")?.textContent || "";
        const pubDate = item.querySelector("pubDate")?.textContent || "";
        
        // Try to extract image from various typical RSS locations
        let imageurl = "";
        const enclosure = item.querySelector("enclosure");
        if (enclosure) {
            imageurl = enclosure.getAttribute("url") || "";
        } else {
             const match = descHtml.match(/src="([^"]+)"/);
             if (match) imageurl = match[1];
        }

        const description = descHtml.replace(/<[^>]+>/g, "").trim().slice(0, 200) + "...";

        return {
            title,
            url: link,
            description,
            author: "BlockBeats",
            created_at: new Date(pubDate).getTime(),
            imageurl
        };
    });
  } catch (e) {
    console.warn("BlockBeats Raw RSS failed, falling back", e);
    return [];
  }
};

export const fetchMarketNews = async (lang: Language): Promise<{ flash: NewsItem[], articles: NewsItem[] }> => {
    const result = { flash: [] as NewsItem[], articles: [] as NewsItem[] };
    let allItems: NewsItem[] = [];

    // 1. Fetch Sources based on Language
    if (lang === 'zh') {
        // High Priority: BlockBeats via Raw Proxy
        const bbItems = await fetchBlockBeatsRaw();
        if (bbItems.length > 0) {
            allItems = [...allItems, ...bbItems];
        }

        // Secondary Sources
        const otherSources = [
           { name: "Foresight", url: "https://foresightnews.pro/feed" },
           { name: "PANews", url: "https://rss.panewslab.com/zh/tv/rss.xml" }
        ];
        const promises = otherSources.map(s => fetchRSS(s.url, s.name));
        const rssResults = await Promise.all(promises);
        rssResults.forEach(items => allItems.push(...items));
    } else {
        const sources = [
            { name: "CoinTelegraph", url: "https://cointelegraph.com/rss" },
            { name: "Decrypt", url: "https://decrypt.co/feed" }
        ];
        const promises = sources.map(s => fetchRSS(s.url, s.name));
        const rssResults = await Promise.all(promises);
        rssResults.forEach(items => allItems.push(...items));
    }

    // Sort by new first
    allItems.sort((a, b) => b.created_at - a.created_at);

    // 2. Fallback to CryptoCompare if RSS yielded little data
    if (allItems.length < 5) {
        try {
            const langParam = lang === 'zh' ? 'ZH' : 'EN';
            const ccUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=${langParam}`;
            const ccData = await fetchWithRetry(ccUrl, 1, 1000, true);
            if (ccData?.Data?.length > 0) {
                 const ccItems = ccData.Data.map((item: any) => ({
                    title: item.title,
                    url: item.url,
                    description: item.body,
                    author: item.source_info?.name || item.source,
                    created_at: item.published_on * 1000,
                    imageurl: item.imageurl
                }));
                allItems = [...allItems, ...ccItems];
                allItems.sort((a, b) => b.created_at - a.created_at);
            }
        } catch (e) { console.warn("CC fallback failed"); }
    }

    // 3. Emergency Fallback Data
    if (allItems.length === 0) {
        allItems = [
            {
                title: lang === 'zh' ? "系统提示: 实时新闻源暂时无法连接" : "System: Live news feed unavailable",
                url: "#",
                description: lang === 'zh' ? "由于网络限制或API速率，暂时无法获取最新新闻。请稍后刷新重试。" : "Unable to fetch live news due to network restrictions. Please refresh later.",
                author: "System",
                created_at: Date.now()
            },
            {
                title: "Bitcoin holds steady above support levels",
                url: "#",
                description: "Market analysis indicates strong support for BTC...",
                author: "Demo Feed",
                created_at: Date.now() - 3600000
            }
        ];
    }

    // Deduplicate
    const seen = new Set();
    const uniqueItems = allItems.filter(el => {
        const duplicate = seen.has(el.title);
        seen.add(el.title);
        return !duplicate;
    });

    // Split
    result.flash = uniqueItems.slice(0, 20);
    result.articles = uniqueItems.filter(i => i.imageurl).slice(0, 20);
    
    if (result.articles.length < 5) {
        // Fill with text-only if needed to have some cards
        const usedTitles = new Set(result.articles.map(a => a.title));
        const remaining = uniqueItems.filter(i => !usedTitles.has(i.title));
        result.articles = [...result.articles, ...remaining].slice(0, 20);
    }

    return result;
}
