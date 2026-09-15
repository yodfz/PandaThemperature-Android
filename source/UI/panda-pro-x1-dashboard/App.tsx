
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import DashboardCard from './components/DashboardCard';
import TrendChart from './components/TrendChart';
import HistoryList from './components/HistoryList';
import BottomNav from './components/BottomNav';
import { DataPoint, Stats, NavItem } from './types';
import { generateInitialData } from './constants';

const App: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.HOME);
  const [stats, setStats] = useState<Stats | null>(null);

  // Initialize data once on mount
  useEffect(() => {
    const initialData = generateInitialData();
    setData(initialData);
  }, []);

  // Calculate statistics whenever data changes
  const calculateStats = useCallback((readings: DataPoint[]): Stats => {
    if (readings.length === 0) {
      return {
        temp: { current: 0, max: 0, maxTime: '00:00', min: 0, minTime: '00:00' },
        humidity: { current: 0, max: 0, maxTime: '00:00', min: 0, minTime: '00:00' }
      };
    }

    const current = readings[readings.length - 1];
    const temps = readings.map(r => r.temp);
    const humidities = readings.map(r => r.humidity);

    const maxTempIndex = temps.indexOf(Math.max(...temps));
    const minTempIndex = temps.indexOf(Math.min(...temps));
    const maxHumidIndex = humidities.indexOf(Math.max(...humidities));
    const minHumidIndex = humidities.indexOf(Math.min(...humidities));

    return {
      temp: {
        current: current.temp,
        max: parseFloat(temps[maxTempIndex].toFixed(1)),
        maxTime: readings[maxTempIndex].time,
        min: parseFloat(temps[minTempIndex].toFixed(1)),
        minTime: readings[minTempIndex].time
      },
      humidity: {
        current: current.humidity,
        max: humidities[maxHumidIndex],
        maxTime: readings[maxHumidIndex].time,
        min: humidities[minHumidIndex],
        minTime: readings[minHumidIndex].time
      }
    };
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      setStats(calculateStats(data));
    }
  }, [data, calculateStats]);

  // Simulate real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1];
        const newReading: DataPoint = {
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          timestamp: Date.now(),
          // Small fluctuations
          temp: parseFloat((last.temp + (Math.random() - 0.5) * 0.4).toFixed(1)),
          humidity: Math.min(100, Math.max(0, Math.floor(last.humidity + (Math.random() - 0.5) * 2)))
        };
        
        const newData = [...prev.slice(1), newReading]; // Keep last 25 readings
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="min-h-screen pb-32">
      <Header />
      
      <main className="max-w-md mx-auto px-4 pt-2 space-y-4">
        {activeTab === NavItem.HOME && (
          <>
            <DashboardCard stats={stats} />
            <TrendChart data={data} />
            <HistoryList data={data} />
          </>
        )}

        {activeTab === NavItem.HISTORY && (
          <div className="flex flex-col items-center justify-center pt-20 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
            <p className="text-sm">查看完整历史数据记录</p>
          </div>
        )}

        {activeTab === NavItem.SETTINGS && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold px-1">设备设置</h2>
            <div className="bg-white/[0.04] rounded-lg p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">数据刷新频率</span>
                <span className="text-xs text-primary font-bold">5s (实时)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">单位设置</span>
                <span className="text-xs text-primary font-bold">摄氏度 (°C)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">异常告警</span>
                <span className="text-xs text-slate-500">已开启</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
