import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Hook to fetch customer data files
 * @returns {object} Query result with files data
 */
export function useCustomerDataFiles() {
  return useQuery({
    queryKey: ['customerData', 'files'],
    queryFn: async () => {
      const response = await apiClient.customerData.getFiles();
      return response.data.files || [];
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch records from a specific file
 * @param {number} fileId - File ID
 * @param {object} params - Query parameters (page, limit, search)
 * @returns {object} Query result with records data
 */
export function useCustomerDataRecords(fileId, params) {
  return useQuery({
    queryKey: ['customerData', 'records', fileId, params],
    queryFn: async () => {
      const response = await apiClient.customerData.getFile(fileId, params);
      return {
        records: response.data.records || [],
        pagination: response.data.pagination || {},
      };
    },
    enabled: !!fileId,
    staleTime: 30000, // 30 seconds - records change frequently
  });
}

/**
 * Hook to delete a customer data file
 * @returns {object} Mutation object
 */
export function useDeleteCustomerDataFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId) => {
      return await apiClient.customerData.deleteFile(fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'files'] });
    },
  });
}

/**
 * Hook to upload customer data file
 * @returns {object} Mutation object
 */
export function useUploadCustomerDataFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formData }) => {
      return await apiClient.customerData.uploadFile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'files'] });
    },
  });
}

/**
 * Hook to import customer data file
 * @returns {object} Mutation object
 */
export function useImportCustomerDataFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData) => {
      return await apiClient.customerData.importFile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'files'] });
    },
  });
}

/**
 * Hook to add a record to a file
 * @returns {object} Mutation object
 */
export function useAddCustomerDataRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, data }) => {
      return await apiClient.customerData.addRecord(fileId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'records', variables.fileId] });
    },
  });
}

/**
 * Hook to update a record
 * @returns {object} Mutation object
 */
export function useUpdateCustomerDataRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, recordId, data }) => {
      return await apiClient.customerData.updateRecord(fileId, recordId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'records', variables.fileId] });
    },
  });
}

/**
 * Hook to delete a record
 * @returns {object} Mutation object
 */
export function useDeleteCustomerDataRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, recordId }) => {
      return await apiClient.customerData.deleteRecord(fileId, recordId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'records', variables.fileId] });
    },
  });
}

/**
 * Hook to bulk delete records
 * @returns {object} Mutation object
 */
export function useBulkDeleteCustomerDataRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, recordIds }) => {
      return await apiClient.customerData.bulkDelete(fileId, recordIds);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customerData', 'records', variables.fileId] });
    },
  });
}
