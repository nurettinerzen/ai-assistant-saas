import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch team members
 * @returns {object} Query result with members data
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const response = await apiClient.team.getMembers();
      return response.data.members || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch pending invitations
 * @returns {object} Query result with invitations data
 */
export function useTeamInvitations() {
  return useQuery({
    queryKey: ['team', 'invitations'],
    queryFn: async () => {
      try {
        const response = await apiClient.team.getInvitations();
        return response.data.invitations || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to send team invite
 * @returns {object} Mutation object
 */
export function useSendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteData) => {
      return await apiClient.team.sendInvite(inviteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
    },
  });
}

/**
 * Hook to update member role
 * @returns {object} Mutation object
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }) => {
      return await apiClient.team.updateRole(userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
  });
}

/**
 * Hook to remove team member
 * @returns {object} Mutation object
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId) => {
      return await apiClient.team.removeMember(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
  });
}

/**
 * Hook to cancel invite
 * @returns {object} Mutation object
 */
export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId) => {
      return await apiClient.team.cancelInvite(inviteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
    },
  });
}

/**
 * Hook to resend invite
 * @returns {object} Mutation object
 */
export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId) => {
      return await apiClient.team.resendInvite(inviteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
    },
  });
}
