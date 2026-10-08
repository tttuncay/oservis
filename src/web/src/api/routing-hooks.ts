import { useQuery } from '@tanstack/react-query';
import type { GenerationRunQueryDto, TripQueryDto } from '@servisapp/shared';
import { api } from './client';

/**
 * Routing and absence queries — FR-RTE-*, FR-ABS-*.
 *
 * Its own module beside `finance-hooks.ts`, for the reason that one exists: the routing
 * surface is a coherent group and appending it to `hooks.ts` would make a file that is
 * already long harder to find anything in.
 *
 * ## Nothing here polls
 *
 * FR-RTE-100: *"computed routes shall be cached and shall not be recomputed on repeated
 * viewing"*. A refetch interval on the trip detail would defeat that at the client end —
 * the server would answer from `trips` each time and cost nothing, but the habit is the
 * one SDD §8.3 names as the way to generate millions of requests, and the screen has
 * nothing that changes on its own until Phase 7's live tracking arrives.
 */
export const routingKeys = {
  trips: ['trips'] as const,
  generationRuns: ['generation-runs'] as const,
  routingSettings: ['routing-settings'] as const,
  absences: ['absences'] as const,
};

/** Every key a route mutation can affect: the trip itself and the list it appears in. */
export const TRIP_KEYS: readonly (readonly string[])[] = [
  routingKeys.trips,
  routingKeys.generationRuns,
];

export function useTrips(query: TripQueryDto) {
  return useQuery({
    queryKey: [...routingKeys.trips, 'list', query] as const,
    queryFn: () => api.routing.list(query),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: [...routingKeys.trips, 'detail', id ?? ''] as const,
    queryFn: () => api.routing.get(id as string),
    enabled: id !== undefined,
  });
}

/** FR-RTE-070/080/090's admin surface until the notification module lands in Phase 8. */
export function useGenerationRuns(query: GenerationRunQueryDto) {
  return useQuery({
    queryKey: [...routingKeys.generationRuns, 'list', query] as const,
    queryFn: () => api.routing.runs(query),
  });
}

export function useRoutingSettings() {
  return useQuery({
    queryKey: routingKeys.routingSettings,
    queryFn: () => api.routing.settings.get(),
  });
}
