import { ChartDataPoint, TechnicalAnalysis, IndicatorMetric, Language } from '../types';

// Simple RSI Calculation (14 periods)
const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// Standard Deviation for Bollinger Bands
const calculateStdDev = (data: number[], mean: number): number => {
  const squareDiffs = data.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
};

// Helper to format prices dynamically
const formatSignalPrice = (val: number) => {
  if (val < 0.00001) return val.toFixed(9); 
  if (val < 0.01) return val.toFixed(6);
  if (val < 1) return val.toFixed(4);
  return val.toFixed(2);
}

export const analyzeToken = (history: ChartDataPoint[], currentPrice: number, lang: Language): TechnicalAnalysis => {
  const isEn = lang === 'en';

  // Default fallback
  const fallbackMetric: IndicatorMetric = { status: "Neutral", desc: isEn ? "Insufficient data" : "数据不足" };
  
  if (!history || history.length === 0) {
    return {
      rsi: 50,
      rsiMetric: fallbackMetric,
      trend: fallbackMetric,
      momentum: fallbackMetric,
      ema: fallbackMetric,
      structure: fallbackMetric,
      volume: fallbackMetric,
      macd: fallbackMetric,
      bollinger: fallbackMetric,
      mvrv: fallbackMetric,
      nupl: fallbackMetric,
      support: 0,
      resistance: 0,
      advice: 'Hold',
      shortTerm: { direction: 'Long', entry: '-', target: '-', stop: '-' }
    };
  }

  const prices = history.map(h => h.price);
  const rsi = calculateRSI(prices);
  
  // -- Calculations --
  const last24Prices = prices.slice(-24);
  const sma24 = last24Prices.reduce((a, b) => a + b, 0) / last24Prices.length;
  
  const recentHistory = prices.slice(-72); // ~3 days
  const support = Math.min(...recentHistory);
  const resistance = Math.max(...recentHistory);

  // EMA Simulation (using SMA of recent vs older)
  const longTermPrices = prices.slice(-100);
  const smaLong = longTermPrices.reduce((a, b) => a + b, 0) / longTermPrices.length;
  
  // MACD Simulation
  const fastMA = prices.slice(-12).reduce((a, b) => a + b, 0) / 12;
  const slowMA = prices.slice(-26).reduce((a, b) => a + b, 0) / 26;
  const macdVal = fastMA - slowMA;

  // Bollinger Simulation
  const bbMean = sma24;
  const bbStd = calculateStdDev(last24Prices, bbMean);
  const bbUpper = bbMean + (2 * bbStd);
  const bbLower = bbMean - (2 * bbStd);

  // -- Metric Generation --

  // 1. Trend
  const isBullish = currentPrice > smaLong;
  const trendMetric: IndicatorMetric = {
    status: isBullish ? (isEn ? "Bullish" : "偏强") : (isEn ? "Bearish" : "偏弱"),
    desc: isBullish 
      ? (isEn ? "Price is stable above moving averages, bullish structure intact." : "价格站稳均线之上，多头结构完整。")
      : (isEn ? "Price is in a downtrend, testing key support levels repeatedly." : "价格近期处于下行通道，关键支撑多次被测试。")
  };

  // 2. Momentum
  const momVal = (currentPrice - prices[prices.length - 24]) / prices[prices.length - 24];
  const isStrongMom = Math.abs(momVal) > 0.03;
  const momentumMetric: IndicatorMetric = {
    status: isStrongMom ? (isEn ? "Strong" : "增强") : (isEn ? "Weak" : "转弱"),
    desc: isStrongMom
      ? (isEn ? "Active buying volume, strong short-term explosiveness." : "买盘资金活跃，短期爆发力强。")
      : (isEn ? "Sellers are dominant, buying power is weak." : "卖方力量占优，买盘回升乏力。")
  };

  // 3. EMA
  const emaMetric: IndicatorMetric = {
    status: isBullish ? (isEn ? "Golden Cross" : "多头排列") : (isEn ? "Death Cross" : "空头排列"),
    desc: isBullish 
      ? (isEn ? "Short-term MA crossed above long-term MA, support validated." : "短期均线金叉向上，支撑有效。")
      : (isEn ? "MAs are above price, acting as overhead resistance." : "中短期均线多数位于现价之上，压制明显。")
  };

  // 4. Structure
  const structureMetric: IndicatorMetric = {
    status: isBullish ? (isEn ? "Uptrend" : "上升结构") : (isEn ? "Downtrend" : "下跌结构"),
    desc: isBullish
      ? (isEn ? "Higher highs and higher lows formed." : "低点不断抬高，突破前高。")
      : (isEn ? "No clear reversal, lower highs forming." : "尚未出现明显反转，高点下移。")
  };

  // 5. Volume (Simulated, as we lack real volume bars in this simple history array, using volatility as proxy)
  const volatility = bbStd / bbMean;
  const volumeMetric: IndicatorMetric = {
    status: volatility > 0.05 ? (isEn ? "High Vol" : "放量") : (isEn ? "Neutral/Low" : "中性偏弱"),
    desc: volatility > 0.05 
      ? (isEn ? "Increased volatility, intense market activity." : "价格波动加剧，资金博弈激烈。")
      : (isEn ? "Low volatility, market is in wait-and-see mode." : "无明显放量，市场观望情绪浓厚。")
  };

  // 6. RSI
  let rsiStatus = isEn ? "Neutral" : "中性";
  if (rsi > 70) rsiStatus = isEn ? "Overbought" : "超买";
  else if (rsi < 30) rsiStatus = isEn ? "Oversold" : "超卖";
  else if (rsi < 45) rsiStatus = isEn ? "Weak Neutral" : "中性偏弱";
  else if (rsi > 55) rsiStatus = isEn ? "Strong Neutral" : "中性偏强";

  const rsiMetric: IndicatorMetric = {
    status: `${Math.round(rsi)} (${rsiStatus})`,
    desc: rsi < 40 
      ? (isEn ? "Near oversold zone, but reversal needs confirmation." : "接近超卖区，但反弹确认仍需观察。")
      : rsi > 60 
      ? (isEn ? "Near overbought zone, watch for pullback risks." : "接近超买区，注意回调风险。")
      : (isEn ? "Indicator in neutral zone, awaiting direction." : "指标位于合理区间，方向等待确认。")
  };

  // 7. MACD
  const macdMetric: IndicatorMetric = {
    status: macdVal > 0 ? (isEn ? "Bullish" : "金叉") : (isEn ? "Bearish" : "偏空"),
    desc: macdVal > 0 
      ? (isEn ? "Bullish momentum is releasing." : "多头动能开始释放。")
      : (isEn ? "Bearish momentum dominant, fast line below slow line." : "空头动能占主导，快线位于慢线下方。")
  };

  // 8. Bollinger
  let bbStatus = isEn ? "Mid-Band" : "中轨震荡";
  if (currentPrice > bbUpper * 0.99) bbStatus = isEn ? "Upper Band" : "接近上轨";
  else if (currentPrice < bbLower * 1.01) bbStatus = isEn ? "Lower Band" : "接近下轨";
  
  const bollingerMetric: IndicatorMetric = {
    status: bbStatus,
    desc: currentPrice < bbMean 
      ? (isEn ? "Price near lower band/below mid band - downside risk remains." : "价格接近下轨/中轨偏下 — 下行空间仍存在。")
      : (isEn ? "Price running above mid band, upside potential open." : "价格运行于中轨之上，上行空间打开。")
  };

  // 9. MVRV (Simulated based on Trend strength)
  const mvrvMetric: IndicatorMetric = {
    status: isBullish ? (isEn ? "Fair Value" : "合理") : (isEn ? "Undervalued" : "估值偏低"),
    desc: isBullish 
      ? (isEn ? "Market valuation in healthy growth range." : "市场估值处于合理增长区间。")
      : (isEn ? "Undervalued or fair - no signs of on-chain overvaluation." : "估值偏低或合理 — 链上暂无极端高估迹象。")
  };

  // 10. NUPL (Simulated based on Fear/Greed proxy via RSI)
  const nuplMetric: IndicatorMetric = {
    status: rsi < 40 ? (isEn ? "Fear" : "中性偏恐惧") : (isEn ? "Greed" : "中性偏贪婪"),
    desc: rsi < 40 
      ? (isEn ? "Market cautious, few holders in profit." : "市场短期信心谨慎，获利盘较少。")
      : (isEn ? "Market sentiment warming, some holders in profit." : "市场情绪回暖，部分持有者处于盈利状态。")
  };

  // -- Strategy Logic --
  let advice: 'Buy' | 'Sell' | 'Hold' = 'Hold';
  let direction: 'Long' | 'Short' = 'Long';
  
  if (rsi < 35 && support > currentPrice * 0.95) {
      advice = 'Buy';
      direction = 'Long';
  } else if (rsi > 70 && resistance < currentPrice * 1.05) {
      advice = 'Sell';
      direction = 'Short';
  } else if (trendMetric.status === "偏强" || trendMetric.status === "Bullish") {
      // Adjusted logic for English string matching
      if (momentumMetric.status === "增强" || momentumMetric.status === "Strong") {
        advice = 'Buy';
        direction = 'Long';
      } else {
        advice = 'Hold';
        direction = 'Long';
      }
  } else if (trendMetric.status === "偏弱" || trendMetric.status === "Bearish") {
       if (momentumMetric.status === "增强" || momentumMetric.status === "Strong") {
          advice = 'Sell';
          direction = 'Short';
       } else {
          advice = 'Hold';
          direction = 'Short';
       }
  } else {
      advice = 'Hold';
      direction = isBullish ? 'Long' : 'Short';
  }

  const entryHigh = direction === 'Long' ? currentPrice : currentPrice * 1.005;
  const entryLow = direction === 'Long' ? currentPrice * 0.995 : currentPrice;
  const entry = `${formatSignalPrice(entryLow)} - ${formatSignalPrice(entryHigh)}`;
  const targetPrice = direction === 'Long' ? currentPrice * 1.05 : currentPrice * 0.95;
  const stopPrice = direction === 'Long' ? support * 0.98 : resistance * 1.02;

  return {
    rsi,
    rsiMetric,
    trend: trendMetric,
    momentum: momentumMetric,
    ema: emaMetric,
    structure: structureMetric,
    volume: volumeMetric,
    macd: macdMetric,
    bollinger: bollingerMetric,
    mvrv: mvrvMetric,
    nupl: nuplMetric,
    support,
    resistance,
    advice,
    shortTerm: {
      direction,
      entry,
      target: formatSignalPrice(targetPrice),
      stop: formatSignalPrice(stopPrice)
    }
  };
};