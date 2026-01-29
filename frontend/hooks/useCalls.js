import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch calls with filters
 * @param {object} params - Filter parameters (search, filter, sortBy, sortOrder, page, limit)
 * @returns {object} Query result with calls data
 */
export function useCalls(params) {
  return useQuery({
    queryKey: ['calls', params],
    queryFn: async () => {
      const response = await apiClient.calls.getAll(params);
      return {
        calls: response.data.calls || [],
        pagination: response.data.pagination || {},
        stats: response.data.stats || null,
      };
    },
    staleTime: 30000, // 30 seconds - calls data changes frequently
  });
}

/**
 * Hook to sync ElevenLabs conversations
 * @returns {object} Mutation object
 */
export function useSyncElevenLabsConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await apiClient.elevenlabs.syncConversations();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}
