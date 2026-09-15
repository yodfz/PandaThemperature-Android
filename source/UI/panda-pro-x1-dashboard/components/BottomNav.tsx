
import React from 'react';
import { NavItem } from '../types';

interface Props {
  activeTab: NavItem;
  onTabChange: (tab: NavItem) => void;
}

const BottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0d1117]/90 backdrop-blur-xl border-t border-white/[0.05] pb-8 pt-3 flex justify-around items-center z-50">
      <button 
        onClick={() => onTabChange(NavItem.HOME)}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === NavItem.HOME ? 'text-vibrant-cyan' : 'text-slate-500'}`}
      >
        <span className={`material-symbols-outlined text-[24px] ${activeTab === NavItem.HOME ? 'material-symbols-fill' : ''}`}>home</span>
        <span className="text-[10px] font-bold">首页</span>
      </button>
      
      <button 
        onClick={() => onTabChange(NavItem.HISTORY)}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === NavItem.HISTORY ? 'text-vibrant-cyan' : 'text-slate-500'}`}
      >
        <span className={`material-symbols-outlined text-[24px] ${activeTab === NavItem.HISTORY ? 'material-symbols-fill' : ''}`}>history</span>
        <span className="text-[10px] font-medium">历史</span>
      </button>
      
      <button 
        onClick={() => onTabChange(NavItem.SETTINGS)}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === NavItem.SETTINGS ? 'text-vibrant-cyan' : 'text-slate-500'}`}
      >
        <span className={`material-symbols-outlined text-[24px] ${activeTab === NavItem.SETTINGS ? 'material-symbols-fill' : ''}`}>settings</span>
        <span className="text-[10px] font-medium">设置</span>
      </button>
    </nav>
  );
};

export default BottomNav;
