
export type Language = 'en' | 'zh';

export interface GlobalData {
  data: {
    total_market_cap: { [key: string]: number };
    total_volume: { [key: string]: number };
    market_cap_percentage: { [key: string]: number };
  };
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  fully_diluted_valuation?: number;
  sparkline_in_7d?: { price: number[] };
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
}

export interface MarketChartResponse {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface NewsItem {
  title: string;
  url: string;
  description: string;
  author: string;
  created_at: number;
  imageurl?: string;
  source_info?: {
    name: string;
    img?: string;
  };
}

export interface FearGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

export interface IndicatorMetric {
  status: string;
  desc: string;
}

export interface TechnicalAnalysis {
  rsi: number;
  rsiMetric: IndicatorMetric;
  trend: IndicatorMetric;
  momentum: IndicatorMetric;
  ema: IndicatorMetric;
  structure: IndicatorMetric;
  volume: IndicatorMetric;
  macd: IndicatorMetric;
  bollinger: IndicatorMetric;
  mvrv: IndicatorMetric;
  nupl: IndicatorMetric;
  
  support: number;
  resistance: number;
  advice: 'Buy' | 'Sell' | 'Hold';
  shortTerm: {
    direction: 'Long' | 'Short';
    entry: string;
    target: string;
    stop: string;
  };
}

export interface OnChainData {
  unlockProgress: number; // 0-100
  lockedPercent: number;
  whaleActivity: 'Low' | 'Medium' | 'High' | 'Very High';
  whaleScore: number; // 0-100
  netFlowStatus: 'Inflow' | 'Outflow' | 'Neutral';
  netFlowScore: number; // -100 to 100
  holders: number;
  fdvGap: number; // Ratio of FDV / Market Cap
}

export interface PortfolioItem {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  avgBuyPrice: number;
  source: 'manual' | 'wallet'; // Distinguish between manually added and wallet fetched
  priceChange24h?: number; // For wallet items to show daily PnL
}

export type Category = 'fav' | 'all' | 'eth' | 'sol' | 'bsc' | 'arb';

export type ViewMode = 'dashboard' | 'analysis' | 'tools' | 'portfolio';
