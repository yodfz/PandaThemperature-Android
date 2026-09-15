
export interface DataPoint {
  time: string;
  timestamp: number;
  temp: number;
  humidity: number;
}

export interface Stats {
  temp: {
    current: number;
    max: number;
    maxTime: string;
    min: number;
    minTime: string;
  };
  humidity: {
    current: number;
    max: number;
    maxTime: string;
    min: number;
    minTime: string;
  };
}

export enum NavItem {
  HOME = 'home',
  HISTORY = 'history',
  SETTINGS = 'settings'
}
