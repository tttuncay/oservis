import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/auth/session-store';
import { api, refreshOnce } from './client';

/**
 * Single-flight refresh.
 *
 * ## Why this test earns its place
 *
 * A screen that fires six queries on mount, with an expired access token, produces six
 * 401s at once. Without deduplication that is six `POST /auth/refresh` calls carrying
 * the *same* refresh token — and the server rotates on every use and treats a second use
 * of a consumed token as theft: it revokes the whole device family and signs the user
 * out (SDD §7.2).
 *
 * So the naive version does not merely waste requests. It logs the Admin out, reliably,
 * every time their fifteen-minute access token lapses, in a way that is almost
 * impossible to reproduce by clicking around. That is exactly the class of bug worth a
 * test.
 */
describe('refreshOnce', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    localStorage.clear();
    useSessionStore.setState({
      accessToken: null,
      refreshToken: 'refresh-token-value',
      me: null,
      tenantId: null,
      restoring: false,
      consentRequired: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('issues one request for concurrent callers and hands them all the same answer', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    // Six 401s arriving at once, as a dashboard's worth of queries would produce.
    const attempts = [
      refreshOnce(),
      refreshOnce(),
      refreshOnce(),
      refreshOnce(),
      refreshOnce(),
      refreshOnce(),
    ];

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({
          accessToken: 'new-access',
          expiresIn: 900,
          refreshToken: 'new-refresh',
          refreshExpiresIn: 43_200,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    expect(await Promise.all(attempts)).toEqual([true, true, true, true, true, true]);
    expect(useSessionStore.getState().accessToken).toBe('new-access');
  });

  it('allows a fresh attempt once the previous one has settled', async () => {
    // A new `Response` per call: a body can only be read once, so a shared instance
    // would fail on the second refresh for a reason that has nothing to do with the
    // behaviour under test.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            accessToken: 'a',
            expiresIn: 900,
            refreshToken: 'b',
            refreshExpiresIn: 43_200,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await refreshOnce();
    await refreshOnce();

    // Deduplicated per burst, not cached forever — the second lapse must refresh again.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * NFR-SEC-090 — a refresh token past its twelve hours is refused by the server. The
   * client's job is to stop pretending there is a session.
   */
  it('clears the session when the refresh token is refused', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));

    expect(await refreshOnce()).toBe(false);
    expect(useSessionStore.getState().refreshToken).toBeNull();
    expect(localStorage.getItem('servisapp.refreshToken')).toBeNull();
  });

  it('does not call the server at all when there is no refresh token', async () => {
    useSessionStore.setState({ refreshToken: null });

    expect(await refreshOnce()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CONSENT_REQUIRED interceptor (FR-KVK-020, SDD §17.1)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    useSessionStore.setState({
      accessToken: 'sample-access-token',
      refreshToken: 'sample-refresh-token',
      consentRequired: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets consentRequired to true when any authenticated endpoint answers CONSENT_REQUIRED', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONSENT_REQUIRED',
            message: 'Devam etmek için KVKK aydınlatma metnini okuyup onaylamanız gerekir.',
          },
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    expect(useSessionStore.getState().consentRequired).toBe(false);

    await expect(
      api.schools.list({ limit: 50, sort: 'name', dir: 'asc' }),
    ).rejects.toThrow();

    expect(useSessionStore.getState().consentRequired).toBe(true);
  });
});

