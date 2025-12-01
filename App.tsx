
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchGlobalData, fetchCoinData, fetchCoinHistory, findCoinId, fetchTrendingCoins, fetchFearAndGreed, fetchCoinsMarketData, fetchOnChainData, fetchEVMAssets, fetchCoinNews } from './services/api';
import { GlobalData, CoinDetail, ChartDataPoint, Language, FearGreedData, IndicatorMetric, TechnicalAnalysis, Category, OnChainData, PortfolioItem, NewsItem } from './types';
import { analyzeToken } from './utils/indicators';
import { translations } from './utils/translations';
import PriceChart from './components/PriceChart';
import { 
  Search, Activity, PieChart, ArrowUpRight, ArrowDownRight, AlertCircle, Loader2, 
  Coins, Zap, Target, BarChart2, BrainCircuit, Lightbulb, Copy, Check, Globe,
  Settings, Gauge, Star, TrendingUp, Droplets, Layers, BarChart, Sun, Moon, RefreshCw, Calculator, ArrowRightLeft, Lock, Anchor, Wallet, Plus, Trash2, Edit2, X, Download, LayoutGrid, Gem, Hexagon, History, Newspaper, ExternalLink
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

// Add declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

type ViewMode = 'dashboard' | 'analysis' | 'tools' | 'portfolio';

// --- Standalone Components ---

const CoinOverviewCard: React.FC<{ coin: CoinDetail, onClick: (id: string) => void, formatPrice: (n: number) => string }> = React.memo(({ coin, onClick, formatPrice }) => (
  <div 
    onClick={() => onClick(coin.id)}
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
));

const IndicatorCard: React.FC<{ icon: React.ReactNode, label: string, metric: IndicatorMetric | undefined }> = ({ icon, label, metric }) => {
  if (!metric) return <div className="h-24 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>;
  
  let statusColor = "text-slate-600 dark:text-slate-300";
  let statusBg = "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600";
  const s = metric.status;
  
  // Adjusted matching logic for both English and Chinese status strings
  if (s.includes('Strong') || s.includes('增强') || s.includes('Bullish') || s.includes('偏强') || s.includes('Buy') || s.includes('多头') || s.includes('金叉') || s.includes('合理') || s.includes('Fair') || s.includes('Greed') || s.includes('Golden')) {
    statusColor = "text-emerald-600 dark:text-emerald-400";
    statusBg = "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
  } else if (s.includes('Weak') || s.includes('转弱') || s.includes('Bearish') || s.includes('偏弱') || s.includes('Sell') || s.includes('空头') || s.includes('恐慌') || s.includes('Fear') || s.includes('Death')) {
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

const ProfitCalculator: React.FC<{ t: any }> = ({ t }) => {
    const [principal, setPrincipal] = useState<string>('1000');
    const [buyPrice, setBuyPrice] = useState<string>('');
    const [sellPrice, setSellPrice] = useState<string>('');

    const p = parseFloat(principal) || 0;
    const b = parseFloat(buyPrice) || 0;
    const s = parseFloat(sellPrice) || 0;

    let profit = 0;
    let roi = 0;

    if (b > 0 && p > 0 && s > 0) {
        const amount = p / b;
        const totalValue = amount * s;
        profit = totalValue - p;
        roi = (profit / p) * 100;
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors relative overflow-hidden h-full">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
             
             <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-6 flex items-center gap-2 relative z-10">
                 <Calculator className="w-5 h-5" /> {t.calcTitle}
             </h3>

             <div className="space-y-6 relative z-10">
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.calcPrincipal}</label>
                         <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="1000" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.calcBuyPrice}</label>
                             <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="0.00" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.calcSellPrice}</label>
                             <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="0.00" />
                         </div>
                     </div>
                 </div>

                 <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 flex flex-col justify-center gap-4 border border-slate-100 dark:border-slate-800/50">
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <div className="text-xs text-slate-500 mb-1">{t.calcProfit}</div>
                             <div className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400">USD</span>
                             </div>
                         </div>
                         <div>
                             <div className="text-xs text-slate-500 mb-1">{t.calcRoi}</div>
                             <div className={`text-xl font-bold ${roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                             </div>
                         </div>
                     </div>
                     <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${roi >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                             style={{ 
                                 width: `${Math.min(Math.abs(roi), 100)}%`, 
                                 marginLeft: roi < 0 ? 'auto' : '0'
                             }}>
                        </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

const CryptoConverter: React.FC<{ coins: CoinDetail[], t: any, formatPrice: (n: number) => string }> = ({ coins, t, formatPrice }) => {
    const [amount, setAmount] = useState('1');
    const [fromCoinId, setFromCoinId] = useState<string>('bitcoin');
    const [toCoinId, setToCoinId] = useState<string>('tether');
    
    const fromCoin = coins.find(c => c.id === fromCoinId);
    const toCoin = coins.find(c => c.id === toCoinId);
    
    const val = parseFloat(amount) || 0;
    let result = 0;
    
    if (fromCoin && toCoin) {
        result = (val * fromCoin.current_price) / toCoin.current_price;
    }

    const swap = () => {
        setFromCoinId(toCoinId);
        setToCoinId(fromCoinId);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden relative h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-500"/>
                    {t.converterTitle}
                </h2>

                <div className="space-y-4">
                    {/* From Card */}
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t.convFrom}</label>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <input 
                                    type="number" 
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full bg-transparent text-2xl font-bold text-slate-900 dark:text-white focus:outline-none placeholder-slate-300"
                                    placeholder="0"
                                    />
                                </div>
                                <div className="w-1/3 min-w-[100px]">
                                    <select 
                                    value={fromCoinId} 
                                    onChange={e => setFromCoinId(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                                    >
                                    {coins.map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-2">
                            1 {fromCoin?.symbol.toUpperCase()} ≈ {formatPrice(fromCoin?.current_price || 0)}
                            </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center -my-2 relative z-10">
                        <button onClick={swap} className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110">
                            <ArrowRightLeft className="w-5 h-5" />
                        </button>
                    </div>

                    {/* To Card */}
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t.convTo}</label>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <div className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 truncate">
                                        {result > 0 ? (result < 0.0001 ? result.toExponential(4) : result.toLocaleString(undefined, {maximumFractionDigits: 6})) : '0'}
                                    </div>
                                </div>
                                <div className="w-1/3 min-w-[100px]">
                                    <select 
                                    value={toCoinId} 
                                    onChange={e => setToCoinId(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                                    >
                                    {coins.map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-2">
                            1 {toCoin?.symbol.toUpperCase()} ≈ {formatPrice(toCoin?.current_price || 0)}
                            </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OnChainView: React.FC<{ coin: CoinDetail, t: any, formatPrice: (n: number) => string }> = ({ coin, t, formatPrice }) => {
  const onChainData = fetchOnChainData(coin);

  return (
    <div className="space-y-6 animate-fade-in-up w-full mt-6">
       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-6 opacity-5"><Layers size={120} /></div>
          <div className="flex items-center gap-4 relative z-10 mb-6">
              <div className="p-3 bg-cyan-100 dark:bg-cyan-900/50 rounded-full text-cyan-600 dark:text-cyan-400"><Layers size={24}/></div>
              <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">{t.ocTitle}</h2>
                  <p className="text-slate-500 text-xs">{t.ocDataDesc}</p>
              </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
             {/* Unlocks Card */}
             <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-indigo-500 font-bold"><Lock size={18}/> {t.ocUnlocks}</div>
                
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>{t.ocCirculating}</span>
                            <span className="text-slate-900 dark:text-white font-mono">{coin.circulating_supply?.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${onChainData.unlockProgress}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1 font-bold">
                            <span className="text-indigo-500">{onChainData.unlockProgress.toFixed(1)}% Unlocked</span>
                            <span className="text-slate-400">{onChainData.lockedPercent.toFixed(1)}% {t.ocLocked}</span>
                        </div>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                             <span className="text-xs text-slate-500">{t.ocFdvGap}</span>
                             <span className="text-sm font-bold text-slate-900 dark:text-white">x{onChainData.fdvGap.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
             </div>

             {/* Whale Radar */}
             <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-cyan-500 font-bold"><Anchor size={18}/> {t.ocWhaleRadar}</div>
                <div className="flex items-center justify-center py-2">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping"></div>
                        <div className="absolute inset-4 rounded-full border-2 border-cyan-500/40"></div>
                        <div className="absolute inset-8 rounded-full border-2 border-cyan-500/60"></div>
                        <div className="relative z-10 text-center">
                            <div className="text-2xl font-bold text-cyan-500">{onChainData.whaleActivity}</div>
                            <div className="text-[10px] text-slate-500">{t.ocActivityLevel}</div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Net Flow */}
             <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                 <div className="flex items-center gap-2 mb-4 text-emerald-500 font-bold"><ArrowRightLeft size={18}/> {t.ocExchangeFlow}</div>
                 <div className="h-32 flex items-end justify-center gap-2">
                     {[1,2,3,4,5,6,7].map(i => {
                         const height = Math.random() * 80 + 20;
                         const isPos = Math.random() > 0.4;
                         return (
                             <div key={i} className={`w-4 rounded-t-sm ${isPos ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`} style={{ height: `${height}%` }}></div>
                         )
                     })}
                 </div>
                 <div className="flex justify-between text-xs mt-3 font-bold px-4">
                     <span className="text-emerald-500">{t.ocInflow}</span>
                     <span className="text-rose-500">{t.ocOutflow}</span>
                 </div>
             </div>

             {/* Holders */}
             <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                 <div className="flex items-center gap-2 mb-4 text-orange-500 font-bold"><Wallet size={18}/> {t.ocHolders}</div>
                 <div className="text-center py-6">
                     <div className="text-3xl font-bold text-slate-900 dark:text-white">{onChainData.holders.toLocaleString()}</div>
                     <div className="text-xs text-slate-500 mt-1">{t.ocActiveAddr}</div>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const PortfolioView: React.FC<{ coins: CoinDetail[], t: any, formatPrice: (n: number) => string }> = ({ coins, t, formatPrice }) => {
  const [items, setItems] = useState<PortfolioItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('portfolioItems') || '[]');
    } catch { return []; }
  });
  
  // Wallet State
  const [walletAddress, setWalletAddress] = useState<string>(() => localStorage.getItem('walletAddress') || '');
  const [walletItems, setWalletItems] = useState<PortfolioItem[]>(() => {
      try {
          return JSON.parse(localStorage.getItem('walletItems') || '[]');
      } catch { return []; }
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [selectedCoinId, setSelectedCoinId] = useState<string>('bitcoin');

  useEffect(() => {
     localStorage.setItem('portfolioItems', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
     localStorage.setItem('walletItems', JSON.stringify(walletItems));
     localStorage.setItem('walletAddress', walletAddress);
  }, [walletItems, walletAddress]);

  // Connect Wallet Logic
  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet.");
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        await fetchWalletAssets(accounts[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const importAddress = async () => {
     if (!walletAddress) return;
     setIsConnecting(true);
     await fetchWalletAssets(walletAddress);
     setIsConnecting(false);
  };

  const fetchWalletAssets = async (address: string) => {
      const assets = await fetchEVMAssets(address);
      
      const newWalletItems: PortfolioItem[] = [];
      const symbolToIdMap: Record<string, string> = {};
      const idsToFetch: string[] = [];
      
      for (const asset of assets) {
          const foundId = await findCoinId(asset.symbol); // Re-using existing fuzzy finder
          if (foundId) {
             symbolToIdMap[asset.symbol] = foundId;
             if (!idsToFetch.includes(foundId)) idsToFetch.push(foundId);
          }
      }
      
      const marketData = await fetchCoinsMarketData(idsToFetch);
      
      for (const asset of assets) {
          const id = symbolToIdMap[asset.symbol];
          const coin = marketData.find(c => c.id === id);
          
          if (coin) {
              newWalletItems.push({
                  id: `wallet-${asset.symbol}`,
                  coinId: coin.id,
                  symbol: coin.symbol,
                  name: coin.name,
                  image: coin.image,
                  amount: asset.balance,
                  avgBuyPrice: 0, // Wallet doesn't know buy price
                  source: 'wallet',
                  priceChange24h: coin.price_change_percentage_24h
              });
          }
      }
      
      setWalletItems(newWalletItems);
  };

  // Merge items for calculation
  const allItems = [...items, ...walletItems];

  // Calculate Totals
  let totalBalance = 0;
  let totalCost = 0;
  let total24hChange = 0; // Approximate daily PnL
  
  const enrichedItems = allItems.map(item => {
     const liveCoin = coins.find(c => c.id === item.coinId);
     const currentPrice = liveCoin ? liveCoin.current_price : (item.source === 'wallet' ? 0 : item.avgBuyPrice); 
     
     const currentValue = currentPrice * item.amount;
     const costBasis = item.avgBuyPrice * item.amount;
     
     totalBalance += currentValue;
     if (item.source === 'manual') {
         totalCost += costBasis;
     }
     
     // 24h PnL estimate
     const changePct = liveCoin ? liveCoin.price_change_percentage_24h : (item.priceChange24h || 0);
     const profit24h = (currentValue * changePct) / 100;
     total24hChange += profit24h;

     return { 
         ...item, 
         currentPrice, 
         currentValue, 
         profit: item.source === 'manual' ? (currentValue - costBasis) : profit24h, // Manual = Total PnL, Wallet = 24h PnL
         roi: item.source === 'manual' ? ((currentValue - costBasis) / costBasis) * 100 : changePct 
     };
  });

  const totalProfit = totalBalance - totalCost;
  // Manual Only Profit
  const manualItems = enrichedItems.filter(i => i.source === 'manual');
  const manualProfit = manualItems.reduce((acc, i) => acc + (i.currentValue - (i.avgBuyPrice * i.amount)), 0);
  const manualCost = manualItems.reduce((acc, i) => acc + (i.avgBuyPrice * i.amount), 0);
  const manualRoi = manualCost > 0 ? (manualProfit / manualCost) * 100 : 0;

  // Chart Data
  const chartData = enrichedItems.map(i => ({ name: i.symbol.toUpperCase(), value: i.currentValue })).filter(i => i.value > 0);
  const COLORS = ['#6366f1', '#22d3ee', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

  const handleSave = () => {
     if (!amount || !buyPrice) return;
     const coin = coins.find(c => c.id === selectedCoinId);
     if (!coin) return;
     const newItem: PortfolioItem = {
        id: editingItem ? editingItem.id : Date.now().toString(),
        coinId: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        amount: parseFloat(amount),
        avgBuyPrice: parseFloat(buyPrice),
        source: 'manual'
     };
     if (editingItem) {
        setItems(items.map(i => i.id === editingItem.id ? newItem : i));
     } else {
        setItems([...items, newItem]);
     }
     setShowAddModal(false);
     setEditingItem(null);
     setAmount(''); setBuyPrice('');
  };

  const handleDelete = (id: string) => {
     setItems(items.filter(i => i.id !== id));
  };

  const openAdd = () => {
     setEditingItem(null); setAmount(''); setBuyPrice(''); setShowAddModal(true);
  };

  const openEdit = (item: PortfolioItem) => {
     if (item.source === 'wallet') return;
     setEditingItem(item); setSelectedCoinId(item.coinId); setAmount(item.amount.toString()); setBuyPrice(item.avgBuyPrice.toString()); setShowAddModal(true);
  };

  return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                   <div className="relative z-10">
                       <div className="text-indigo-200 text-sm font-bold uppercase mb-1">{t.pfNetWorth}</div>
                       <div className="text-3xl font-bold">{formatPrice(totalBalance)}</div>
                       <div className={`text-sm mt-1 font-medium ${total24hChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                           24h: {total24hChange >= 0 ? '+' : ''}{formatPrice(total24hChange)}
                       </div>
                   </div>
                   <Wallet className="absolute right-4 bottom-4 text-white/20 w-16 h-16" />
              </div>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                   <div className="text-slate-500 text-xs font-bold uppercase mb-1">{t.pfManualAssets} PnL</div>
                   <div className={`text-2xl font-bold ${manualProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                       {manualProfit >= 0 ? '+' : ''}{formatPrice(manualProfit)}
                   </div>
                   <div className={`text-sm font-medium ${manualRoi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {manualRoi.toFixed(2)}%
                   </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div>
                           <div className="text-slate-500 text-xs font-bold uppercase mb-1">{t.pfWalletAssets}</div>
                           <div className="text-xl font-bold text-slate-900 dark:text-white">{walletItems.length} Tokens</div>
                       </div>
                       <div className="text-right">
                            <button onClick={connectWallet} className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1">
                                {isConnecting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                                {walletAddress ? t.pfWalletConnected : t.pfConnectWallet}
                            </button>
                       </div>
                   </div>
                   <div className="mt-2">
                       <input 
                         type="text" 
                         value={walletAddress} 
                         onChange={(e) => setWalletAddress(e.target.value)}
                         placeholder="0x..." 
                         className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 mb-2"
                       />
                       <button onClick={importAddress} className="w-full text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-1 rounded font-semibold">
                           {t.pfImportAddress}
                       </button>
                   </div>
              </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 min-h-[300px]">
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">{t.pfAllocation}</h3>
                  {chartData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <ReTooltip 
                                   formatter={(value: number) => formatPrice(value)}
                                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                                />
                            </RePieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            {chartData.slice(0, 6).map((entry, index) => (
                                <div key={index} className="flex items-center gap-1 text-xs text-slate-500">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    {entry.name}
                                </div>
                            ))}
                        </div>
                      </div>
                  ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center px-4">
                          {t.pfNoAssets}
                      </div>
                  )}
              </div>

              {/* List */}
              <div className="md:col-span-2 space-y-3">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.pfAssets}</h3>
                      <button onClick={openAdd} className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg transition-colors">
                          <Plus size={14} /> {t.pfAddAsset}
                      </button>
                  </div>
                  
                  {enrichedItems.map(item => (
                      <div key={item.id} className={`bg-white dark:bg-slate-900 border ${item.source === 'wallet' ? 'border-indigo-100 dark:border-indigo-900/30' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-4 flex items-center justify-between hover:border-indigo-500/30 transition-colors`}>
                          <div className="flex items-center gap-3">
                              <img src={item.image} className="w-10 h-10 rounded-full" alt="icon" />
                              <div>
                                  <div className="flex items-center gap-2">
                                      <div className="font-bold text-slate-900 dark:text-white">{item.symbol.toUpperCase()}</div>
                                      {item.source === 'wallet' && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">WALLET</span>}
                                  </div>
                                  <div className="text-xs text-slate-500">{item.amount.toLocaleString()} coins</div>
                              </div>
                          </div>
                          
                          <div className="text-right hidden sm:block">
                              <div className="text-xs text-slate-500">{t.pfCurrentVal}</div>
                              <div className="font-bold text-slate-900 dark:text-white">{formatPrice(item.currentValue)}</div>
                          </div>

                          <div className="text-right">
                               <div className="text-xs text-slate-500">{item.source === 'manual' ? t.pfReturn : '24h PnL'}</div>
                               <div className={`font-bold ${item.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                   {formatPrice(item.profit)}
                               </div>
                               <div className={`text-xs ${item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                   {item.roi.toFixed(2)}%
                               </div>
                          </div>

                          <div className="flex gap-1">
                              {item.source === 'manual' && (
                                  <>
                                  <button onClick={() => openEdit(item)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Trash2 size={16}/></button>
                                  </>
                              )}
                          </div>
                      </div>
                  ))}
                  {allItems.length === 0 && (
                     <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-xl p-8 text-center">
                         <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                         <p className="text-slate-500">{t.pfNoAssets}</p>
                     </div>
                  )}
              </div>
          </div>

          {/* Add Asset Modal */}
          {showAddModal && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in-up">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                          <h3 className="font-bold text-lg">{t.pfAddTitle}</h3>
                          <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5"/></button>
                      </div>
                      <div className="p-6 space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.selectCoin}</label>
                              <select 
                                value={selectedCoinId} 
                                onChange={e => { setSelectedCoinId(e.target.value); if (!editingItem) { const c = coins.find(x => x.id === e.target.value); if (c) setBuyPrice(c.current_price.toString()); } }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                              >
                                {coins.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.pfAmount}</label>
                              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white" placeholder="0.00" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.pfPricePerCoin}</label>
                              <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white" placeholder="0.00" />
                          </div>
                          <button onClick={handleSave} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors">{t.save}</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

// --- Main App Component ---

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
  const [coinNews, setCoinNews] = useState<NewsItem[]>([]);
  const [priceRange7d, setPriceRange7d] = useState<{low: number, high: number} | null>(null);
  
  // Analysis - Now derived via useMemo to support instant translation switch
  const analysis = useMemo(() => {
    if (!currentCoin || coinHistory.length === 0) return null;
    return analyzeToken(coinHistory, currentCoin.current_price, lang);
  }, [coinHistory, currentCoin, lang]);

  // Tools & Portfolio State
  const [converterCoins, setConverterCoins] = useState<CoinDetail[]>([]);

  // Separate loading states for better UX
  const [loadingBasic, setLoadingBasic] = useState<boolean>(false);
  const [loadingDeep, setLoadingDeep] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    // Preload Bitcoin
    loadSpecificCoin('bitcoin', false); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Watchlist
  useEffect(() => {
    if (favorites.length > 0) {
      fetchCoinsMarketData(favorites).then(data => {
        setWatchlistData(data);
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
    if (cat === 'fav') {
        setTrendingCoins(watchlistData);
        return;
    }
    setTrendingCoins([]); 
    const coins = await fetchTrendingCoins(cat);
    setTrendingCoins(coins);
  };

  // Init Converter/Portfolio Coins (Top 50)
  useEffect(() => {
      if ((viewMode === 'tools' || viewMode === 'portfolio') && converterCoins.length === 0) {
          fetchCoinsMarketData(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 'ripple', 'usd-coin', 'cardano', 'avalanche-2', 'dogecoin', 'polkadot', 'tron', 'chainlink', 'matic-network', 'shiba-inu', 'litecoin', 'uniswap', 'near', 'kaspa', 'aptos', 'monero', 'stellar', 'sui', 'pepe', 'render-token', 'arbitrum', 'optimism']).then(setConverterCoins);
      }
  }, [viewMode, converterCoins.length]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [gData, fgData] = await Promise.all([
        fetchGlobalData(),
        fetchFearAndGreed()
      ]);
      setGlobalData(gData);
      setFearGreed(fgData);

      if (viewMode === 'dashboard') {
        if (activeCategory === 'fav') {
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
        await loadSpecificCoin(currentCoin.id, false); 
      } else if (viewMode === 'tools' || viewMode === 'portfolio') {
          fetchCoinsMarketData(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin']).then(setConverterCoins); // Lightweight refresh
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
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
    setCoinNews([]); // Reset news
    setCoinHistory([]); // Reset history
    setPriceRange7d(null); // Reset range

    if (switchToAnalysis) {
      setViewMode('analysis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const coinData = await fetchCoinData(id);
      setCurrentCoin(coinData);
      setLoadingBasic(false); 

      // Parallel fetch
      const [historyData, newsData] = await Promise.all([
         fetchCoinHistory(id),
         fetchCoinNews(coinData.symbol)
      ]);
      
      setCoinHistory(historyData);
      setCoinNews(newsData);
      
      // Calculate 7d Range
      if (historyData.length > 0) {
          const prices = historyData.map(p => p.price);
          setPriceRange7d({ low: Math.min(...prices), high: Math.max(...prices) });
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
    // analysis set via useMemo
    setViewMode('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Reset state before fetch to avoid stale data
    setCoinNews([]);
    setCoinHistory([]);
    setPriceRange7d(null);

    try {
      const resolvedId = await findCoinId(query);
      const coinData = await fetchCoinData(resolvedId);
      setCurrentCoin(coinData);
      setLoadingBasic(false); 

      const [historyData, newsData] = await Promise.all([
         fetchCoinHistory(resolvedId),
         fetchCoinNews(coinData.symbol)
      ]);
      
      setCoinHistory(historyData);
      setCoinNews(newsData);

      if (historyData.length > 0) {
        const prices = historyData.map(p => p.price);
        setPriceRange7d({ low: Math.min(...prices), high: Math.max(...prices) });
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message === "NOT_FOUND" ? t.errorNotFound : t.errorGeneric);
    } finally {
      setLoadingBasic(false);
      setLoadingDeep(false);
    }
  }, [t]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const onMarketLeaderClick = useCallback((coinId: string) => {
    setSearchQuery(coinId);
    loadSpecificCoin(coinId, true);
  }, []);

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

  const formatDate = (dateStr: string) => {
      try {
          return new Date(dateStr).toLocaleDateString();
      } catch {
          return dateStr;
      }
  }

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

  const getCategoryIcon = (cat: Category) => {
      switch(cat) {
          case 'fav': return <Star size={14} className={activeCategory === 'fav' ? 'fill-indigo-600 dark:fill-white text-indigo-600 dark:text-white' : ''} />;
          case 'all': return <TrendingUp size={14} />;
          case 'eth': return <Gem size={14} />;
          case 'sol': return <Zap size={14} />;
          case 'bsc': return <Hexagon size={14} />;
          case 'arb': return <Layers size={14} />;
          default: return <TrendingUp size={14} />;
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 pt-3 px-4 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800 shadow-xl rounded-2xl h-16 flex items-center justify-between px-4">
            
            {/* Logo Section */}
            <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setViewMode('dashboard')}>
              <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                CoinBingo
              </span>
            </div>
            
            {/* Actions (Right) */}
            <div className="flex items-center gap-2">
               <button onClick={handleRefresh} className={`p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`}>
                 <RefreshCw className="w-5 h-5" />
               </button>
               <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all">
                 <Settings className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in-up">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg">{t.settings}</h3>
                    <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={toggleTheme} className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all gap-2">
                           <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm">{theme === 'dark' ? <Moon size={20} className="text-indigo-400"/> : <Sun size={20} className="text-orange-400"/>}</div>
                           <span className="text-sm font-medium">{t.theme}</span>
                        </button>
                        <button onClick={toggleLang} className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all gap-2">
                           <div className="flex items-center justify-center w-9 h-9 font-bold bg-white dark:bg-slate-700 rounded-full shadow-sm text-xs">
                             <Globe size={18}/>
                           </div>
                           <span className="text-sm font-medium">{lang === 'en' ? 'English' : '中文'}</span>
                        </button>
                    </div>
                </div>
             </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 pb-10">
        
        {/* Compact Search Hero */}
        {(viewMode === 'dashboard' || viewMode === 'analysis') && (
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
        )}

        {/* QUICK ACCESS NAVIGATION GRID */}
        <section className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
             <button 
                onClick={() => setViewMode('analysis')} 
                className={`p-3 md:p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${viewMode === 'analysis' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
             >
                <div className={`p-2 rounded-full ${viewMode === 'analysis' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-500 dark:text-indigo-400'}`}>
                    <Zap size={18} />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300">{t.analysis}</span>
             </button>

             <button 
                onClick={() => setViewMode('portfolio')} 
                className={`p-3 md:p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${viewMode === 'portfolio' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'}`}
             >
                <div className={`p-2 rounded-full ${viewMode === 'portfolio' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-500 dark:text-emerald-400'}`}>
                    <Wallet size={18} />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300">{t.portfolio}</span>
             </button>

             <button 
                onClick={() => setViewMode('tools')} 
                className={`p-3 md:p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${viewMode === 'tools' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700'}`}
             >
                <div className={`p-2 rounded-full ${viewMode === 'tools' ? 'bg-orange-500 text-white' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-500 dark:text-orange-400'}`}>
                    <LayoutGrid size={18} />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300">{t.tools}</span>
             </button>
        </section>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 flex items-center gap-3 text-red-600 dark:text-red-200 animate-fade-in"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{error}</p></div>}
        
        {loadingBasic && !error && <div className="h-96 w-full bg-white dark:bg-slate-900/50 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800/50 border-dashed"><div className="text-center space-y-4"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" /><p className="text-slate-500">{t.searching}</p></div></div>}

        {!loadingBasic && (
            <>
                {viewMode === 'dashboard' && (
                  <div className="space-y-8 animate-fade-in">
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
                           
                           <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                              {(['all', 'fav', 'eth', 'sol', 'bsc', 'arb'] as Category[]).map(cat => (
                                 <button
                                   key={cat}
                                   onClick={() => handleCategoryChange(cat)}
                                   className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                                 >
                                   {getCategoryIcon(cat)}
                                   <span className="truncate">{cat === 'all' ? t.catAll : cat === 'fav' ? t.catFav : cat === 'eth' ? t.catEth : cat === 'sol' ? t.catSol : cat === 'bsc' ? t.catBsc : t.catArb}</span>
                                 </button>
                              ))}
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {trendingCoins.map((coin) => (<CoinOverviewCard key={coin.id} coin={coin} onClick={onMarketLeaderClick} formatPrice={formatPrice} />))}
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
                  <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
                    
                    {/* Header Card */}
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT COLUMN: Chart & Strategy */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Chart Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md h-[500px]">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Activity className="w-3 h-3" />{t.chartTitle}</div>
                                <div className="h-[440px] w-full">
                                <PriceChart data={coinHistory} color={currentCoin.price_change_percentage_24h >= 0 ? '#10b981' : '#f43f5e'} />
                                </div>
                            </div>

                            {/* Strategy Section */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Short Term */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors h-fit">
                                    <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><Target className="w-5 h-5" /> {t.shortTerm}</h3>
                                    {loadingDeep ? <div className="space-y-4"><div className="h-10 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="grid grid-cols-3 gap-4"><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div></div></div> :
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"><span className="text-slate-500 dark:text-slate-400 font-medium">{t.direction}</span><span className={`font-bold ${analysis?.shortTerm?.direction === 'Long' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{analysis?.shortTerm?.direction === 'Long' ? `🟢 ${t.long}` : `🔴 ${t.short}`}</span></div>
                                        <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.entry}</div><div className="font-mono text-slate-900 dark:text-white text-xs font-semibold break-all">{analysis?.shortTerm?.entry || '-'}</div></div>
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-colors"><div className="text-[10px] text-emerald-600 dark:text-emerald-500/70 font-bold uppercase mb-1">{t.target}</div><div className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-semibold break-all">{analysis?.shortTerm?.target || '-'}</div></div>
                                        <div className="p-2 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-200 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700/50 transition-colors"><div className="text-[10px] text-rose-600 dark:text-rose-500/70 font-bold uppercase mb-1">{t.stop}</div><div className="font-mono text-rose-600 dark:text-rose-400 text-xs font-semibold break-all">{analysis?.shortTerm?.stop || '-'}</div></div>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800 p-3 rounded border-l-2 border-indigo-500">💡 {t.strategyNote}</div>
                                    </div>
                                    }
                                </div>

                                {/* Summary */}
                                <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-6 shadow-md transition-colors">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" /> {t.summary}</h3>
                                    {loadingDeep ? <div className="space-y-2"><div className="h-4 w-full bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div><div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div></div> : 
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm font-medium">{currentCoin.name} {analysis?.trend.status === '偏强' || analysis?.trend.status === 'Bullish' ? `${t.summaryBullish} ${formatPrice(analysis?.support || 0)}` : `${t.summaryBearish} ${formatPrice(analysis?.resistance || 0)}`}.</p>
                                    }
                                </div>
                            </div>
                            
                            {/* On-Chain Merged */}
                            <div className="mt-0">
                                <OnChainView coin={currentCoin} t={t} formatPrice={formatPrice} />
                            </div>

                            {/* RELATED NEWS */}
                            {coinNews.length > 0 && (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors">
                                    <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><Newspaper className="w-5 h-5" /> {t.relatedNews}</h3>
                                    <div className="space-y-4">
                                        {coinNews.map((news, idx) => (
                                            <a key={idx} href={news.url} target="_blank" rel="noopener noreferrer" className="block group">
                                                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    {news.imageurl && <img src={news.imageurl} alt="news" className="w-16 h-16 object-cover rounded-lg hidden sm:block" />}
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-indigo-500 transition-colors line-clamp-2">{news.title}</h4>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                            <span>{news.source_info?.name || news.author}</span>
                                                            <span>•</span>
                                                            <span>{new Date(news.created_at * 1000).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Indicators & Advice */}
                        <div className="space-y-6">
                            {/* HISTORICAL PRICE CARD */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-colors">
                                <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><History className="w-5 h-5" /> {t.histPrice}</h3>
                                <div className="space-y-4">
                                    {/* 24h Range */}
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                        <div className="text-xs text-slate-500 mb-1 font-bold">{t.range24h}</div>
                                        <div className="flex justify-between items-center text-sm font-mono text-slate-900 dark:text-white">
                                            <span>{formatPrice(currentCoin.low_24h)}</span>
                                            <div className="h-1 flex-1 mx-2 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                                                {/* Simple indicator dot based on current price relative position */}
                                                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-500 rounded-full" 
                                                    style={{ left: `${Math.min(Math.max((currentCoin.current_price - currentCoin.low_24h) / (currentCoin.high_24h - currentCoin.low_24h) * 100, 0), 100)}%` }}></div>
                                            </div>
                                            <span>{formatPrice(currentCoin.high_24h)}</span>
                                        </div>
                                    </div>

                                    {/* 7d Range */}
                                    {priceRange7d && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 font-bold">{t.range7d}</div>
                                            <div className="flex justify-between items-center text-sm font-mono text-slate-900 dark:text-white">
                                                <span>{formatPrice(priceRange7d.low)}</span>
                                                <div className="h-1 flex-1 mx-2 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                                                     <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full" 
                                                        style={{ left: `${Math.min(Math.max((currentCoin.current_price - priceRange7d.low) / (priceRange7d.high - priceRange7d.low) * 100, 0), 100)}%` }}></div>
                                                </div>
                                                <span>{formatPrice(priceRange7d.high)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ATH */}
                                    <div className="flex justify-between items-start py-2 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <div className="text-xs text-slate-500 font-bold">{t.ath}</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{formatPrice(currentCoin.ath)}</div>
                                            <div className="text-[10px] text-slate-400">{formatDate(currentCoin.ath_date)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-rose-500">{currentCoin.ath_change_percentage?.toFixed(2)}%</div>
                                        </div>
                                    </div>

                                    {/* ATL */}
                                    <div className="flex justify-between items-start py-2">
                                        <div>
                                            <div className="text-xs text-slate-500 font-bold">{t.atl}</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{formatPrice(currentCoin.atl)}</div>
                                            <div className="text-[10px] text-slate-400">{formatDate(currentCoin.atl_date)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-emerald-500">+{currentCoin.atl_change_percentage?.toFixed(2)}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Indicators */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md flex flex-col transition-colors">
                                <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5" /> {t.keyIndicators}</h3>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupTrend}</span>
                                    <div className="grid grid-cols-1 gap-2">
                                        <IndicatorCard icon={<TrendingUp size={14} />} label={t.indTrend} metric={analysis?.trend} />
                                        <IndicatorCard icon={<Activity size={14} />} label={t.indEma} metric={analysis?.ema} />
                                        <IndicatorCard icon={<Layers size={14} />} label={t.indStructure} metric={analysis?.structure} />
                                        <IndicatorCard icon={<Droplets size={14} />} label={t.indBollinger} metric={analysis?.bollinger} />
                                    </div>
                                    </div>
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupMomentum}</span>
                                        <div className="grid grid-cols-1 gap-2">
                                        <IndicatorCard icon={<Zap size={14} />} label={t.indMomentum} metric={analysis?.momentum} />
                                        <IndicatorCard icon={<Target size={14} />} label={t.indRsi} metric={analysis?.rsiMetric} />
                                        <IndicatorCard icon={<ArrowUpRight size={14} />} label={t.indMacd} metric={analysis?.macd} />
                                        <IndicatorCard icon={<BarChart size={14} />} label={t.indVolume} metric={analysis?.volume} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest pl-1">{t.groupOnChain}</span>
                                        <div className="grid grid-cols-1 gap-2">
                                        <IndicatorCard icon={<Coins size={14} />} label={t.indMvrv} metric={analysis?.mvrv} />
                                        <IndicatorCard icon={<BrainCircuit size={14} />} label={t.indNupl} metric={analysis?.nupl} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pro Advice */}
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
                
                {viewMode === 'tools' && (
                  <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
                      <CryptoConverter coins={converterCoins} t={t} formatPrice={formatPrice} />
                      <ProfitCalculator t={t} />
                  </div>
                )}

                {viewMode === 'portfolio' && (
                    <PortfolioView coins={converterCoins} t={t} formatPrice={formatPrice} />
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;
