
import React from 'react';
import { Stats } from '../types';

interface Props {
  stats: Stats;
}

const DashboardCard: React.FC<Props> = ({ stats }) => {
  return (
    <section className="bg-white/[0.04] p-5 rounded-lg">
      <div className="grid grid-cols-2 gap-6">
        {/* Temperature Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-vibrant-red text-sm">thermostat</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">当前温度</p>
          </div>
          <div className="flex items-baseline">
            <span className="text-4xl font-bold tracking-tight text-vibrant-red">{stats.temp.current.toFixed(1)}</span>
            <span className="text-lg font-bold text-vibrant-red/80 ml-1">°C</span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center text-[10px] text-slate-400 whitespace-nowrap">
              <span className="font-bold text-vibrant-red mr-1">最高:</span>
              <span>{stats.temp.max}°C</span>
              <span className="ml-1 opacity-60">{stats.temp.maxTime}</span>
            </div>
            <div className="flex items-center text-[10px] text-slate-400 whitespace-nowrap">
              <span className="font-bold text-slate-500 mr-1">最低:</span>
              <span>{stats.temp.min}°C</span>
              <span className="ml-1 opacity-60">{stats.temp.minTime}</span>
            </div>
          </div>
        </div>

        {/* Humidity Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-vibrant-cyan text-sm">humidity_mid</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">当前湿度</p>
          </div>
          <div className="flex items-baseline">
            <span className="text-4xl font-bold tracking-tight text-vibrant-cyan">{stats.humidity.current}</span>
            <span className="text-lg font-bold text-vibrant-cyan/80 ml-1">%</span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center text-[10px] text-slate-400 whitespace-nowrap">
              <span className="font-bold text-vibrant-cyan mr-1">最高:</span>
              <span>{stats.humidity.max}%</span>
              <span className="ml-1 opacity-60">{stats.humidity.maxTime}</span>
            </div>
            <div className="flex items-center text-[10px] text-slate-400 whitespace-nowrap">
              <span className="font-bold text-slate-500 mr-1">最低:</span>
              <span>{stats.humidity.min}%</span>
              <span className="ml-1 opacity-60">{stats.humidity.minTime}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardCard;
