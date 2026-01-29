import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch analytics overview data
 * @param {string} timeRange - Time range filter (e.g., '7d', '30d')
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export function useAnalyticsOverview(timeRange = '7d') {
  return useQuery({
    queryKey: ['analytics', 'overview', timeRange],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/analytics/overview?range=${timeRange}`);
      return data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch peak hours data
 * @param {string} timeRange - Time range filter
 * @returns {object} Query result with hourly data
 */
export function usePeakHours(timeRange = '7d') {
  return useQuery({
    queryKey: ['analytics', 'peak-hours', timeRange],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/analytics/peak-hours?range=${timeRange}`);
      return data;
    },
    staleTime: 60000,
  });
}

/**
 * Hook to fetch top questions
 * @param {string} timeRange - Time range filter
 * @param {string} channel - Channel filter (optional)
 * @param {number} limit - Number of questions to fetch
 * @returns {object} Query result with top questions
 */
export function useTopQuestions(timeRange = '7d', channel = null, limit = 10) {
  const channelParam = channel ? `&channel=${channel}` : '';

  return useQuery({
    queryKey: ['analytics', 'top-questions', timeRange, channel, limit],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/api/analytics/top-questions?range=${timeRange}&limit=${limit}${channelParam}`
      );
      return data;
    },
    staleTime: 60000,
  });
}
