import { api } from './client';

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
    const params = date ? `?date=${date}` : '';
    return api.get<{ data: WaterDailyData }>(`/water-logs${params}`);
  },

  deleteLast: () => api.delete<{ data: { deleted: boolean } }>('/water-logs/last'),
};
