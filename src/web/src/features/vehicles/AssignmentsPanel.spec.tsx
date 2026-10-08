import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VehicleAssignment } from '@servisapp/shared';
import { AssignmentsPanel } from './AssignmentsPanel';

/**
 * **FR-CMP-060, FR-CMP-070** — *"substitution without altering historical records"*, and
 * *"a Driver may be assigned with no Host"*.
 *
 * Phase 3 recorded this panel under *Not closed*: the substitution rules are covered
 * server-side by `assignments.integration.spec.ts`, so the *behaviour* is verified. What
 * was untested is the panel's own contribution, and it is an unusual one — **the control
 * that is not there**.
 *
 * ## Asserting an absence, and why that is the requirement rather than a nicety
 *
 * FR-CMP-060 permits substitution *without altering historical records*. The API offers
 * no route that could rewrite one: a substitution bounds the outgoing row and creates a
 * new one; ending closes a row without a replacement. There is no PATCH, deliberately —
 * Phase 2 decision 4 records that a PATCH *"would suggest the existing row is edited,
 * which is the one thing FR-CMP-060 forbids"*.
 *
 * So the missing edit button is load-bearing. A future change that added one would
 * compile, render, and fail at the network with a 404 that reads like a bug in the API,
 * and nothing in this repository would have objected first. These cases object.
 *
 * ## The network is stubbed, not the hooks
 *
 * `fetch` is routed by URL, exactly as `HealthPage.spec.tsx` and `TenantsPage.spec.tsx`
 * do. Mocking `@/api/hooks` instead would stub the query keys and the mutation
 * invalidation as well, which is most of what makes this panel refresh after a
 * substitution.
 */

const VEHICLE_ID = '01a00000-0000-7000-8000-0000000000v1'.replace('v', 'a');

function assignment(overrides: Partial<VehicleAssignment> = {}): VehicleAssignment {
  return {
    id: '01a00000-0000-7000-8000-000000000101',
    vehicleId: VEHICLE_ID,
    driverId: '01a00000-0000-7000-8000-000000000201',
    driverName: 'Ahmet Yılmaz',
    hostId: '01a00000-0000-7000-8000-000000000301',
    hostName: 'Ayşe Kaya',
    validFrom: '2026-09-01',
    validTo: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

function respondWith(assignments: VehicleAssignment[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);
      // Two endpoints: the assignment list, and the staff pickers the forms populate.
      const body = url.includes('/assignments') ? assignments : { data: [], nextCursor: null };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
    }),
  );
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <AssignmentsPanel vehicleId={VEHICLE_ID} />
    </QueryClientProvider>,
  );
}

/** Every control a person could press, by its accessible name. */
function controlNames(): string[] {
  return screen.getAllByRole('button').map((button) => button.textContent?.trim() ?? '');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FR-CMP-060/070 — the assignments panel', () => {
  it('lists the history, open and bounded rows alike', async () => {
    respondWith([
      assignment(),
      assignment({
        id: '01a00000-0000-7000-8000-000000000102',
        driverName: 'Mehmet Demir',
        validFrom: '2026-06-01',
        validTo: '2026-08-31',
      }),
    ]);

    renderPanel();

    // *"without altering historical records"* — the bounded row is still on screen. A
    // panel that hid it would make the history unverifiable from the console, which is
    // the same outcome as not keeping it.
    expect(await screen.findByText('Ahmet Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Mehmet Demir')).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01 — 2026-08-31/)).toBeInTheDocument();
  });

  it('offers no edit control on a bounded assignment', async () => {
    // The case Phase 3's *Not closed* asked for, in as many words.
    respondWith([
      assignment({
        validFrom: '2026-06-01',
        validTo: '2026-08-31',
      }),
    ]);

    renderPanel();
    await screen.findByText('Ahmet Yılmaz');

    const names = controlNames();

    // Nothing that would rewrite the row. Matched loosely on purpose: a future control
    // labelled "Düzenle", "Değiştir" or "Güncelle" must fail this, whichever word it
    // picks.
    expect(names.some((name) => /Düzenle|Güncelle|Kaydet/i.test(name))).toBe(false);

    // Nor an end control: the row is already bounded, and offering to end it again would
    // be an edit wearing a different label.
    expect(names).not.toContain('Sonlandır');
  });

  it('offers no edit control on an open assignment either — only end and substitute', async () => {
    respondWith([assignment()]);

    renderPanel();
    await screen.findByText('Ahmet Yılmaz');

    const names = controlNames();

    expect(names.some((name) => /Düzenle|Güncelle/i.test(name))).toBe(false);

    // What it *does* offer, so this case fails if the panel loses a control as well as
    // if it gains one.
    expect(names).toContain('Sonlandır');
    expect(names).toContain('Değişiklik yap');
    expect(names).toContain('Görevlendirme ekle');
  });

  it('withholds substitution when nothing is open to substitute', async () => {
    respondWith([assignment({ validFrom: '2026-06-01', validTo: '2026-08-31' })]);

    renderPanel();
    await screen.findByText('Ahmet Yılmaz');

    // A substitution bounds an outgoing row; with none open there is nothing to bound,
    // and the server would refuse. Offering the button anyway is how a console teaches
    // people that its errors are meaningless.
    expect(controlNames()).not.toContain('Değişiklik yap');
    expect(controlNames()).toContain('Görevlendirme ekle');
  });

  it('renders a driver with no host as hostless rather than as blank (FR-CMP-070)', async () => {
    // *"A Driver may be assigned with no Host"*, and the Host does attendance where one
    // is aboard (FR-ATT-010). An empty cell reads as missing data; the label states it.
    respondWith([assignment({ hostId: null, hostName: null })]);

    renderPanel();

    expect(await screen.findByText('Hostessiz')).toBeInTheDocument();
  });

  it('says so when a vehicle has never been assigned', async () => {
    respondWith([]);

    renderPanel();

    expect(await screen.findByText('Görevlendirme yok')).toBeInTheDocument();
    expect(controlNames()).toContain('Görevlendirme ekle');
  });
});
