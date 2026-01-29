import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch batch calls
 * @returns {object} Query result with batch calls data
 */
export function useBatchCalls() {
  return useQuery({
    queryKey: ['batchCalls'],
    queryFn: async () => {
      const response = await apiClient.get('/api/batch-calls');
      return response.data.batchCalls || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to check batch calls access
 * @returns {object} Query result with access check
 */
export function useBatchCallsAccess() {
  return useQuery({
    queryKey: ['batchCalls', 'access'],
    queryFn: async () => {
      const response = await apiClient.get('/api/batch-calls/check-access');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create batch call
 * @returns {object} Mutation object
 */
export function useCreateBatchCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData) => {
      return await apiClient.post('/api/batch-calls', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchCalls'] });
    },
  });
}

/**
 * Hook to cancel batch call
 * @returns {object} Mutation object
 */
export function useCancelBatchCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchCallId) => {
      return await apiClient.post(`/api/batch-calls/${batchCallId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchCalls'] });
    },
  });
}
