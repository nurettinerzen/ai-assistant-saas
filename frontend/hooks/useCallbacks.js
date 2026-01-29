import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch all callbacks
 * @returns {object} Query result with callbacks data
 */
export function useCallbacks() {
  return useQuery({
    queryKey: ['callbacks'],
    queryFn: async () => {
      const { data } = await apiClient.callbacks.getAll();
      return data;
    },
    staleTime: 30000, // 30 seconds - callbacks update frequently
  });
}

/**
 * Hook to fetch callback stats
 * @returns {object} Query result with stats
 */
export function useCallbackStats() {
  return useQuery({
    queryKey: ['callbacks', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.callbacks.getStats();
      return data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to update callback status
 * @returns {object} Mutation object
 */
export function useUpdateCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      return await apiClient.callbacks.update(id, updates);
    },
    onSuccess: () => {
      // Invalidate both callbacks and stats
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
}

/**
 * Hook to retry a callback
 * @returns {object} Mutation object
 */
export function useRetryCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callbackId) => {
      return await apiClient.callbacks.retry(callbackId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
}
