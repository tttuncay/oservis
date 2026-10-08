import { ApiError, type ApiClient, createApiClient } from '@servisapp/contracts';
import type { AuthTokens } from '@servisapp/shared';
import { currentAccessToken, deviceId, useSessionStore } from '@/auth/session-store';

export { ApiError };

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * One in-flight refresh at a time.
 *
 * Without this, a screen that fires six queries on mount and finds the access token
 * expired would issue six refreshes with the same token. The server rotates on every use
 * and treats a second use of a consumed token as theft — it revokes the whole device
 * family and signs the user out (SDD §7.2). So the naive version does not merely waste
 * requests; it logs the user out reliably, every time their token expires, which is the
 * hardest kind of bug to reproduce by hand.
 *
 * The promise is shared: the first 401 starts the refresh, the rest await the same one.
 */
let inFlightRefresh: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken } = useSessionStore.getState();
  if (!refreshToken) return false;

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, deviceId: deviceId() }),
  }).catch(() => null);

  if (!response?.ok) {
    // The refresh token is spent, revoked, or twelve hours old (NFR-SEC-090). Either
    // way there is no session left to save; the router sends them to the login screen.
    useSessionStore.getState().clear();
    return false;
  }

  const tokens = (await response.json()) as AuthTokens;
  useSessionStore.getState().setTokens(tokens, useSessionStore.getState().tenantId);
  return true;
}

/** Deduplicated. Callers get the same promise until it settles. */
export function refreshOnce(): Promise<boolean> {
  inFlightRefresh ??= refreshSession().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

/**
 * The client every screen uses (SDD §15.1 `api/`).
 *
 * `accessToken` is a callback rather than a captured value, so a rotation takes effect
 * on the very next request without anything being rebuilt.
 */
export const api: ApiClient = createApiClient({
  baseUrl: BASE_URL,
  accessToken: currentAccessToken,
  onUnauthorised: refreshOnce,
});

/**
 * Intercept `CONSENT_REQUIRED` (FR-KVK-020, SDD §17.1).
 *
 * When an authenticated route answers `CONSENT_REQUIRED`, update the session store so
 * the UI immediately renders the blocking KVKK consent screen before anything else,
 * preventing screens from crashing into the generic error state boundary.
 */
const originalRequest = api.http.request.bind(api.http);

api.http.request = async function <T>(
  path: string,
  options?: Parameters<typeof originalRequest>[1],
): Promise<T> {
  try {
    return await originalRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONSENT_REQUIRED') {
      useSessionStore.getState().setConsentRequired(true);
    }
    throw error;
  }
};

