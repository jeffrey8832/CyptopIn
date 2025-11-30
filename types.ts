
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
  last_updated: string;
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

// Added 'fav'
export type Category = 'fav' | 'all' | 'eth' | 'sol' | 'bsc' | 'arb';