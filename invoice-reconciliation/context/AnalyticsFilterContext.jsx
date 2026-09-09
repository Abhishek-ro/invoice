import React, { createContext, useContext, useState } from 'react';

const AnalyticsFilterContext = createContext();

export function AnalyticsFilterProvider({ children }) {
  const [filters, setFilters] = useState({
    dateRange: 'This Quarter',
    status: [],
    matchType: [],
    vendors: [],
    department: [],
    amountRange: [0, 500000],
    exceptions: [],
    currency: 'All'
  });

  const [savedViews, setSavedViews] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateFilter = (key, value) => {
    setIsUpdating(true);
    setFilters(prev => ({ ...prev, [key]: value }));
    setTimeout(() => setIsUpdating(false), 150);
  };

  const clearFilters = () => {
    setIsUpdating(true);
    setFilters({
      dateRange: 'This Quarter',
      status: [],
      matchType: [],
      vendors: [],
      department: [],
      amountRange: [0, 500000],
      exceptions: [],
      currency: 'All'
    });
    setTimeout(() => setIsUpdating(false), 150);
  };

  const saveView = (name) => {
    setSavedViews(prev => [...prev, { name, filters: { ...filters } }]);
  };

  const loadView = (view) => {
    setIsUpdating(true);
    setFilters(view.filters);
    setTimeout(() => setIsUpdating(false), 150);
  };

  return (
    <AnalyticsFilterContext.Provider value={{ filters, updateFilter, clearFilters, savedViews, saveView, loadView, isUpdating }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
}

export function useAnalyticsFilters() {
  return useContext(AnalyticsFilterContext);
}
