import { useQuery, type UseQueryResult } from '@tanstack/react-query';

/** Per-dependency status as returned by `GET /health` (SDD §18.3). */
export interface HealthDependency {
  status: 'up' | 'down';
  latencyMs?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: 'ok' | 'error' | 'shutting_down';
  info?: Record<string, HealthDependency>;
  error?: Record<string, HealthDependency>;
  details: Record<string, HealthDependency>;
}

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Fetches the health endpoint directly rather than through `apiFetch`.
 *
 * A degraded system answers 503 with the per-dependency detail, not with an
 * FR-INT-040 error body, and that detail is the entire point of the view. Treating
 * 503 as a failure here would show "service unavailable" precisely when the operator
 * needs to know *which* service.
 */
export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery<HealthResponse, Error>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const payload: unknown = await response.json();
      return payload as HealthResponse;
    },
    // The uptime monitor polls this too (SDD §18.3); a 10-second refresh is enough to
    // watch a dependency recover without adding meaningful load.
    refetchInterval: 10_000,
    staleTime: 0,
    retry: false,
  });
}
