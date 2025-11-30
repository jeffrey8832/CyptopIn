
import React, { useState, useEffect, useCallback } from 'react';
import { fetchGlobalData, fetchCoinData, fetchCoinHistory, fetchNews, findCoinId, fetchTrendingCoins, setApiKey, fetchFearAndGreed, fetchCoinsMarketData, fetchMarketNews } from './services/api';
import { GlobalData, CoinDetail, ChartDataPoint, NewsItem, Language, FearGreedData, IndicatorMetric, TechnicalAnalysis, Category } from './types';
import { analyzeToken } from './utils/indicators';
import { translations } from './utils/translations';
import PriceChart from './components/PriceChart';
import { 
  Search, Activity, PieChart, ArrowUpRight, ArrowDownRight, AlertCircle, Loader2, 
  Coins, Zap, Target, BarChart2, Newspaper, BrainCircuit, Lightbulb, Copy, Check, Globe,
  Settings, Save, Gauge, Star, TrendingUp, Droplets, Layers, ChevronRight, BarChart, Smartphone, Link, Sun, Moon, RefreshCw, Calculator, Clock, ImageOff
} from 'lucide-react';

type ViewMode = 'dashboard' | 'analysis' | 'news';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const t = translations[lang];

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
        const stored = localStorage.getItem('theme');
        return (stored === 'light') ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
  });

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  
  // Initialize from localStorage directly
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    try {
      return localStorage.getItem('coingecko_api_key') || '';
    } catch {
      return '';
    }
  });
  const [saveStatus, setSaveStatus] = useState(false);
  
  // Favorites State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [watchlistData, setWatchlistData] = useState<CoinDetail[]>([]);
  
  // Global & Trending State
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [trendingCoins, setTrendingCoins] = useState<CoinDetail[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Coin State
  const [searchQuery, setSearchQuery] = useState<string>('bitcoin');
  const [currentCoin, setCurrentCoin] = useState<CoinDetail | null>(null);
  const [coinHistory, setCoinHistory] = useState<ChartDataPoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);

  // Market News State
  const [marketNews, setMarketNews] = useState<{flash: any[], articles: any[]}>({flash: [], articles: []});
  
  // Separate loading states for better UX
  const [loadingBasic, setLoadingBasic] = useState<boolean>(false);
  const [loadingDeep, setLoadingDeep] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Determine current URL for QR Code
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Initialize Data
  useEffect(() => {
    const storedKey = localStorage.getItem('coingecko_api_key');
    if (storedKey) {
       setApiKey(storedKey);
    }

    const initData = async () => {
      try {
        setLoadingGlobal(true);
        const [gData, tCoins, fgData] = await Promise.all([
          fetchGlobalData(),
          fetchTrendingCoins('all'),
          fetchFearAndGreed()
        ]);
        setGlobalData(gData);
        if (activeCategory === 'all') {
            setTrendingCoins(tCoins);
        }
        setFearGreed(fgData);
      } catch (err) {
        console.error("Init data fetch failed", err);
      } finally {
        setLoadingGlobal(false);
      }
    };
    initData();
    // Preload Bitcoin so Analysis isn't empty on first switch
    loadSpecificCoin('bitcoin', false); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Watchlist
  useEffect(() => {
    if (favorites.length > 0) {
      fetchCoinsMarketData(favorites).then(data => {
        setWatchlistData(data);
        // If current category is Favorites, update trending list immediately
        if (activeCategory === 'fav') {
            setTrendingCoins(data);
        }
      });
    } else {
      setWatchlistData([]);
      if (activeCategory === 'fav') {
          setTrendingCoins([]);
      }
    }
  }, [favorites, activeCategory]);

  // Handle Category Change
  const handleCategoryChange = async (cat: Category) => {
    setActiveCategory(cat);
    // If selecting Favorites
    if (cat === 'fav') {
        setTrendingCoins(watchlistData);
        return;
    }
    // Otherwise fetch API
    setTrendingCoins([]); // clear temporarily
    const coins = await fetchTrendingCoins(cat);
    setTrendingCoins(coins);
  };

  // Re-fetch news on lang change or view change
  useEffect(() => {
    if (viewMode === 'news') {
        setLoadingDeep(true);
        fetchMarketNews(lang).then(data => {
            setMarketNews(data);
            setLoadingDeep(false);
        });
    } else if (currentCoin) {
      fetchNews(currentCoin.symbol, lang).then(setNews);
    }
  }, [lang, currentCoin, viewMode]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Always refresh global data
      const [gData, fgData] = await Promise.all([
        fetchGlobalData(),
        fetchFearAndGreed()
      ]);
      setGlobalData(gData);
      setFearGreed(fgData);

      if (viewMode === 'dashboard') {
        // Refresh list
        if (activeCategory === 'fav') {
           // Refresh favorites specifically
           if (favorites.length > 0) {
             const data = await fetchCoinsMarketData(favorites);
             setWatchlistData(data);
             setTrendingCoins(data);
           }
        } else {
           const coins = await fetchTrendingCoins(activeCategory);
           setTrendingCoins(coins);
        }
      } else if (viewMode === 'analysis' && currentCoin) {
        // Refresh specific coin
        await loadSpecificCoin(currentCoin.id, false); 
      } else if (viewMode === 'news') {
          const data = await fetchMarketNews(lang);
          setMarketNews(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveSettings = () => {
    const key = apiKeyInput.trim();
    setApiKey(key); 
    setSaveStatus(true);
    setTimeout(() => {
      setSaveStatus(false);
      setShowSettings(false);
    }, 1000);
  };

  const toggleFavorite = (coinId: string) => {
    const isFav = favorites.includes(coinId);
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(id => id !== coinId);
    } else {
      newFavs = [...favorites, coinId];
    }
    setFavorites(newFavs);
    try {
      localStorage.setItem('favorites', JSON.stringify(newFavs));
    } catch (e) {
      console.warn("Failed to save favorites to localStorage", e);
    }
  };

  const loadSpecificCoin = async (id: string, switchToAnalysis: boolean = true) => {
    setLoadingBasic(true);
    setLoadingDeep(true); 
    setError(null);
    setAnalysis(null);

    if (switchToAnalysis) {
      setViewMode('analysis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const coinData = await fetchCoinData(id);
      setCurrentCoin(coinData);
      setLoadingBasic(false); 

      const [historyData, newsData] = await Promise.all([
        fetchCoinHistory(id),
        fetchNews(coinData.symbol, lang)
      ]);
      
      setCoinHistory(historyData);
      setNews(newsData);
      
      if (coinData) {
        const result = analyzeToken(historyData, coinData.current_price);
        setAnalysis(result);
      }
    } catch (err: any) {
      console.error(err);
      setError(t.errorGeneric);
    } finally {
      setLoadingBasic(false);
      setLoadingDeep(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoadingBasic(true);
    setLoadingDeep(true);
    setError(null);
    setAnalysis(null);
    setViewMode('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const resolvedId = await findCoinId(query);
      const coinData = await fetchCoinData(resolvedId);
      setCurrentCoin(coinData);
      setLoadingBasic(false); 

      const [historyData, newsData] = await Promise.all([
        fetchCoinHistory(resolvedId),
        fetchNews(coinData.symbol, lang)
      ]);
      
      setCoinHistory(historyData);
      setNews(newsData);
      
      if (coinData) {
        const result = analyzeToken(historyData, coinData.current_price);
        setAnalysis(result);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message === "NOT_FOUND" ? t.errorNotFound : t.errorGeneric);
    } finally {
      setLoadingBasic(false);
      setLoadingDeep(false);
    }
  }, [t, lang]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const onMarketLeaderClick = (coinId: string) => {
    setSearchQuery(coinId);
    loadSpecificCoin(coinId, true);
  };

  const formatCurrency = (val: number) => {
    if (!val) return '$0';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const formatPrice = (val: number) => {
    if (!val) return '$0';
    if (val < 0.00001) return `$${val.toFixed(9)}`;
    if (val < 0.01) return `$${val.toFixed(6)}`;
    if (val < 1) return `$${val.toFixed(4)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFearGreedColor = (value: number) => {
    if (value >= 75) return 'text-emerald-500';
    if (value >= 55) return 'text-emerald-400';
    if (value >= 45) return 'text-slate-400 dark:text-slate-400 text-slate-500';
    if (value >= 25) return 'text-orange-400';
    return 'text-rose-500';
  };
  
  const getFearGreedLabel = (value: number) => {
    if (value >= 75) return t.extremeGreed;
    if (value >= 55) return t.greed;
    if (value >= 45) return t.neutral;
    if (value >= 25) return t.fear;
    return t.extremeFear;
  };

  const copyReport = () => {
    if (!currentCoin || !analysis) return;
    const text = `⚡️ ${currentCoin.name} (${currentCoin.symbol.toUpperCase()}) Analysis\nPrice: ${formatPrice(currentCoin.current_price)}\nTrend: ${analysis.trend.status}\nAdvice: ${analysis.advice}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'zh' : 'en');
  };

  // Component: Profit Calculator
  const ProfitCalculator: React.FC<{ currentPrice: number, targetPrice?: string }> = ({ currentPrice, targetPrice }) => {
    const [principal, setPrincipal] = useState<string>('1000');
    const [buyPrice, setBuyPrice] = useState<string>(currentPrice.toString());
    const [sellPrice, setSellPrice] = useState<string>('');

    useEffect(() => {
        if (currentPrice) setBuyPrice(currentPrice.toString());
    }, [currentPrice]);

    const p = parseFloat(principal) || 0;
    const b = parseFloat(buyPrice) || 0;
    const s = parseFloat(sellPrice) || 0;

    let profit = 0;
    let roi = 0;
    let totalValue = 0;

    if (b > 0 && p > 0) {
        const amount = p / b;
        totalValue = amount * (s > 0 ? s : b); 
        if (s > 0) {
            profit = totalValue - p;
            roi = (profit / p) * 100;
        }
    }

    const useCurrent = () => setBuyPrice(currentPrice.toString());
    const useTarget = () => {
        if (targetPrice) {
            const clean = targetPrice.replace(/[^0-9.]/g, '');
            setSellPrice(clean);
        }
    };

    return (
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
             
             <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2 relative z-10">
                 <Calculator className="w-5 h-5" /> {t.calcTitle}
             </h3>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                 <div className="space-y-4 md:col-span-1">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.calcPrincipal}</label>
                         <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" />
                     </div>
                     <div>
                         <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-bold text-slate-500 uppercase">{t.calcBuyPrice}</label>
                             <button onClick={useCurrent} className="text-[10px] text-indigo-500 hover:text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{t.calcUseCurrent}</button>
                         </div>
                         <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" />
                     </div>
                     <div>
                         <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-bold text-slate-500 uppercase">{t.calcSellPrice}</label>
                             <button onClick={useTarget} className="text-[10px] text-emerald-500 hover:text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{t.calcUseTarget}</button>
                         </div>
                         <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" />
                     </div>
                 </div>

                 <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 flex flex-col justify-center gap-4 border border-slate-100 dark:border-slate-800/50">
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <div className="text-xs text-slate-500 mb-1">{t.calcProfit}</div>
                             <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400">USD</span>
                             </div>
                         </div>
                         <div>
                             <div className="text-xs text-slate-500 mb-1">{t.calcRoi}</div>
                             <div className={`text-2xl font-bold ${roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                             </div>
                         </div>
                     </div>
                     <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${roi >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                             style={{ 
                                 width: `${Math.min(Math.abs(roi), 100)}%`, 
                                 marginLeft: roi < 0 ? 'auto' : '0'
                             }}>
                        </div>
                     </div>
                     <p className="text-xs text-slate-400 text-center">
                        {roi > 0 ? "🚀 To the moon!" : roi < 0 ? "📉 HODL or Stop Loss?" : "Waiting for input..."}
                     </p>
                 </div>
             </div>
        </div>
    );
  };

  const CoinOverviewCard: React.FC<{ coin: CoinDetail }> = ({ coin }) => (
    <div 
      onClick={() => onMarketLeaderClick(coin.id)}
      className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group shadow-sm hover:shadow-indigo-500/10"
    >
      <div className="flex items-center gap-4">
        <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full shadow-lg" />
        <div>
          <div className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {coin.symbol.toUpperCase()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-500 font-medium">{coin.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {formatPrice(coin.current_price)}
        </div>
        <div className={`flex items-center justify-end gap-1 text-xs font-semibold mt-1 ${coin.price_change_percentage_24h >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
          {coin.price_change_percentage_24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );

  const IndicatorCard: React.FC<{ icon: React.ReactNode, label: string, metric: IndicatorMetric | undefined }> = ({ icon, label, metric }) => {
    if (!metric) return <div className="h-24 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>;
    
    let statusColor = "text-slate-600 dark:text-slate-300";
    let statusBg = "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600";
    const s = metric.status;
    
    if (s.includes('Strong') || s.includes('增强') || s.includes('Bullish') || s.includes('偏强') || s.includes('Buy') || s.includes('多头') || s.includes('金叉') || s.includes('合理')) {
      statusColor = "text-emerald-600 dark:text-emerald-400";
      statusBg = "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
    } else if (s.includes('Weak') || s.includes('转弱') || s.includes('Bearish') || s.includes('偏弱') || s.includes('Sell') || s.includes('空头') || s.includes('恐慌')) {
      statusColor = "text-rose-600 dark:text-rose-400";
      statusBg = "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20";
    }

    return (
      <div className="bg-white dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-2 shadow-sm">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
               {icon}
               {label}
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-bold border ${statusBg} ${statusColor}`}>
               {metric.status}
            </div>
         </div>
         <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed line-clamp-2">{metric.desc}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('dashboard')}>
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 hidden sm:block">
              {t.appTitle}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <nav className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 transition-colors">
              <button onClick={() => setViewMode('dashboard')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{t.dashboard}</button>
              <button onClick={() => setViewMode('analysis')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{t.analysis}</button>
              <button onClick={() => setViewMode('news')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'news' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{t.news}</button>
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={handleRefresh} className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title={t.refresh}>
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"><Settings className="w-5 h-5" /></button>
              <button onClick={toggleLang} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><Globe className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
        
        {/* Settings */}
        {showSettings && (
          <div className="max-w-7xl mx-auto px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 animate-fade-in-down transition-colors">
            <div className="max-w-xl ml-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-4 shadow-xl border border-slate-200 dark:border-slate-700">
               {/* API Key Section */}
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.apiKeyLabel}</label>
               <div className="flex gap-2">
                 <input type="text" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder={t.enterKey} className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" />
                 <button onClick={saveSettings} className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${saveStatus ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>{saveStatus ? <Check size={16}/> : <Save size={16}/>} {saveStatus ? t.saved : t.save}</button>
               </div>
               <p className="text-xs text-slate-500 mt-2">{t.apiKeyDesc}</p>

               {/* Theme Toggle */}
               <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"><Sun className="w-4 h-4 text-orange-400" /> {t.theme}</span>
                  <button onClick={toggleTheme} className="bg-slate-200 dark:bg-slate-700 p-1 rounded-full w-12 relative h-6 transition-colors">
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}></div>
                  </button>
               </div>

               {/* Mobile QR Section */}
               <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-400"/> {t.mobileAccess}</label>
                 <div className="flex items-start gap-4 bg-white dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}&color=${theme === 'dark' ? '22d3ee' : '6366f1'}&bgcolor=${theme === 'dark' ? '0f172a' : 'ffffff'}`} alt="QR Code" className="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900 flex-shrink-0" />
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex-1 space-y-2">
                      <p className="leading-relaxed">{t.mobileDesc}</p>
                      {isLocalhost && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-2 rounded text-yellow-600 dark:text-yellow-500 flex items-start gap-2">
                           <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                           <span>Phone cannot scan <b>localhost</b>. Use your PC's Network IP (e.g. 192.168.x.x) or a deploy URL.</span>
                        </div>
                      )}
                      <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 flex items-center gap-2 break-all">
                        <Link size={12} className="flex-shrink-0"/>
                        <span className="text-slate-500 select-all">{currentUrl}</span>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        {/* Compact Hero */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg transition-colors">
           <div className="text-center md:text-left flex items-center gap-3">
             <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg"><Search className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /></div>
             <div>
               <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                 {t.heroTitle}
               </h2>
               <p className="text-slate-500 text-xs hidden md:block">{t.heroSubtitle}</p>
             </div>
           </div>
           
           <div className="w-full max-w-lg group">
              <form onSubmit={onSearchSubmit} className="relative flex items-center">
                <input type="text" className="block w-full pl-4 pr-24 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950/50 rounded-lg leading-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="absolute right-1 top-1 bottom-1"><button type="submit" className="h-full bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-md text-xs font-semibold transition-colors shadow-sm">Search</button></div>
              </form>
           </div>
        </section>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 flex items-center gap-3 text-red-600 dark:text-red-200 animate-fade-in"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{error}</p></div>}
        
        {loadingBasic && !error && <div className="h-96 w-full bg-white dark:bg-slate-900/50 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800/50 border-dashed"><div className="text-center space-y-4"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" /><p className="text-slate-500">{t.searching}</p></div></div>}

        {!loadingBasic && (
            <>
                {viewMode === 'dashboard' && (
                  <div className="space-y-12 animate-fade-in">
                     <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm">
                           <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20 transition-all"></div>
                           <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-indigo-500/10 rounded-lg"><Globe className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /></div><span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{t.globalMarketCap}</span></div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight relative z-10">{loadingGlobal ? <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded"></div> : formatCurrency(globalData?.data.total_market_cap.usd || 0)}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-sm">
                           <div className="absolute right-0 top-0 w-24 h-24 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-cyan-500/10 dark:group-hover:bg-cyan-500/20 transition-all"></div>
                           <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-cyan-500/10 rounded-lg"><Activity className="w-5 h-5 text-cyan-500 dark:text-cyan-400" /></div><span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{t.liquidityVol}</span></div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight relative z-10">{loadingGlobal ? <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded"></div> : formatCurrency(globalData?.data.total_volume.usd || 0)}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-orange-500/30 transition-all shadow-sm">
                           <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-orange-500/10 dark:group-hover:bg-orange-500/20 transition-all"></div>
                           <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-orange-500/10 rounded-lg"><PieChart className="w-5 h-5 text-orange-500 dark:text-orange-400" /></div><span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{t.btcDominance}</span></div>
                           <div className="relative z-10"><div className="flex items-end gap-2 mb-1"><div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{loadingGlobal ? '0.0%' : `${globalData?.data.market_cap_percentage.btc.toFixed(1)}%`}</div></div><div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${globalData?.data.market_cap_percentage.btc || 0}%` }}></div></div></div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-sm">
                           <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20 transition-all"></div>
                           <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-emerald-500/10 rounded-lg"><Gauge className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /></div><span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{t.fearGreed}</span></div>
                           <div className="relative z-10">
                              {loadingGlobal || !fearGreed ? <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded"></div> : <><div className="flex items-center gap-2 mb-1"><span className={`text-2xl font-bold tracking-tight ${getFearGreedColor(parseInt(fearGreed.value))}`}>{fearGreed.value}</span><span className={`text-xs font-bold uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700 ${getFearGreedColor(parseInt(fearGreed.value))}`}>{getFearGreedLabel(parseInt(fearGreed.value))}</span></div><div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${parseInt(fearGreed.value) >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${fearGreed.value}%` }}></div></div></>}
                           </div>
                        </div>
                     </section>

                     <section>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                           <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /></div>
                             <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t.marketLeaders}</h3>
                           </div>
                           
                           <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1 flex-wrap">
                              {(['all', 'fav', 'eth', 'sol', 'bsc', 'arb'] as Category[]).map(cat => (
                                 <button
                                   key={cat}
                                   onClick={() => handleCategoryChange(cat)}
                                   className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                                 >
                                   {cat === 'all' ? t.catAll : cat === 'fav' ? t.catFav : cat === 'eth' ? t.catEth : cat === 'sol' ? t.catSol : cat === 'bsc' ? t.catBsc : t.catArb}
                                 </button>
                              ))}
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {trendingCoins.map((coin) => (<CoinOverviewCard key={coin.id} coin={coin} />))}
                          {trendingCoins.length === 0 && !loadingGlobal && (
                              <div className="col-span-4 text-center py-12 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                                {activeCategory === 'fav' ? (
                                    <div className="space-y-2">
                                        <Star className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.emptyWatchlist}</p>
                                    </div>
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-600 text-sm">Loading...</p>
                                )}
                              </div>
                          )}
                        </div>
                     </section>
                  </div>
                )}

                {viewMode === 'analysis' && currentCoin && (
                  <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                    
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl transition-colors">
                       <div className="absolute top-0 right-0 p-6 opacity-5"><Zap size={100} /></div>
                       <div className="flex justify-between items-start relative z-10">
                         <div>
                           <div className="flex items-center gap-3 mb-2"><img src={currentCoin.image} className="w-10 h-10 rounded-full" alt="icon" /><h2 className="text-2xl font-bold text-slate-900 dark:text-white">⚡️ {currentCoin.name} <span className="text-slate-500 text-lg">({currentCoin.symbol.toUpperCase()})</span></h2></div>
                           <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white mb-4">{formatPrice(currentCoin.current_price)}</div>
                           <div className="flex items-center gap-3">
                             <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t.adviceLabel}:</span>
                             {loadingDeep ? <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full"></div> : <span className={`px-4 py-1 rounded-full text-sm font-bold border ${analysis?.advice === 'Buy' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/50' : analysis?.advice === 'Sell' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/50' : 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-500/50'}`}>{analysis?.advice === 'Buy' ? t.buy : analysis?.advice === 'Sell' ? t.sell : t.hold}</span>}
                           </div>
                         </div>
                         <div className="flex gap-2">
                           <button onClick={() => toggleFavorite(currentCoin.id)} className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${favorites.includes(currentCoin.id) ? 'text-yellow-500 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10 hover:bg-yellow-100 dark:hover:bg-yellow-400/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}><Star size={20} className={favorites.includes(currentCoin.id) ? "fill-yellow-500 dark:fill-yellow-400" : ""} /></button>
                           <button onClick={copyReport} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2">{copied ? <Check size={20} className="text-emerald-500"/> : <Copy size={20}/>}<span className="text-xs hidden sm:block">{t.copyReport}</span></button>
                         </div>
                       </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md h-[400px]">
                         <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Activity className="w-3 h-3" />{t.chartTitle}</div>
                         <div className="h-[340px] w-full">
                           <PriceChart data={coinHistory} color={currentCoin.price_change_percentage_24h >= 0 ? '#10b981' : '#f43f5e'} />
                         </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                       <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors h-fit">
                          <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><Target className="w-5 h-5" /> {t.shortTerm}</h3>
                          {loadingDeep ? <div className="space-y-4"><div className="h-10 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="grid grid-cols-3 gap-4"><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div></div></div> :
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><span className="text-slate-500 dark:text-slate-400 font-medium">{t.direction}</span><span className={`font-bold ${analysis?.shortTerm?.direction === 'Long' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{analysis?.shortTerm?.direction === 'Long' ? `🟢 ${t.long}` : `🔴 ${t.short}`}</span></div>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"><div className="text-xs text-slate-500 font-bold uppercase mb-1">{t.entry}</div><div className="font-mono text-slate-900 dark:text-white text-sm font-semibold break-all">{analysis?.shortTerm?.entry || '-'}</div></div>
                              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-colors"><div className="text-xs text-emerald-600 dark:text-emerald-500/70 font-bold uppercase mb-1">{t.target}</div><div className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-semibold break-all">{analysis?.shortTerm?.target || '-'}</div></div>
                              <div className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-200 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700/50 transition-colors"><div className="text-xs text-rose-600 dark:text-rose-500/70 font-bold uppercase mb-1">{t.stop}</div><div className="font-mono text-rose-600 dark:text-rose-400 text-sm font-semibold break-all">{analysis?.shortTerm?.stop || '-'}</div></div>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800 p-3 rounded border-l-2 border-indigo-500">💡 {t.strategyNote}</div>
                          </div>
                          }
                       </div>

                       <div className="md:col-span-1 md:row-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md flex flex-col transition-colors">
                          <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5" /> {t.keyIndicators}</h3>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-3">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupTrend}</span>
                                <div className="grid grid-cols-1 gap-2">
                                  <IndicatorCard icon={<TrendingUp size={14} />} label={t.indTrend} metric={analysis?.trend} />
                                  <IndicatorCard icon={<Activity size={14} />} label={t.indEma} metric={analysis?.ema} />
                                  <IndicatorCard icon={<Layers size={14} />} label={t.indStructure} metric={analysis?.structure} />
                                  <IndicatorCard icon={<Droplets size={14} />} label={t.indBollinger} metric={analysis?.bollinger} />
                                </div>
                              </div>
                              <div className="space-y-3 mt-4">
                                 <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupMomentum}</span>
                                 <div className="grid grid-cols-1 gap-2">
                                    <IndicatorCard icon={<Zap size={14} />} label={t.indMomentum} metric={analysis?.momentum} />
                                    <IndicatorCard icon={<Target size={14} />} label={t.indRsi} metric={analysis?.rsiMetric} />
                                    <IndicatorCard icon={<ArrowUpRight size={14} />} label={t.indMacd} metric={analysis?.macd} />
                                    <IndicatorCard icon={<BarChart size={14} />} label={t.indVolume} metric={analysis?.volume} />
                                 </div>
                              </div>
                              <div className="space-y-3 mt-4">
                                 <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupOnChain}</span>
                                 <div className="grid grid-cols-1 gap-2">
                                    <IndicatorCard icon={<Coins size={14} />} label={t.indMvrv} metric={analysis?.mvrv} />
                                    <IndicatorCard icon={<BrainCircuit size={14} />} label={t.indNupl} metric={analysis?.nupl} />
                                 </div>
                              </div>
                            </div>
                          </div>
                       </div>

                       <ProfitCalculator currentPrice={currentCoin.current_price} targetPrice={analysis?.shortTerm?.target} />

                       <div className="md:col-span-2 grid md:grid-cols-2 gap-6">
                          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-6 shadow-md transition-colors">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" /> {t.summary}</h3>
                              {loadingDeep ? <div className="space-y-2"><div className="h-4 w-full bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div></div> : 
                              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm font-medium">{currentCoin.name} {analysis?.trend.status === '偏强' || analysis?.trend.status === 'Bullish' ? `${t.summaryBullish} ${formatPrice(analysis?.support || 0)}` : `${t.summaryBearish} ${formatPrice(analysis?.resistance || 0)}`}.</p>
                              }
                          </div>
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors">
                              <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-3 flex items-center gap-2"><BrainCircuit className="w-5 h-5" /> {t.investmentAdvice}</h3>
                              {loadingDeep ? <div className="space-y-2"><div className="h-4 w-full bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div></div> :
                              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4 marker:text-indigo-500"><li>{analysis?.advice === 'Buy' ? t.adviceBuy : analysis?.advice === 'Sell' ? t.adviceSell : t.adviceHold}</li><li>{analysis?.momentum.status === 'Strong' || analysis?.momentum.status === '增强' ? t.momentumStrong : t.momentumWeak}</li></ul>
                              }
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {viewMode === 'news' && (
                  <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Newspaper className="w-6 h-6 text-indigo-500 dark:text-indigo-400" /></div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.newsTitle}</h2>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Flash News (Timeline) */}
                        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
                           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                              <Zap className="w-5 h-5 text-yellow-500" /> {t.tabFlash}
                           </h3>
                           {loadingDeep ? (
                               <div className="space-y-6">
                                   {[1,2,3,4,5].map(i => (
                                       <div key={i} className="flex gap-4">
                                           <div className="w-2 bg-slate-200 dark:bg-slate-800 h-24 rounded-full"></div>
                                           <div className="flex-1 space-y-2">
                                               <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                                               <div className="h-16 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           ) : (
                               <div className="space-y-0 relative border-l-2 border-slate-100 dark:border-slate-800 ml-3">
                                  {marketNews.flash.length > 0 ? marketNews.flash.map((item, idx) => (
                                      <div key={idx} className="mb-8 pl-6 relative group">
                                         {/* Dot */}
                                         <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-full group-hover:bg-indigo-500 transition-colors"></div>
                                         <div className="flex items-center gap-2 mb-1">
                                             <Clock className="w-3 h-3 text-slate-400" />
                                             <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                         </div>
                                         <a href={item.url} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
                                             <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-snug mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.title}</h4>
                                             <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-3">{item.description}</p>
                                         </a>
                                      </div>
                                  )) : <div className="pl-6 text-slate-500 text-sm">No flash news available.</div>}
                               </div>
                           )}
                        </div>

                        {/* Articles (Grid) */}
                        <div className="lg:col-span-2">
                           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 pb-3">
                              <Layers className="w-5 h-5 text-indigo-500" /> {t.tabArticles}
                           </h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {loadingDeep ? [1,2,3,4].map(i => (
                                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-64 border border-slate-200 dark:border-slate-800 animate-pulse"></div>
                              )) : marketNews.articles.length > 0 ? marketNews.articles.map((item, idx) => (
                                  <a key={idx} href={item.url} target="_blank" rel="noreferrer" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-500/30 transition-all group flex flex-col h-full">
                                      {item.imageurl ? (
                                          <div className="h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
                                              <img 
                                                src={item.imageurl} 
                                                alt={item.title} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                  ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                                                }}
                                              />
                                              <div className="w-full h-full hidden items-center justify-center bg-slate-100 dark:bg-slate-800">
                                                  <ImageOff className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                              </div>
                                          </div>
                                      ) : <div className="h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center"><Newspaper className="w-12 h-12 text-indigo-500/20" /></div>}
                                      <div className="p-5 flex-1 flex flex-col">
                                          <div className="flex items-center gap-2 mb-3">
                                              <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.newsSource}: {item.author}</span>
                                              <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                          </div>
                                          <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">{item.title}</h4>
                                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4 flex-1">{item.description}</p>
                                          <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-semibold mt-auto group-hover:underline">
                                              {t.readMore} <ChevronRight className="w-4 h-4 ml-1" />
                                          </div>
                                      </div>
                                  </a>
                              )) : <div className="col-span-2 text-center py-12 text-slate-500">No articles found.</div>}
                           </div>
                        </div>
                     </div>
                  </div>
                )}
            </>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-16 py-8 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm"><p>© {new Date().getFullYear()} CryptoInsight.</p><p className="mt-2 text-xs opacity-50">{t.footer}</p></div>
      </footer>
    </div>
  );
};

export default App;