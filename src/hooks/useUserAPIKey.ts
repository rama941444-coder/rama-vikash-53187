import { useState, useEffect, useCallback } from 'react';

const API_KEY_STORAGE_KEY = 'user_google_ai_api_key';

export const useUserAPIKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      setApiKey(stored);
    } catch {
      setApiKey(null);
    }

    // Listen for storage changes (in case user updates key in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === API_KEY_STORAGE_KEY) {
        setApiKey(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const refreshKey = useCallback(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      setApiKey(stored);
    } catch {
      setApiKey(null);
    }
  }, []);

  return { apiKey, refreshKey };
};

// Standalone function to get API key synchronously
export const getStoredAPIKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};
