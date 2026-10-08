import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionPlanSummary, TenantSummary } from '@servisapp/shared';
import { TenantsPage } from './TenantsPage';

function tenant(overrides: Partial<TenantSummary> = {}): TenantSummary {
  return {
    id: '01a00000-0000-7000-8000-000000000001',
    legalName: 'Örnek Servis A.Ş.',
    taxNo: '1234567890',
    status: 'ACTIVE',
    timezone: 'Europe/Istanbul',
    publicSlug: null,
    trialEndsAt: null,
    graceEndsAt: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    planId: null,
    readOnlySince: null,
    suspendedAt: null,
    ...overrides,
  };
}

const PLAN: SubscriptionPlanSummary = {
  id: '01a00000-0000-7000-8000-0000000000aa',
  name: 'Standart',
  currency: 'TRY',
  tiers: [{ minVehicles: 1, maxVehicles: null, pricePerVehicle: '250.00' }],
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  tenantCount: 1,
};

function respondWith(tenants: TenantSummary[], plans: SubscriptionPlanSummary[] = [PLAN]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);
      const body = url.includes('/platform/plans') ? plans : tenants;

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
    }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * FR-SYS-010 — the console's front door.
 *
 * What is worth asserting here is not that a table renders. It is that the **status**
 * reads correctly, because that column is the reason an operator opened the screen, and
 * that a company on no plan says so rather than showing a blank cell an operator would
 * read as a loading state.
 */
describe('TenantsPage (FR-SYS-010)', () => {
  it('renders each company with its lifecycle status', async () => {
    respondWith([
      tenant(),
      tenant({ id: 'b', legalName: 'Askıdaki A.Ş.', status: 'SUSPENDED' }),
      tenant({ id: 'c', legalName: 'Ödemesiz A.Ş.', status: 'GRACE' }),
    ]);

    renderPage();

    expect(await screen.findByText('Örnek Servis A.Ş.')).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText('Askıda')).toBeInTheDocument();
    expect(screen.getByText('Ödemesiz süre')).toBeInTheDocument();
  });

  it('names the plan a company is billed on', async () => {
    respondWith([tenant({ planId: PLAN.id })]);

    renderPage();

    expect(await screen.findByText('Standart')).toBeInTheDocument();
  });

  /**
   * A blank cell reads as "still loading" on a screen that polls nothing. FR-SYS-040
   * skips a tenant with no plan rather than guessing one, so the list has to say which
   * companies those are.
   */
  it('says so when a company is on no plan, rather than leaving a blank', async () => {
    respondWith([tenant({ planId: null })]);

    renderPage();

    expect(await screen.findByText('Plan atanmadı')).toBeInTheDocument();
  });

  it('shows the empty state rather than an empty table', async () => {
    respondWith([]);

    renderPage();

    expect(await screen.findByText('Kayıtlı şirket yok.')).toBeInTheDocument();
  });
});
