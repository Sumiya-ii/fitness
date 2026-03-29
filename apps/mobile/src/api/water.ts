import { api } from './client';
import { getDeviceTimezone } from '../utils/timezone';

export interface WaterEntry {
  id: string;
  amountMl: number;
  loggedAt: string;
}

export interface WaterDailyData {
  consumed: number;
  target: number;
  entries: WaterEntry[];
}

export const waterApi = {
  add: (amountMl: number, loggedAt?: string) =>
    api.post<{ data: WaterEntry }>('/water-logs', loggedAt ? { amountMl, loggedAt } : { amountMl }),

  getDaily: (date?: string) => {
    const params = new URLSearchParams({ tz: getDeviceTimezone() });
    if (date) params.set('date', date);
    return api.get<{ data: WaterDailyData }>(`/water-logs?${params}`);
  },

  deleteLast: () => {
    const tz = encodeURIComponent(getDeviceTimezone());
    return api.delete<{ data: { deleted: boolean } }>(`/water-logs/last?tz=${tz}`);
  },
};
