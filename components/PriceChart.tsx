import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ChartDataPoint } from '../types';

interface PriceChartProps {
  data: ChartDataPoint[];
  color?: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ data, color = "#22d3ee" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-slate-500 text-xs">No chart data</p>
      </div>
    );
  }

  // Smart formatter for chart axis and tooltips
  const formatPrice = (value: number) => {
    if (value < 0.00001) return `$${value.toFixed(8)}`;
    if (value < 0.01) return `$${value.toFixed(6)}`;
    if (value < 1) return `$${value.toFixed(4)}`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            stroke="#64748b" 
            tick={{fontSize: 10}}
            minTickGap={30}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tickFormatter={formatPrice} 
            stroke="#64748b" 
            tick={{fontSize: 10}}
            width={60} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value: number) => [formatPrice(value), 'Price']}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPrice)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceChart;