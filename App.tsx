
import React, { useState, useEffect, useCallback } from 'react';
import { fetchGlobalData, fetchCoinData, fetchCoinHistory, fetchNews, findCoinId, fetchTrendingCoins, setApiKey, fetchFearAndGreed, fetchCoinsMarketData } from './services/api';
import { GlobalData, CoinDetail, ChartDataPoint, NewsItem, Language, FearGreedData, IndicatorMetric, TechnicalAnalysis } from './types';
import { analyzeToken } from './utils/indicators';
import { translations } from './utils/translations';
import PriceChart from './components/PriceChart';
import { 
  Search, Activity, PieChart, ArrowUpRight, ArrowDownRight, AlertCircle, Loader2, 
  Coins, Zap, Target, BarChart2, Newspaper, BrainCircuit, Lightbulb, Copy, Check, Globe,
  Settings, Save, Gauge, Star, TrendingUp, Droplets, Layers, ChevronRight, BarChart, Smartphone, Link
} from 'lucide-react';

type ViewMode = 'dashboard' | 'analysis';
type Category = 'all' | 'eth' | 'sol' | 'bsc' | 'arb';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const t = translations[lang];

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  // Initialize from localStorage directly to avoid flicker/reset on reload, with try-catch
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

  // Search & Coin State
  const [searchQuery, setSearchQuery] = useState<string>('bitcoin');
  const [currentCoin, setCurrentCoin] = useState<CoinDetail | null>(null);
  const [coinHistory, setCoinHistory] = useState<ChartDataPoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  
  // Separate loading states for better UX
  const [loadingBasic, setLoadingBasic] = useState<boolean>(false);
  const [loadingDeep, setLoadingDeep] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Determine current URL for QR Code
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');

  // Initialize Data
  useEffect(() => {
    // Note: api.ts now initializes the key automatically from localStorage, 
    // but we can ensure it's synced if needed or just proceed to fetch.
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
        setTrendingCoins(tCoins);
        setFearGreed(fgData);
      } catch (err) {
        console.error("Init data fetch failed", err);
      } finally {
        setLoadingGlobal(false);
      }
    };
    initData();
    loadSpecificCoin('bitcoin', false); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Watchlist
  useEffect(() => {
    if (favorites.length > 0) {
      fetchCoinsMarketData(favorites).then(setWatchlistData);
    } else {
      setWatchlistData([]);
    }
  }, [favorites]);

  // Handle Category Change
  const handleCategoryChange = async (cat: Category) => {
    setActiveCategory(cat);
    const coins = await fetchTrendingCoins(cat);
    setTrendingCoins(coins);
  };

  // Re-fetch news on lang change
  useEffect(() => {
    if (currentCoin) {
      fetchNews(currentCoin.symbol, lang).then(setNews);
    }
  }, [lang, currentCoin]);

  const saveSettings = () => {
    const key = apiKeyInput.trim();
    setApiKey(key); // This now handles localStorage in api.ts as well
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
    // 1. Start loading Basic info
    setLoadingBasic(true);
    setLoadingDeep(true); // Start "deep" loading too, to show skeletons
    setError(null);
    setAnalysis(null);

    if (switchToAnalysis) {
      setViewMode('analysis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      // 2. Fetch Basic Data First - Fast!
      const coinData = await fetchCoinData(id);
      setCurrentCoin(coinData);
      setLoadingBasic(false); // Basic info is ready, render it!

      // 3. Fetch Deep Data in background - Slow
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
      
      // Step 1: Get Basic Info
      const coinData = await fetchCoinData(resolvedId);
      setCurrentCoin(coinData);
      setLoadingBasic(false); // Show the header instantly

      // Step 2: Get the rest
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
    if (value >= 45) return 'text-slate-400';
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

  const CoinOverviewCard: React.FC<{ coin: CoinDetail }> = ({ coin }) => (
    <div 
      onClick={() => onMarketLeaderClick(coin.id)}
      className="bg-slate-900/50 border border-slate-800/80 hover:border-indigo-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:bg-slate-800 flex items-center justify-between group shadow-sm hover:shadow-indigo-500/10"
    >
      <div className="flex items-center gap-4">
        <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full shadow-lg" />
        <div>
          <div className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">
            {coin.symbol.toUpperCase()}
          </div>
          <div className="text-xs text-slate-500 font-medium">{coin.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold text-white tracking-tight">
          {formatPrice(coin.current_price)}
        </div>
        <div className={`flex items-center justify-end gap-1 text-xs font-semibold mt-1 ${coin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {coin.price_change_percentage_24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );

  const IndicatorCard: React.FC<{ icon: React.ReactNode, label: string, metric: IndicatorMetric | undefined }> = ({ icon, label, metric }) => {
    if (!metric) return <div className="h-24 bg-slate-800/50 rounded-xl animate-pulse"></div>;
    
    // Determine Color
    let statusColor = "text-slate-300";
    let statusBg = "bg-slate-700/50 border-slate-600";
    const s = metric.status;
    
    if (s.includes('Strong') || s.includes('增强') || s.includes('Bullish') || s.includes('偏强') || s.includes('Buy') || s.includes('多头') || s.includes('金叉') || s.includes('合理')) {
      statusColor = "text-emerald-400";
      statusBg = "bg-emerald-500/10 border-emerald-500/20";
    } else if (s.includes('Weak') || s.includes('转弱') || s.includes('Bearish') || s.includes('偏弱') || s.includes('Sell') || s.includes('空头') || s.includes('恐慌')) {
      statusColor = "text-rose-400";
      statusBg = "bg-rose-500/10 border-rose-500/20";
    }

    return (
      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all flex flex-col gap-2">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
               {icon}
               {label}
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-bold border ${statusBg} ${statusColor}`}>
               {metric.status}
            </div>
         </div>
         <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{metric.desc}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('dashboard')}>
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
              {t.appTitle}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <nav className="flex items-center bg-slate-800 rounded-lg p-1">
              <button onClick={() => setViewMode('dashboard')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{t.dashboard}</button>
              <button onClick={() => setViewMode('analysis')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${viewMode === 'analysis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{t.analysis}</button>
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 transition-colors rounded-lg hover:bg-slate-700 text-slate-400"><Settings className="w-5 h-5" /></button>
              <button onClick={toggleLang} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-lg hover:bg-slate-700"><Globe className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
        
        {/* Settings */}
        {showSettings && (
          <div className="max-w-7xl mx-auto px-4 py-4 bg-slate-900 border-b border-slate-800 animate-fade-in-down">
            <div className="max-w-xl ml-auto bg-slate-800 rounded-xl p-4 shadow-xl border border-slate-700">
               {/* API Key Section */}
               <label className="block text-sm font-medium text-slate-300 mb-2">{t.apiKeyLabel}</label>
               <div className="flex gap-2">
                 <input type="text" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder={t.enterKey} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" />
                 <button onClick={saveSettings} className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${saveStatus ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>{saveStatus ? <Check size={16}/> : <Save size={16}/>} {saveStatus ? t.saved : t.save}</button>
               </div>
               <p className="text-xs text-slate-500 mt-2">{t.apiKeyDesc}</p>

               {/* Mobile QR Section */}
               <div className="mt-4 pt-4 border-t border-slate-700">
                 <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-400"/> {t.mobileAccess}</label>
                 <div className="flex items-start gap-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}&color=22d3ee&bgcolor=0f172a`} alt="QR Code" className="w-20 h-20 rounded-lg border border-slate-700 p-1 bg-slate-900 flex-shrink-0" />
                    <div className="text-xs text-slate-400 flex-1 space-y-2">
                      <p className="leading-relaxed">{t.mobileDesc}</p>
                      
                      {isLocalhost && (
                        <div className="bg-yellow-900/20 border border-yellow-900/50 p-2 rounded text-yellow-500 flex items-start gap-2">
                           <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                           <span>Phone cannot scan <b>localhost</b>. Use your PC's Network IP (e.g. 192.168.x.x) or a deploy URL.</span>
                        </div>
                      )}
                      
                      <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center gap-2 break-all">
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
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
           <div className="text-center md:text-left flex items-center gap-3">
             <div className="bg-indigo-500/10 p-2 rounded-lg"><Search className="w-5 h-5 text-indigo-400" /></div>
             <div>
               <h2 className="text-lg font-bold text-white tracking-tight">
                 {t.heroTitle}
               </h2>
               <p className="text-slate-500 text-xs hidden md:block">{t.heroSubtitle}</p>
             </div>
           </div>
           
           <div className="w-full max-w-lg group">
              <form onSubmit={onSearchSubmit} className="relative flex items-center">
                <input type="text" className="block w-full pl-4 pr-24 py-2.5 border border-slate-700 bg-slate-950/50 rounded-lg leading-5 text-white placeholder-slate-600 focus:outline-none focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="absolute right-1 top-1 bottom-1"><button type="submit" className="h-full bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-md text-xs font-semibold transition-colors shadow-sm">Search</button></div>
              </form>
           </div>
        </section>

        {error && <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-center gap-3 text-red-200 animate-fade-in"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{error}</p></div>}
        
        {/* Only show full page loader if we are loading basic info */}
        {loadingBasic && !error && <div className="h-96 w-full bg-slate-900/50 rounded-2xl flex items-center justify-center border border-slate-800/50 border-dashed"><div className="text-center space-y-4"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" /><p className="text-slate-500">{t.searching}</p></div></div>}

        {!loadingBasic && currentCoin && (
          <>
            {viewMode === 'dashboard' ? (
              <div className="space-y-12 animate-fade-in">
                 
                 {watchlistData.length > 0 && (
                   <section>
                      <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-yellow-400/10 rounded-lg"><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div><h3 className="text-xl font-bold text-white">{t.watchlist}</h3></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {watchlistData.map((coin) => (<CoinOverviewCard key={coin.id} coin={coin} />))}
                      </div>
                   </section>
                 )}

                 <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                       <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-indigo-500/20 transition-all"></div>
                       <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-indigo-500/10 rounded-lg"><Globe className="w-5 h-5 text-indigo-400" /></div><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{t.globalMarketCap}</span></div>
                       <div className="text-2xl font-bold text-white tracking-tight relative z-10">{loadingGlobal ? <div className="h-8 w-32 bg-slate-800 animate-pulse rounded"></div> : formatCurrency(globalData?.data.total_market_cap.usd || 0)}</div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                       <div className="absolute right-0 top-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-all"></div>
                       <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-cyan-500/10 rounded-lg"><Activity className="w-5 h-5 text-cyan-400" /></div><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{t.liquidityVol}</span></div>
                       <div className="text-2xl font-bold text-white tracking-tight relative z-10">{loadingGlobal ? <div className="h-8 w-32 bg-slate-800 animate-pulse rounded"></div> : formatCurrency(globalData?.data.total_volume.usd || 0)}</div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                       <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-all"></div>
                       <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-orange-500/10 rounded-lg"><PieChart className="w-5 h-5 text-orange-400" /></div><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{t.btcDominance}</span></div>
                       <div className="relative z-10"><div className="flex items-end gap-2 mb-1"><div className="text-2xl font-bold text-white tracking-tight">{loadingGlobal ? '0.0%' : `${globalData?.data.market_cap_percentage.btc.toFixed(1)}%`}</div></div><div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${globalData?.data.market_cap_percentage.btc || 0}%` }}></div></div></div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                       <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-all"></div>
                       <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-emerald-500/10 rounded-lg"><Gauge className="w-5 h-5 text-emerald-400" /></div><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{t.fearGreed}</span></div>
                       <div className="relative z-10">
                          {loadingGlobal || !fearGreed ? <div className="h-8 w-24 bg-slate-800 animate-pulse rounded"></div> : <><div className="flex items-center gap-2 mb-1"><span className={`text-2xl font-bold tracking-tight ${getFearGreedColor(parseInt(fearGreed.value))}`}>{fearGreed.value}</span><span className={`text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-950/30 border border-slate-700 ${getFearGreedColor(parseInt(fearGreed.value))}`}>{getFearGreedLabel(parseInt(fearGreed.value))}</span></div><div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${parseInt(fearGreed.value) >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${fearGreed.value}%` }}></div></div></>}
                       </div>
                    </div>
                 </section>

                 <section>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-400" /></div>
                         <h3 className="text-xl font-bold text-white">{t.marketLeaders}</h3>
                       </div>
                       
                       {/* Category Tabs */}
                       <div className="bg-slate-900 p-1 rounded-xl flex gap-1">
                          {(['all', 'eth', 'sol', 'bsc', 'arb'] as Category[]).map(cat => (
                             <button
                               key={cat}
                               onClick={() => handleCategoryChange(cat)}
                               className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                             >
                               {cat === 'all' ? t.catAll : cat === 'eth' ? t.catEth : cat === 'sol' ? t.catSol : cat === 'bsc' ? t.catBsc : t.catArb}
                             </button>
                          ))}
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {trendingCoins.map((coin) => (<CoinOverviewCard key={coin.id} coin={coin} />))}
                      {trendingCoins.length === 0 && !loadingGlobal && <div className="col-span-4 text-center text-slate-600 text-sm py-8 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">Loading...</div>}
                    </div>
                 </section>

                 <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none"></div>
                   <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8 pb-8 border-b border-slate-800">
                     <div className="flex items-center gap-5"><img src={currentCoin.image} alt={currentCoin.name} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-800 shadow-xl ring-4 ring-slate-800"/><div><h2 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">{currentCoin.name} <span className="text-lg font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{currentCoin.symbol.toUpperCase()}</span></h2><div className="text-slate-400 font-medium mt-1 flex items-center gap-2"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs">Rank #{currentCoin.market_cap_rank}</span></div></div></div>
                     <div className="text-left md:text-right w-full md:w-auto bg-slate-800/50 md:bg-transparent p-4 md:p-0 rounded-xl"><div className="text-4xl md:text-5xl font-bold text-white tracking-tight">{formatPrice(currentCoin.current_price)}</div><div className={`flex items-center md:justify-end gap-1 mt-2 text-lg font-bold ${currentCoin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{currentCoin.price_change_percentage_24h >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingUp className="w-5 h-5 transform rotate-180" />}{Math.abs(currentCoin.price_change_percentage_24h).toFixed(2)}% (24h)</div></div>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      <div className="space-y-1 p-4 bg-slate-800/30 rounded-xl border border-slate-800/50"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.marketCap}</div><div className="text-lg font-bold text-slate-200">{formatCurrency(currentCoin.market_cap)}</div></div>
                      <div className="space-y-1 p-4 bg-slate-800/30 rounded-xl border border-slate-800/50"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.volume24h}</div><div className="text-lg font-bold text-slate-200">{formatCurrency(currentCoin.total_volume)}</div></div>
                      <div className="space-y-1 p-4 bg-slate-800/30 rounded-xl border border-slate-800/50"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.high24h}</div><div className="text-lg font-bold text-slate-200">{formatPrice(currentCoin.high_24h)}</div></div>
                      <div className="space-y-1 p-4 bg-slate-800/30 rounded-xl border border-slate-800/50"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.low24h}</div><div className="text-lg font-bold text-slate-200">{formatPrice(currentCoin.low_24h)}</div></div>
                   </div>
                   
                   {/* Flex layout to fix overlap */}
                   <div className="bg-slate-800/20 rounded-2xl p-4 border border-slate-800/50 h-[360px] flex flex-col">
                     <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Activity className="w-3 h-3" />{t.chartTitle}</div>
                     <div className="flex-1 min-h-0 w-full">
                        {loadingDeep && coinHistory.length === 0 ? <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin"/></div> : <PriceChart data={coinHistory} color={currentCoin.price_change_percentage_24h >= 0 ? '#10b981' : '#f43f5e'} />}
                     </div>
                   </div>
                 </section>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                
                {/* Header */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                   <div className="absolute top-0 right-0 p-6 opacity-5"><Zap size={100} /></div>
                   <div className="flex justify-between items-start relative z-10">
                     <div>
                       <div className="flex items-center gap-3 mb-2"><img src={currentCoin.image} className="w-10 h-10 rounded-full" alt="icon" /><h2 className="text-2xl font-bold text-white">⚡️ {currentCoin.name} <span className="text-slate-500 text-lg">({currentCoin.symbol.toUpperCase()})</span></h2></div>
                       <div className="text-3xl font-mono font-bold text-white mb-4">{formatPrice(currentCoin.current_price)}</div>
                       <div className="flex items-center gap-3">
                         <span className="text-slate-400 text-sm font-medium">{t.adviceLabel}:</span>
                         {loadingDeep ? <div className="h-6 w-20 bg-slate-800 animate-pulse rounded-full"></div> : <span className={`px-4 py-1 rounded-full text-sm font-bold border ${analysis?.advice === 'Buy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : analysis?.advice === 'Sell' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-500/20 text-slate-300 border-slate-500/50'}`}>{analysis?.advice === 'Buy' ? t.buy : analysis?.advice === 'Sell' ? t.sell : t.hold}</span>}
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => toggleFavorite(currentCoin.id)} className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${favorites.includes(currentCoin.id) ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Star size={20} className={favorites.includes(currentCoin.id) ? "fill-yellow-400" : ""} /></button>
                       <button onClick={copyReport} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-2">{copied ? <Check size={20} className="text-emerald-500"/> : <Copy size={20}/>}<span className="text-xs hidden sm:block">{t.copyReport}</span></button>
                     </div>
                   </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                   {/* Short Term */}
                   <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                      <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2"><Target className="w-5 h-5" /> {t.shortTerm}</h3>
                      {loadingDeep ? <div className="space-y-4"><div className="h-10 bg-slate-800/50 rounded animate-pulse"></div><div className="grid grid-cols-3 gap-4"><div className="h-20 bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-800/50 rounded animate-pulse"></div></div></div> :
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg"><span className="text-slate-400 font-medium">{t.direction}</span><span className={`font-bold ${analysis?.shortTerm?.direction === 'Long' ? 'text-emerald-400' : 'text-rose-400'}`}>{analysis?.shortTerm?.direction === 'Long' ? `🟢 ${t.long}` : `🔴 ${t.short}`}</span></div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"><div className="text-xs text-slate-500 font-bold uppercase mb-1">{t.entry}</div><div className="font-mono text-white text-sm font-semibold break-all">{analysis?.shortTerm?.entry || '-'}</div></div>
                          <div className="p-3 bg-emerald-900/10 rounded-lg border border-emerald-900/30 hover:border-emerald-700/50 transition-colors"><div className="text-xs text-emerald-500/70 font-bold uppercase mb-1">{t.target}</div><div className="font-mono text-emerald-400 text-sm font-semibold break-all">{analysis?.shortTerm?.target || '-'}</div></div>
                          <div className="p-3 bg-rose-900/10 rounded-lg border border-rose-900/30 hover:border-rose-700/50 transition-colors"><div className="text-xs text-rose-500/70 font-bold uppercase mb-1">{t.stop}</div><div className="font-mono text-rose-400 text-sm font-semibold break-all">{analysis?.shortTerm?.stop || '-'}</div></div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2 bg-slate-800 p-3 rounded border-l-2 border-indigo-500">💡 {t.strategyNote}</div>
                      </div>
                      }
                   </div>

                   {/* Key Indicators Bionic Grid */}
                   <div className="md:col-span-1 md:row-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col">
                      <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5" /> {t.keyIndicators}</h3>
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        <div className="grid grid-cols-1 gap-3">
                          {/* Group: Trend */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-1">{t.groupTrend}</span>
                            <div className="grid grid-cols-1 gap-2">
                              <IndicatorCard icon={<TrendingUp size={14} />} label={t.indTrend} metric={analysis?.trend} />
                              <IndicatorCard icon={<Activity size={14} />} label={t.indEma} metric={analysis?.ema} />
                              <IndicatorCard icon={<Layers size={14} />} label={t.indStructure} metric={analysis?.structure} />
                              <IndicatorCard icon={<Droplets size={14} />} label={t.indBollinger} metric={analysis?.bollinger} />
                            </div>
                          </div>
                          
                          {/* Group: Momentum */}
                          <div className="space-y-3 mt-4">
                             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-1">{t.groupMomentum}</span>
                             <div className="grid grid-cols-1 gap-2">
                                <IndicatorCard icon={<Zap size={14} />} label={t.indMomentum} metric={analysis?.momentum} />
                                <IndicatorCard icon={<Target size={14} />} label={t.indRsi} metric={analysis?.rsiMetric} />
                                <IndicatorCard icon={<ArrowUpRight size={14} />} label={t.indMacd} metric={analysis?.macd} />
                                <IndicatorCard icon={<BarChart size={14} />} label={t.indVolume} metric={analysis?.volume} />
                             </div>
                          </div>

                          {/* Group: OnChain */}
                          <div className="space-y-3 mt-4">
                             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-1">{t.groupOnChain}</span>
                             <div className="grid grid-cols-1 gap-2">
                                <IndicatorCard icon={<Coins size={14} />} label={t.indMvrv} metric={analysis?.mvrv} />
                                <IndicatorCard icon={<BrainCircuit size={14} />} label={t.indNupl} metric={analysis?.nupl} />
                             </div>
                          </div>
                        </div>
                      </div>
                   </div>

                   {/* Summary */}
                   <div className="md:col-span-2 grid md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-md">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-400" /> {t.summary}</h3>
                          {loadingDeep ? <div className="space-y-2"><div className="h-4 w-full bg-slate-800/50 rounded animate-pulse"></div><div className="h-4 w-2/3 bg-slate-800/50 rounded animate-pulse"></div></div> : 
                          <p className="text-slate-300 leading-relaxed text-sm font-medium">{currentCoin.name} {analysis?.trend.status === '偏强' || analysis?.trend.status === 'Bullish' ? `${t.summaryBullish} ${formatPrice(analysis?.support || 0)}` : `${t.summaryBearish} ${formatPrice(analysis?.resistance || 0)}`}.</p>
                          }
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                          <h3 className="text-lg font-bold text-indigo-400 mb-3 flex items-center gap-2"><BrainCircuit className="w-5 h-5" /> {t.investmentAdvice}</h3>
                          {loadingDeep ? <div className="space-y-2"><div className="h-4 w-full bg-slate-800/50 rounded animate-pulse"></div><div className="h-4 w-2/3 bg-slate-800/50 rounded animate-pulse"></div></div> :
                          <ul className="space-y-2 text-sm text-slate-300 list-disc pl-4 marker:text-indigo-500"><li>{analysis?.advice === 'Buy' ? t.adviceBuy : analysis?.advice === 'Sell' ? t.adviceSell : t.adviceHold}</li><li>{analysis?.momentum.status === 'Strong' || analysis?.momentum.status === '增强' ? t.momentumStrong : t.momentumWeak}</li></ul>
                          }
                      </div>
                   </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                   <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2"><Newspaper className="w-5 h-5" /> {t.latestNews}</h3>
                   <div className="grid gap-3">{news.length > 0 ? news.map((item, idx) => (<a key={idx} href={item.url} target="_blank" rel="noreferrer" className="block p-4 bg-slate-800/30 hover:bg-slate-800 border border-slate-800/50 hover:border-slate-700 rounded-xl transition-all group"><div className="flex justify-between items-start gap-4"><div><h4 className="text-slate-200 group-hover:text-indigo-300 font-semibold text-sm mb-1 leading-snug">{item.title}</h4><div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{item.author}</span><span className="text-xs text-slate-600">•</span><span className="text-xs text-slate-600">{new Date(item.created_at).toLocaleDateString()}</span></div></div><ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" /></div></a>)) : <div className="text-slate-500 text-sm py-8 text-center bg-slate-800/20 rounded-xl">Loading news...</div>}</div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-16 py-8 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm"><p>© {new Date().getFullYear()} CryptoInsight.</p><p className="mt-2 text-xs opacity-50">{t.footer}</p></div>
      </footer>
    </div>
  );
};

export default App;