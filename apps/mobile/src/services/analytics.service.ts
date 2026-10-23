import { request } from '../api/client';
import { AnalyticsPeriod, OwnerAnalyticsData } from '../types';

export const analyticsService = {
  getOwnerAnalytics: (
    token: string,
    period: AnalyticsPeriod = 'weekly',
    date?: string
  ): Promise<OwnerAnalyticsData> => {
    const params = new URLSearchParams({ period });
    if (date) params.append('date', date);
    return request<OwnerAnalyticsData>(`/owner/analytics?${params.toString()}`, {
      token
    });
  }
};
