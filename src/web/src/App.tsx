import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';

/**
 * Provider order is load-bearing.
 *
 * `AuthProvider` sits inside `QueryClientProvider` because it clears the cache on sign-out
 * and on a tenant switch — a session change must not leave one company's rows in a cache
 * the next screen reads. It sits outside `RouterProvider` because every route consumes
 * the session, including the guard that decides which route may render at all.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
