import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch current subscription
 * @returns {object} Query result with subscription data
 */
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: async () => {
      const response = await apiClient.subscription.getCurrent();
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch billing history
 * @returns {object} Query result with billing history
 */
export function useBillingHistory() {
  return useQuery({
    queryKey: ['subscription', 'billingHistory'],
    queryFn: async () => {
      const response = await apiClient.subscription.getBillingHistory();
      return response.data.history || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to upgrade subscription
 * @returns {object} Mutation object
 */
export function useUpgradeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId) => {
      return await apiClient.subscription.upgrade(planId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Hook to cancel subscription
 * @returns {object} Mutation object
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await apiClient.subscription.cancel();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}
