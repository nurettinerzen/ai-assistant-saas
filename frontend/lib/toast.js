/**
 * Toast Notification Helpers
 * Wrapper around Sonner for consistent toast notifications
 */

import { toast as sonnerToast } from 'sonner';

export const toast = {
  /**
   * Success toast
   * @param {string} message - Success message
   * @param {object} options - Additional options
   */
  success: (message, options = {}) => {
    return sonnerToast.success(message, {
      duration: 3000,
      ...options,
    });
  },

  /**
   * Error toast
   * @param {string} message - Error message
   * @param {object} options - Additional options
   */
  error: (message, options = {}) => {
    return sonnerToast.error(message, {
      duration: 4000,
      ...options,
    });
  },

  /**
   * Warning toast
   * @param {string} message - Warning message
   * @param {object} options - Additional options
   */
  warning: (message, options = {}) => {
    return sonnerToast.warning(message, {
      duration: 3500,
      ...options,
    });
  },

  /**
   * Info toast
   * @param {string} message - Info message
   * @param {object} options - Additional options
   */
  info: (message, options = {}) => {
    return sonnerToast.info(message, {
      duration: 3000,
      ...options,
    });
  },

  /**
   * Loading toast - Returns toast ID for later dismissal
   * @param {string} message - Loading message
   * @param {object} options - Additional options
   */
  loading: (message = 'Loading...', options = {}) => {
    return sonnerToast.loading(message, options);
  },

  /**
   * Promise toast - Automatically handles loading/success/error states
   * @param {Promise} promise - Promise to track
   * @param {object} messages - Messages for each state
   */
  promise: (promise, messages = {}) => {
    return sonnerToast.promise(promise, {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'Something went wrong',
    });
  },

  /**
   * Dismiss a specific toast by ID
   * @param {string|number} toastId - ID of toast to dismiss
   */
  dismiss: (toastId) => {
    if (toastId) {
      sonnerToast.dismiss(toastId);
    } else {
      sonnerToast.dismiss(); // Dismiss all
    }
  },

  /**
   * Custom toast with action button
   * @param {string} message - Toast message
   * @param {object} options - Toast options including action
   */
  custom: (message, options = {}) => {
    return sonnerToast(message, options);
  },
};

// Convenience methods for common use cases
export const toastHelpers = {
  /**
   * Show API error toast with formatted message
   * @param {Error} error - Error object from API
   */
  apiError: (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    toast.error(message);
  },

  /**
   * Show save success toast
   */
  saveSuccess: (itemName = 'Changes') => {
    toast.success(`${itemName} saved successfully!`);
  },

  /**
   * Show delete success toast
   */
  deleteSuccess: (itemName = 'Item') => {
    toast.success(`${itemName} deleted successfully!`);
  },

  /**
   * Show copy to clipboard toast
   */
  copied: () => {
    toast.success('Copied to clipboard!');
  },

  /**
   * Show async operation toast (loading -> success/error)
   * @param {Promise} promise - Promise to execute
   * @param {string} loadingMsg - Loading message
   * @param {string} successMsg - Success message
   */
  async: async (promise, loadingMsg = 'Processing...', successMsg = 'Done!') => {
    const toastId = toast.loading(loadingMsg);
    
    try {
      const result = await promise;
      toast.dismiss(toastId);
      toast.success(successMsg);
      return result;
    } catch (error) {
      toast.dismiss(toastId);
      toastHelpers.apiError(error);
      throw error;
    }
  },
};

export default toast;
