import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch balance information
 * @returns {object} Query result with balance data
 */
export function useBalance() {
  return useQuery({
    queryKey: ['balance'],
    queryFn: async () => {
      // Try new balance API first, fall back to credits API
      try {
        const response = await apiClient.get('/api/balance');
        return { ...response.data, isNewSystem: true };
      } catch (err) {
        // Fallback to old credits API
        const response = await apiClient.get('/api/credits/balance');
        return { ...response.data, isNewSystem: false };
      }
    },
    staleTime: 30000, // 30 seconds - balance changes frequently
  });
}
