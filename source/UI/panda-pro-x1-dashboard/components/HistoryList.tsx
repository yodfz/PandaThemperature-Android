
import React from 'react';
import { DataPoint } from '../types';

interface Props {
  data: DataPoint[];
}

const HistoryList: React.FC<Props> = ({ data }) => {
  // Sort data to show latest first and take top 5
  const latestData = [...data].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">历史预览</h3>
        <button className="text-[10px] font-bold text-primary flex items-center">
          全部 <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </button>
      </div>
      
      <div className="space-y-0.5 rounded-lg overflow-hidden">
        {latestData.map((item, idx) => {
          const date = new Date(item.timestamp);
          const formattedDate = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
          const formattedTime = date.toLocaleTimeString('zh-CN', { hour12: false });
          
          return (
            <div key={item.timestamp} className="bg-white/[0.04] px-5 py-4 flex items-center justify-between border-b border-white/[0.02] last:border-0">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-200">{formattedDate}</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tighter">{formattedTime}</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 mb-0.5 uppercase">温度</p>
                  <p className="text-xs font-bold text-vibrant-red">{item.temp.toFixed(1)}°C</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 mb-0.5 uppercase">湿度</p>
                  <p className="text-xs font-bold text-vibrant-cyan">{item.humidity}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HistoryList;
