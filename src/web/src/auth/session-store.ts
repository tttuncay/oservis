import { create } from 'zustand';
import type { AuthTokens, MeResponse } from '@servisapp/shared';

/**
 * The session — tokens and the identity behind them.
 *
 * Zustand, because SDD §15.2 reserves it for *client* state and this is exactly that:
 * who is signed in and with what credential. Nothing here is server data — the tenant's
 * schools and students live in TanStack Query and are never copied in.
 *
 * ## Where the tokens are kept
 *
 * In memory, plus the refresh token in `localStorage`.
 *
 * The access token is deliberately **not** persisted. It is short-lived (fifteen
 * minutes), and a reload can mint a new one from the refresh token in a single call, so
 * persisting it buys nothing and leaves a bearer credential on disk for longer than it
 * needs to exist.
 *
 * The refresh token is persisted because the alternative is signing an Admin out every
 * time they reload the page, and it is the credential the server can revoke — rotation
 * with reuse detection (SDD §7.2) means a stolen copy is detectable and kills the
 * family, which a stored access token would not be.
 */

const REFRESH_TOKEN_KEY = 'servisapp.refreshToken';
const DEVICE_ID_KEY = 'servisapp.deviceId';

/**
 * Stable per browser installation, so `POST /auth/logout` can revoke this device alone
 * and the server's device-mismatch check has something to compare against.
 */
export function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated = `web-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export function storedRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  me: MeResponse | null;
  /** The tenant the current access token is scoped to, or null before one is chosen. */
  tenantId: string | null;
  /** True until the initial "do we have a session?" check has finished. */
  restoring: boolean;
  /** True when the server returned CONSENT_REQUIRED (FR-KVK-020, SDD §17.1). */
  consentRequired: boolean;

  setTokens(tokens: AuthTokens, tenantId: string | null): void;
  setMe(me: MeResponse): void;
  setTenantId(tenantId: string | null): void;
  setConsentRequired(consentRequired: boolean): void;
  finishRestoring(): void;
  clear(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: storedRefreshToken(),
  me: null,
  tenantId: null,
  restoring: true,
  consentRequired: false,

  setTokens: (tokens, tenantId) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tenantId });
  },

  setMe: (me) => set({ me }),

  setTenantId: (tenantId) => set({ tenantId }),

  setConsentRequired: (consentRequired) => set({ consentRequired }),

  finishRestoring: () => set({ restoring: false }),

  clear: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      me: null,
      tenantId: null,
      restoring: false,
      consentRequired: false,
    });
  },
}));

/**
 * Read outside React — the API client's `accessToken()` callback runs per request and
 * has no hook to call.
 */
export function currentAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
