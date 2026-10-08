import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, Staff } from '@servisapp/shared';
import { DriversPage } from './DriversPage';

const listStaff = vi.fn();

vi.mock('@/api/client', () => ({
  api: {
    staff: {
      list: (...args: unknown[]) => listStaff(...args) as unknown,
      remove: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/components/ReadOnlyProvider', () => ({
  useReadOnly: () => ({ readOnly: false }),
}));

describe('DriversPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <DriversPage />
      </QueryClientProvider>,
    );
  }

  it('renders driver list with staff details', async () => {
    listStaff.mockResolvedValue(
      page([
        {
          id: '01a00000-0000-7000-8000-000000000001',
          kind: 'DRIVER',
          fullName: 'Ahmet Şoför',
          phoneE164: '+905551112233',
          licenceNo: 'B-123456',
          licenceExpiry: '2028-12-31',
          recordCertDate: '2025-01-01',
          userId: 'user-1',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText('Ahmet Şoför')).toBeInTheDocument());
    expect(screen.getByText('+905551112233')).toBeInTheDocument();
    expect(screen.getByText('B-123456')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeInTheDocument();
  });
});

function page(rows: Staff[]): Page<Staff> {
  return { data: rows, nextCursor: null };
}
