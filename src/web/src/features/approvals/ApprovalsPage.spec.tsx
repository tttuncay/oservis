import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, PendingRegistration } from '@servisapp/shared';
import { ApprovalsPage } from './ApprovalsPage';

const list = vi.fn();
const resendInvite = vi.fn();

vi.mock('@/api/client', () => ({
  api: {
    registrations: {
      list: (...args: unknown[]) => list(...args) as unknown,
      resendInvite: (...args: unknown[]) => resendInvite(...args) as unknown,
      approve: vi.fn(),
      reject: vi.fn(),
      invite: vi.fn(),
      correctPhone: vi.fn(),
    },
  },
}));

vi.mock('@/components/ReadOnlyProvider', () => ({
  useReadOnly: () => ({ readOnly: false }),
}));

/**
 * **The Admin's queue after Phase 11 — FR-AUTH-180, FR-AUTH-190, FR-AUTH-200.**
 *
 * One list now holds two jobs, and the assertions below are about telling them apart. A
 * row the Admin invited is their own outbox; a row somebody applied on is their inbox.
 * Rendering both with *Onayla* and *Reddet* would have the Admin approving invitations
 * they themselves issued, which is not an approval — it is a no-op that looks like one.
 */
describe('ApprovalsPage (V2 Phase 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsPage />
      </QueryClientProvider>,
    );
  }

  it('separates an invitation from an application in the same list', async () => {
    list.mockResolvedValue(page([invited(), applied()]));

    renderPage();

    await waitFor(() => expect(screen.getByText('Davet Edilen')).toBeInTheDocument());

    // The source column names each. Without it the Admin cannot tell which rows are
    // waiting on them and which are waiting on somebody else.
    expect(screen.getByText('Davet')).toBeInTheDocument();
    expect(screen.getByText('Başvuru')).toBeInTheDocument();
  });

  it('offers approve and reject on an application only', async () => {
    list.mockResolvedValue(page([invited(), applied()]));

    renderPage();

    await waitFor(() => expect(screen.getByText('Başvuran Kişi')).toBeInTheDocument());

    // One of each button, for the one applicant — not two.
    expect(screen.getAllByRole('button', { name: 'Onayla' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reddet' })).toHaveLength(1);
  });

  it('offers resend and phone correction while the number is unverified', async () => {
    // The same window the server permits both in: once the holder has proved control of
    // the number, resending is pointless and correcting it is refused outright
    // (`PHONE_ALREADY_VERIFIED`). Offering a button the server refuses is worse than
    // offering none.
    list.mockResolvedValue(page([invited()]));

    renderPage();

    await waitFor(() => expect(screen.getByText('Davet Edilen')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Tekrar davet gönder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Numarayı düzelt/ })).toBeInTheDocument();
  });

  it('withholds both once the holder has verified the number', async () => {
    list.mockResolvedValue(page([invited({ phoneVerified: true })]));

    renderPage();

    await waitFor(() => expect(screen.getByText('Davet Edilen')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /Tekrar davet gönder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Numarayı düzelt/ })).not.toBeInTheDocument();
  });

  it('shows a declined invitation with the date it was declined (SDD §7.6)', async () => {
    // Without the date the Admin cannot tell a refusal from this morning from one from
    // last term, and that is exactly what decides whether to resend or to telephone.
    list.mockResolvedValue(
      page([
        invited({
          status: 'REJECTED',
          rejectedAt: '2026-08-21T09:00:00.000Z',
          rejectedReason: 'Yanlış numara',
        }),
      ]),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText('Reddedildi')).toBeInTheDocument());

    // Two dates on the row now — when the invitation went out and when it was declined —
    // and the badge's own date is the one this asserts, so the query is scoped to it
    // rather than to the whole row. A bare `getByText` here would pass on either.
    const badge = screen.getByText('Reddedildi');
    expect(badge.parentElement).toHaveTextContent('21.08.2026');

    // And it is not a dead end: FR-AUTH-200's way back is on the row.
    expect(screen.getByRole('button', { name: /Tekrar davet gönder/ })).toBeInTheDocument();
  });

  it('surfaces how many invitations have already gone out', async () => {
    // "Sent three times, still nothing" is the fact that decides whether to keep sending
    // SMS or to pick up the telephone — and FR-AUTH-200 stops at three a day regardless.
    list.mockResolvedValue(page([invited({ inviteCount: 3 })]));

    renderPage();

    await waitFor(() => expect(screen.getByText(/Gönderilen davet: 3/)).toBeInTheDocument());
  });
});

function page(rows: PendingRegistration[]): Page<PendingRegistration> {
  return { data: rows, nextCursor: null };
}

function invited(overrides: Partial<PendingRegistration> = {}): PendingRegistration {
  return {
    membershipId: '01a00000-0000-7000-8000-00000000a001',
    userId: '01a00000-0000-7000-8000-00000000b001',
    fullName: 'Davet Edilen',
    phone: '+905321234567',
    email: null,
    phoneVerified: false,
    role: 'PARENT',
    status: 'PENDING_APPROVAL',
    createdAt: '2026-08-20T08:00:00.000Z',
    invitedAt: '2026-08-20T08:00:00.000Z',
    rejectedAt: null,
    rejectedReason: null,
    inviteCount: 1,
    ...overrides,
  };
}

function applied(overrides: Partial<PendingRegistration> = {}): PendingRegistration {
  return {
    membershipId: '01a00000-0000-7000-8000-00000000a002',
    userId: '01a00000-0000-7000-8000-00000000b002',
    fullName: 'Başvuran Kişi',
    phone: '+905329876543',
    email: 'basvuran@example.test',
    phoneVerified: true,
    role: 'PARENT',
    status: 'PENDING_APPROVAL',
    createdAt: '2026-08-19T08:00:00.000Z',
    // The distinguishing field: nobody invited this person, they applied.
    invitedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    inviteCount: 0,
    ...overrides,
  };
}
