
import { DataPoint } from './types';

export const COLORS = {
  temp: '#FF3B30',
  humidity: '#00FBFF',
  bg: '#0d1117',
};

// Generate initial mock history data for 24 hours
export const generateInitialData = (): DataPoint[] => {
  const data: DataPoint[] = [];
  const now = Date.now();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - i * 3600000);
    data.push({
      time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      timestamp: time.getTime(),
      temp: parseFloat((22 + Math.random() * 5).toFixed(1)),
      humidity: Math.floor(40 + Math.random() * 20),
    });
  }
  return data;
};
