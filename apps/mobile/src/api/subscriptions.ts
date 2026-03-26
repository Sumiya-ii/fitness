import { api } from './client';

export interface SubscriptionStatus {
  tier: 'free' | 'pro';
  status: string;
  currentPeriodEnd: string | null;
}

export const subscriptionsApi = {
  getStatus: () => api.get<{ data: SubscriptionStatus }>('/subscriptions/status'),
};
