import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginResponse, MeResponse, Role, TenantMembership } from '@servisapp/shared';
import { api } from '@/api/client';
import { deviceId, useSessionStore } from './session-store';

interface AuthContextValue {
  me: MeResponse | null;
  /** The membership the current token is scoped to, or null before one is chosen. */
  membership: TenantMembership | null;
  role: Role | null;
  restoring: boolean;
  consentRequired: boolean;
  signIn(email: string, password: string): Promise<LoginResponse>;
  signOut(): Promise<void>;
  selectTenant(tenantId: string): Promise<void>;
  refreshMe(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The session, as the rest of the console sees it (SDD §15.1 `auth/`).
 *
 * ## Restoring a session on load
 *
 * A reload leaves only the refresh token, so the provider exchanges it for an access
 * token before rendering anything that could issue a query. Until that settles,
 * `restoring` is true and the router shows nothing — rendering a screen first would
 * fire a page of unauthenticated requests and flash the login form at somebody who is
 * signed in.
 *
 * ## The tenant on the token
 *
 * SDD §4.3: an identity with exactly one usable membership is scoped automatically; one
 * with several gets a token carrying no tenant and chooses. That decision is the
 * server's — this provider reads the outcome rather than making it, which is why
 * `membership` is derived from `me.memberships` and the token's tenant rather than
 * remembered separately.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const {
    me,
    tenantId,
    restoring,
    consentRequired,
    setTokens,
    setMe,
    setTenantId,
    setConsentRequired,
    finishRestoring,
    clear,
  } = useSessionStore();

  const loadMe = useCallback(async () => {
    const response = await api.auth.me();
    setMe(response);
    return response;
  }, [setMe]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const { refreshToken } = useSessionStore.getState();
      if (!refreshToken) {
        finishRestoring();
        return;
      }

      try {
        const tokens = await api.auth.refresh({ refreshToken, deviceId: deviceId() });
        if (cancelled) return;
        setTokens(tokens, useSessionStore.getState().tenantId);

        const response = await loadMe();
        if (cancelled) return;
        // A single usable membership means the server already scoped the token to it,
        // so the console can show that company without asking.
        setTenantId(soleUsableMembership(response)?.tenantId ?? null);

        try {
          const pending = await api.consent.pending();
          if (cancelled) return;
          setConsentRequired(pending.documents.length > 0);
        } catch {
          // Handled by the interceptor on the first guarded call if unreachable.
        }
      } catch {
        // An expired or revoked refresh token is the ordinary case here, not an
        // exception worth surfacing: it is what a session older than twelve hours
        // looks like (NFR-SEC-090).
        if (!cancelled) clear();
      } finally {
        if (!cancelled) finishRestoring();
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
    // Once, on mount. The dependencies are stable store setters.
  }, [clear, finishRestoring, loadMe, setConsentRequired, setTenantId, setTokens]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.login({
        surface: 'web',
        email,
        password,
        deviceId: deviceId(),
      });

      // FR-FLG-030 and FR-AUTH-030 — a 200 with no tokens. The caller renders the
      // notice rather than an error, so this is not a throw.
      if (response.tokens) {
        setTokens(response.tokens, null);
        setMe(response.me);
        setTenantId(soleUsableMembership(response.me)?.tenantId ?? null);

        try {
          const pending = await api.consent.pending();
          setConsentRequired(pending.documents.length > 0);
        } catch {
          // Handled by the interceptor if pending check fails.
        }
      }

      return response;
    },
    [setConsentRequired, setMe, setTenantId, setTokens],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout({ deviceId: deviceId(), allDevices: false });
    } catch {
      // A failed revocation must not strand the user on a screen they asked to leave.
      // The local credential is discarded either way, and the token expires on its own.
    }
    clear();
    // Server data belongs to the session that fetched it. Leaving it cached would show
    // one tenant's students to whoever signs in next on this browser.
    queryClient.clear();
  }, [clear, queryClient]);

  const selectTenant = useCallback(
    async (nextTenantId: string) => {
      const tokens = await api.auth.selectTenant({ tenantId: nextTenantId, deviceId: deviceId() });
      setTokens(tokens, nextTenantId);
      setTenantId(nextTenantId);
      // Every cached list belongs to the tenant it was fetched under.
      queryClient.clear();
      await loadMe();
    },
    [loadMe, queryClient, setTenantId, setTokens],
  );

  const membership = useMemo(
    () => me?.memberships.find((candidate) => candidate.tenantId === tenantId) ?? null,
    [me, tenantId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      membership,
      // A platform role wins over a membership one, exactly as `effectiveRole` decides
      // it on the server (SDD §4.4). A Sysadmin holds **no** membership — granting one
      // would be the arrangement FR-SYS-120 forbids — so deriving the role from the
      // membership list alone would leave them with none and route them nowhere.
      role: me?.platformRole ?? membership?.role ?? null,
      restoring,
      consentRequired,
      signIn,
      signOut,
      selectTenant,
      refreshMe: async () => {
        await loadMe();
      },
    }),
    [consentRequired, loadMe, me, membership, restoring, selectTenant, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}

/**
 * The one membership a token can be scoped to automatically, mirroring
 * `MembershipService.selectAutomaticTenant` (SDD §4.3).
 *
 * Mirrored rather than trusted blindly because the client needs to know *which* tenant
 * the server chose in order to label the screen. The server remains the authority: it
 * decides what the token carries, and this only reads the same rule to name it.
 */
function soleUsableMembership(me: MeResponse): TenantMembership | null {
  const usable = me.memberships.filter(
    (membership) => membership.status === 'ACTIVE' && membership.tenantStatus !== 'SUSPENDED',
  );
  return usable.length === 1 ? (usable[0] ?? null) : null;
}
