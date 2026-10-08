import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

/**
 * Server state lives here and nowhere else. Zustand holds UI state only, never server
 * data (SDD §15.2).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // A 4xx will not become a 2xx by asking again; retrying an authorisation
        // failure just multiplies the audit entries.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Mutations are never retried automatically. The server is the only authority on
      // money and attendance (SDD §1.2 P3), and a blind retry risks a double effect
      // where the endpoint is not idempotent.
      retry: false,
    },
  },
});
