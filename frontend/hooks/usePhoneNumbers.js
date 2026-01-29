import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch phone numbers
 * @returns {object} Query result with phone numbers data
 */
export function usePhoneNumbers() {
  return useQuery({
    queryKey: ['phoneNumbers'],
    queryFn: async () => {
      const response = await apiClient.phoneNumbers.getAll();
      return response.data.phoneNumbers || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to buy phone number
 * @returns {object} Mutation object
 */
export function useBuyPhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await apiClient.phoneNumbers.buy(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}

/**
 * Hook to release phone number
 * @returns {object} Mutation object
 */
export function useReleasePhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phoneNumberId) => {
      return await apiClient.phoneNumbers.release(phoneNumberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}

/**
 * Hook to assign phone number to assistant
 * @returns {object} Mutation object
 */
export function useAssignPhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phoneNumberId, assistantId }) => {
      return await apiClient.phoneNumbers.assign(phoneNumberId, assistantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}
