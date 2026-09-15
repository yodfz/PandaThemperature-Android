
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 bg-[#0d1117]/80 backdrop-blur-md border-b border-white/[0.05]">
      <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-vibrant-cyan">
            <span className="material-symbols-outlined text-[18px]">bluetooth</span>
            <h1 className="text-sm font-bold tracking-tight text-white">Panda-Pro-X1</h1>
          </div>
          <p className="text-[10px] text-emerald-500 font-medium ml-6">
            工作中 · 数据实时接收
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 opacity-90">
              <span className="text-[11px] font-mono font-bold text-white">84%</span>
              <span className="material-symbols-outlined text-[18px] text-emerald-500 material-symbols-fill">battery_full</span>
            </div>
            <span className="text-[9px] font-mono text-slate-400">3.75V</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
