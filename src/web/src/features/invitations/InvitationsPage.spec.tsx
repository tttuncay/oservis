import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, PendingRegistration } from '@servisapp/shared';
import { InvitationsPage } from './InvitationsPage';

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

describe('InvitationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <InvitationsPage />
      </QueryClientProvider>,
    );
  }

  it('renders invitation list with invite button', async () => {
    list.mockResolvedValue(
      page([
        {
          membershipId: '01a00000-0000-7000-8000-00000000a001',
          userId: '01a00000-0000-7000-8000-00000000b001',
          fullName: 'Mehmet Şoför',
          phone: '+905321112233',
          email: null,
          phoneVerified: false,
          role: 'DRIVER',
          status: 'PENDING_APPROVAL',
          createdAt: '2026-08-20T08:00:00.000Z',
          invitedAt: '2026-08-20T08:00:00.000Z',
          rejectedAt: null,
          rejectedReason: null,
          inviteCount: 1,
        },
      ]),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText('Mehmet Şoför')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Yeni Davet Gönder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tekrar Gönder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Numarayı Düzenle/ })).toBeInTheDocument();
  });
});

function page(rows: PendingRegistration[]): Page<PendingRegistration> {
  return { data: rows, nextCursor: null };
}
