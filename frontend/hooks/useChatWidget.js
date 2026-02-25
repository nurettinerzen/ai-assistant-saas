import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Hook to fetch chat widget settings
 * @returns {object} Query result with chat widget settings
 */
export function useChatWidgetSettings() {
  return useQuery({
    queryKey: ['chatWidget', 'settings'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business/chat-widget`, {
        withCredentials: true,
      });
      return {
        embedKey: response.data.embedKey || '',
        enabled: response.data.enabled || false,
        chatAssistantId: response.data.chatAssistantId || '',
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch chat widget statistics
 * @returns {object} Query result with chat stats
 */
export function useChatStats() {
  return useQuery({
    queryKey: ['chatWidget', 'stats'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/chat-logs/stats`, {
        withCredentials: true,
      });
      return {
        totalChats: response.data.totalChats || 0,
        totalMessages: response.data.totalMessages || 0,
        avgMessagesPerChat: response.data.avgMessagesPerChat || 0,
        todayChats: response.data.todayChats || 0,
      };
    },
    staleTime: 30000, // 30 seconds - stats change frequently
  });
}

/**
 * Hook to update chat widget settings
 * @returns {object} Mutation object
 */
export function useUpdateChatWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enabled, chatAssistantId }) => {
      return await axios.put(`${API_URL}/api/business/chat-widget`, {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(chatAssistantId !== undefined ? { chatAssistantId } : {})
      }, {
        withCredentials: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatWidget'] });
    },
  });
}
