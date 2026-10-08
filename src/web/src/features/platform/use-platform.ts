import { useQuery } from '@tanstack/react-query';
import type { AnnouncementQueryDto, ChargeQueryDto, TenantQueryDto } from '@servisapp/shared';
import { api } from '@/api/client';

/**
 * The sysadmin console's query keys and hooks (FR-SYS-*).
 *
 * Kept beside the console rather than in `api/hooks.ts` for the reason the console is a
 * separate shell at all: nothing under `/admin` reads a tenant registry or a subscription
 * plan, and a key file shared between the two would invite a screen to.
 *
 * ## Everything is invalidated by resource, never by hand
 *
 * `useResourceMutation` from `api/hooks` takes the keys a mutation affects. Assigning a
 * plan changes both the tenant and the plan's tenant count, which is why
 * {@link PLATFORM_TENANT_KEYS} exists: listing the affected resources at each call site
 * is how a screen ends up showing a stale count after the day somebody adds a third.
 */
export const platformKeys = {
  tenants: ['platform', 'tenants'] as const,
  plans: ['platform', 'plans'] as const,
  charges: ['platform', 'charges'] as const,
  retention: ['platform', 'retention'] as const,
  flags: ['platform', 'flags'] as const,
  announcements: ['platform', 'announcements'] as const,
  audit: ['platform', 'audit'] as const,
  health: ['platform', 'health'] as const,
  /** FR-SYS-080's audience side, which every shell reads — not only this one. */
  myAnnouncements: ['announcements', 'mine'] as const,
};

/** A plan assignment moves a tenant *and* a plan's tenant count. Both refetch. */
export const PLATFORM_TENANT_KEYS: readonly (readonly string[])[] = [
  platformKeys.tenants,
  platformKeys.plans,
  platformKeys.retention,
];

export function useTenants(query: TenantQueryDto) {
  return useQuery({
    queryKey: [...platformKeys.tenants, 'list', query] as const,
    queryFn: () => api.platform.tenants(query),
  });
}

export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: [...platformKeys.tenants, id ?? ''] as const,
    queryFn: () => api.platform.tenant(id as string),
    enabled: id !== undefined,
  });
}

export function usePlans(includeArchived = false) {
  return useQuery({
    queryKey: [...platformKeys.plans, { includeArchived }] as const,
    queryFn: () => api.platform.plans(includeArchived),
  });
}

export function useCharges(tenantId: string | undefined, query: ChargeQueryDto) {
  return useQuery({
    queryKey: [...platformKeys.charges, tenantId ?? '', query] as const,
    queryFn: () => api.platform.charges(tenantId as string, query),
    enabled: tenantId !== undefined,
  });
}

export function useRetention(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...platformKeys.retention, tenantId ?? ''] as const,
    queryFn: () => api.platform.retention(tenantId as string),
    enabled: tenantId !== undefined,
  });
}

export function useTenantFlags(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...platformKeys.flags, tenantId ?? ''] as const,
    queryFn: () => api.platform.flags(tenantId as string),
    enabled: tenantId !== undefined,
  });
}

export function useAnnouncements(query: AnnouncementQueryDto) {
  return useQuery({
    queryKey: [...platformKeys.announcements, query] as const,
    queryFn: () => api.platform.announcements(query),
  });
}

export function useTenantAudit(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...platformKeys.audit, tenantId ?? '', 'entries'] as const,
    queryFn: () => api.platform.audit(tenantId as string),
    enabled: tenantId !== undefined,
  });
}

export function useImpersonations(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...platformKeys.audit, tenantId ?? '', 'sessions'] as const,
    queryFn: () => api.platform.impersonations(tenantId as string),
    enabled: tenantId !== undefined,
  });
}

/**
 * FR-SYS-090's aggregate.
 *
 * Refetched every fifteen seconds while the screen is open: it is watched during an
 * incident, and a figure that only moves on a manual refresh is one an operator stops
 * trusting. The server's own window defaults to fifteen minutes, so this is a fresh read
 * of an already-smoothed number rather than a poll of a raw one.
 */
export function usePlatformHealth(windowMinutes: number) {
  return useQuery({
    queryKey: [...platformKeys.health, windowMinutes] as const,
    queryFn: () => api.platform.health(windowMinutes),
    refetchInterval: 15_000,
  });
}

/** FR-SYS-080 — what this caller's company should be shown, whatever their role. */
export function useMyAnnouncements() {
  return useQuery({
    queryKey: platformKeys.myAnnouncements,
    queryFn: () => api.announcements.mine(),
    // A notice published while somebody is working should reach them without a sign-out,
    // and one that has expired should stop showing. Five minutes is often enough for
    // both and rare enough to be invisible.
    refetchInterval: 300_000,
    // A shell that failed to render because a *notice* could not be fetched would be a
    // banner taking down the application it decorates.
    retry: false,
  });
}
