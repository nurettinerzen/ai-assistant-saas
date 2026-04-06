'use client';

import React, { createContext, useContext } from 'react';

const DashboardContext = createContext(null);

/**
 * Provider component - wraps dashboard layout children
 * Shares user data loaded by layout to avoid duplicate API calls
 */
export function DashboardProvider({ user, children }) {
  return (
    <DashboardContext.Provider value={{ user }}>
      {children}
    </DashboardContext.Provider>
  );
}

/**
 * Hook to access dashboard context (user data from layout)
 * Returns null if used outside DashboardProvider
 */
export function useDashboardContext() {
  return useContext(DashboardContext);
}

export default DashboardContext;
