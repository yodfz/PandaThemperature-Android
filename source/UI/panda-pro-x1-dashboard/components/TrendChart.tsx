
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { DataPoint } from '../types';
import { COLORS } from '../constants';

interface Props {
  data: DataPoint[];
}

const TrendChart: React.FC<Props> = ({ data }) => {
  return (
    <section className="bg-white/[0.04] rounded-lg overflow-hidden flex flex-col h-[300px]">
      <div className="px-5 pt-5 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-500">趋势分析 (24h)</h3>
        <div className="flex gap-4 text-[10px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-vibrant-red"></span>温度
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-vibrant-cyan"></span>湿度
          </span>
        </div>
      </div>
      
      <div className="flex-1 w-full mt-4 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.temp} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.temp} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorHumid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.humidity} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.humidity} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 9, fill: '#64748b' }}
              interval={Math.floor(data.length / 4)}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey="temp" 
              stroke={COLORS.temp} 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorTemp)" 
              animationDuration={1500}
            />
            <Area 
              type="monotone" 
              dataKey="humidity" 
              stroke={COLORS.humidity} 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorHumid)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default TrendChart;
