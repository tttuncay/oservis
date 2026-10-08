import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@servisapp/shared';
import { ImpersonationBanner } from './ImpersonationBanner';

/**
 * **FR-SYS-100** — *"a persistent, unmissable banner naming the tenant and remaining
 * session time"* (SDD §15.2).
 *
 * Phase 3 recorded this screen under *Not closed* and asked, in as many words, for *"a
 * component test with a fixed clock"*. Phase 10 did not write it either. This is it.
 *
 * ## Why a fixed clock and not a real one
 *
 * The whole of what is untested here is *arithmetic against an instant that keeps
 * moving*: remaining time is derived from `expiresAt` and re-derived every second. A
 * suite that used the real clock could only assert that some number appeared, which is
 * exactly the assertion that would still pass if the countdown were frozen — and a
 * frozen countdown is the specific failure the component's own comment says is *"worse
 * than no number because it looks live"*.
 *
 * So `vi.useFakeTimers` fixes `Date.now()` and drives `setInterval` by hand, and every
 * case below is a statement about what the banner reads at a named instant.
 *
 * ## `useAuth` is mocked and the session is not
 *
 * The session shape comes from `MeResponse` in `packages/shared`, so a field added or
 * renamed there is a compile error in this file. What is stubbed is only where the value
 * arrives from — the provider's token exchange is `AuthProvider`'s business and is
 * covered by `client.spec.ts`.
 */

const useAuth = vi.hoisted(() => vi.fn());
vi.mock('./AuthProvider', () => ({ useAuth }));

/** Noon, and the session ends at 12:30 — the thirty minutes FR-SYS-100 grants. */
const NOW = new Date('2026-08-17T12:00:00.000Z');

function signedInWith(impersonation: MeResponse['impersonation']): void {
  useAuth.mockReturnValue({
    me: {
      userId: '01a00000-0000-7000-8000-000000000001',
      fullName: 'Platform Yöneticisi',
      email: 'sysadmin@servisapp.test',
      phone: null,
      memberships: [],
      platformRole: 'SYSADMIN',
      isImpersonating: impersonation !== null,
      impersonation,
    } as unknown as MeResponse,
    membership: null,
    role: 'SYSADMIN',
    restoring: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    selectTenant: vi.fn(),
    refreshMe: vi.fn(),
  });
}

function session(minutesLeft: number, seconds = 0): MeResponse['impersonation'] {
  return {
    sessionId: '01a00000-0000-7000-8000-0000000000f1',
    tenantId: '01a00000-0000-7000-8000-0000000000f2',
    expiresAt: new Date(NOW.getTime() + minutesLeft * 60_000 + seconds * 1_000).toISOString(),
    tenantName: 'Örnek Servis A.Ş.',
    reason: 'Müşteri talebi: ödeme planı hatası',
  };
}

/** Moves the fixed clock and lets the component's one-second interval fire. */
function tick(seconds: number): void {
  act(() => {
    vi.advanceTimersByTime(seconds * 1_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('FR-SYS-100 — the impersonation banner', () => {
  it('renders nothing at all outside a session', () => {
    signedInWith(null);
    const { container } = render(<ImpersonationBanner />);

    // Not a hidden element and not an empty bar: an Admin working normally must not have
    // a slot reserved for a warning that does not apply to them.
    expect(container).toBeEmptyDOMElement();
  });

  it('names the tenant and the recorded reason', () => {
    signedInWith(session(30));
    render(<ImpersonationBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Örnek Servis A\.Ş\./)).toBeInTheDocument();
    // *"including the recorded reason"* — the sysadmin has to see what they typed, or the
    // banner is a decoration rather than an accountability control.
    expect(screen.getByText(/Müşteri talebi: ödeme planı hatası/)).toBeInTheDocument();
  });

  it('derives the remaining minutes from expiresAt rather than from a duration', () => {
    signedInWith(session(30));
    render(<ImpersonationBanner />);

    // Nothing told the component "thirty minutes". It was given an instant and the clock
    // says noon; a component that had been handed a duration would show the same number
    // for ever, which is the defect this case exists for.
    expect(screen.getByText('Kalan süre: 30 dk')).toBeInTheDocument();
  });

  it('counts down as the clock moves', () => {
    signedInWith(session(30));
    render(<ImpersonationBanner />);

    tick(60);
    expect(screen.getByText('Kalan süre: 29 dk')).toBeInTheDocument();

    tick(60 * 9);
    expect(screen.getByText('Kalan süre: 20 dk')).toBeInTheDocument();
  });

  it('switches to seconds inside the last minute', () => {
    // Sixty minutes is a hard stop nobody can extend, so a sysadmin about to lose the
    // session mid-task should see it coming precisely rather than watch "1 dk" sit there.
    signedInWith(session(1, 5));
    render(<ImpersonationBanner />);

    expect(screen.getByText('Kalan süre: 1 dk')).toBeInTheDocument();

    tick(10);
    expect(screen.getByText('Kalan süre: 55 sn')).toBeInTheDocument();
  });

  it('says the session has expired rather than showing a negative number', () => {
    signedInWith(session(0, 3));
    render(<ImpersonationBanner />);

    tick(5);

    expect(screen.getByText('Destek oturumu sona erdi.')).toBeInTheDocument();
    // The banner stays. The session is over on the server the moment the token expires,
    // and a banner that vanished would leave a sysadmin looking at a screen that no
    // longer belongs to anybody.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('survives a reload — the countdown is rebuilt from the server’s instant', () => {
    // A remount is what a reload is, from this component's point of view. `expiresAt` is
    // on `MeResponse` for exactly this reason: `isImpersonating` alone is a boolean, and
    // after a reload the banner could say *that* a session was running but not how long
    // was left. Phase 3 added the field; this is the assertion it was added for.
    signedInWith(session(30));

    const first = render(<ImpersonationBanner />);
    tick(60 * 12);
    expect(screen.getByText('Kalan süre: 18 dk')).toBeInTheDocument();
    first.unmount();

    render(<ImpersonationBanner />);
    expect(screen.getByText('Kalan süre: 18 dk')).toBeInTheDocument();
  });

  it('is not dismissible and does not scroll away', () => {
    signedInWith(session(30));
    render(<ImpersonationBanner />);

    const banner = screen.getByRole('alert');

    // *"persistent, unmissable"*. A close button is the one affordance this banner must
    // never grow, so the absence is asserted rather than left to review.
    expect(banner.querySelector('button')).toBeNull();
    expect(banner.className).toContain('sticky');
  });
});
