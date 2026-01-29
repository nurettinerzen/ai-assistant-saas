import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch all documents
 * @returns {object} Query result with documents
 */
export function useDocuments() {
  return useQuery({
    queryKey: ['knowledge', 'documents'],
    queryFn: async () => {
      const { data } = await apiClient.knowledge.getDocuments();
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - documents don't change often
  });
}

/**
 * Hook to fetch all FAQs
 * @returns {object} Query result with FAQs
 */
export function useFaqs() {
  return useQuery({
    queryKey: ['knowledge', 'faqs'],
    queryFn: async () => {
      const { data } = await apiClient.knowledge.getFaqs();
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch a single document
 * @param {string} documentId - Document ID
 * @returns {object} Query result
 */
export function useDocument(documentId) {
  return useQuery({
    queryKey: ['knowledge', 'document', documentId],
    queryFn: async () => {
      const { data } = await apiClient.knowledge.getDocument(documentId);
      return data;
    },
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to upload a document
 * @returns {object} Mutation object
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData) => {
      return await apiClient.knowledge.uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

/**
 * Hook to delete a document
 * @returns {object} Mutation object
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId) => {
      return await apiClient.knowledge.deleteDocument(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

/**
 * Hook to create FAQ
 * @returns {object} Mutation object
 */
export function useCreateFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (faqData) => {
      return await apiClient.knowledge.createFaq(faqData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}

/**
 * Hook to delete FAQ
 * @returns {object} Mutation object
 */
export function useDeleteFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (faqId) => {
      return await apiClient.knowledge.deleteFaq(faqId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}
