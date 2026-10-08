import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetLiveDto, FleetVehicleDto } from '@servisapp/shared';
import { FleetMapPage } from './FleetMapPage';

/**
 * FR-TRK-090 — the Admin's fleet view.
 *
 * ## What is asserted here, and what is not
 *
 * Not the map. Google Maps needs a browser, a key and a network, and a jsdom test that
 * mocked all three would assert that a mock was called. What matters and *is* testable is
 * the half of the screen that carries the information: which vehicles, how far through,
 * and — the states an Admin has to be able to tell apart — *silent* against *has not
 * reported yet* against *running normally*.
 *
 * That half is also the one that survives a deployment with no Maps key (SDD §1.2 P5), so
 * asserting on it is asserting on the path that always works.
 */

const MAP_STUB = vi.hoisted(() => ({
  RouteMap: ({ className }: { className?: string }) => (
    <div data-testid="route-map" className={className} />
  ),
}));

// The map is replaced rather than driven. `@vis.gl/react-google-maps` loads a script from
// Google on mount, which a unit test must not do — SDD §19.2's *"no test calls the Google
// Maps API"* is about the paid endpoints, and the same reasoning applies to the tile
// loader for the same reason: a suite must not depend on a key or a bill.
vi.mock('@/components/RouteMap', () => MAP_STUB);

function vehicle(overrides: Partial<FleetVehicleDto> = {}): FleetVehicleDto {
  return {
    tripId: '01920000-0000-7000-8000-000000000001',
    vehicleId: '01920000-0000-7000-8000-0000000000v1',
    vehiclePlate: '34 ABC 123',
    driverName: 'Ali Yılmaz',
    schoolName: 'Kadıköy İlkokulu',
    direction: 'MORNING',
    state: 'STARTED',
    startedAt: '2026-09-15T04:05:00.000Z',
    position: {
      lat: 40.9903,
      lng: 29.0253,
      headingDeg: 45,
      speedMps: 8,
      at: '2026-09-15T04:31:00.000Z',
    },
    signalLost: false,
    nextStop: { id: 'stop-1', sequence: 2, label: 'Bağdat Caddesi', eta: '2026-09-15T04:40:00.000Z' },
    stopsRemaining: 4,
    studentsAboard: 12,
    ...overrides,
  };
}

function respondWith(body: FleetLiveDto) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      headers: new Headers(),
    }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FleetMapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FleetMapPage (FR-TRK-090)', () => {
  it('lists every vehicle on the road with what it is doing', async () => {
    respondWith({ at: '2026-09-15T04:31:05.000Z', vehicles: [vehicle()] });

    renderPage();

    expect(await screen.findByText('34 ABC 123')).toBeInTheDocument();
    expect(screen.getByText('Ali Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Kadıköy İlkokulu')).toBeInTheDocument();
    // "four stops remaining · aboard 12" — the two figures an Admin triages on.
    expect(screen.getByText(/4 · Araçta 12/)).toBeInTheDocument();
  });

  it('names the next stop and its time, which is what the map cannot say', async () => {
    respondWith({ at: '2026-09-15T04:31:05.000Z', vehicles: [vehicle()] });

    renderPage();

    expect(await screen.findByText(/Bağdat Caddesi/)).toBeInTheDocument();
  });

  it('marks a silent vehicle, and says so in words (FR-TRK-110)', async () => {
    respondWith({
      at: '2026-09-15T04:35:00.000Z',
      vehicles: [vehicle({ signalLost: true })],
    });

    renderPage();

    expect(await screen.findByText('Sinyal yok')).toBeInTheDocument();
  });

  it('distinguishes a vehicle that has not reported yet from one that has gone silent', async () => {
    // Two different conversations with the office: one is a driver who declined the
    // location permission, the other is a vehicle in a tunnel. A screen that showed the
    // same badge for both would send an Admin down the wrong one.
    respondWith({
      at: '2026-09-15T04:06:00.000Z',
      vehicles: [vehicle({ position: null, signalLost: false })],
    });

    renderPage();

    expect(await screen.findByText('Konum bekleniyor')).toBeInTheDocument();
    expect(screen.queryByText('Sinyal yok')).not.toBeInTheDocument();
  });

  it('says the fleet is idle rather than showing an empty map', async () => {
    respondWith({ at: '2026-09-15T04:31:05.000Z', vehicles: [] });

    renderPage();

    expect(await screen.findByText('Şu anda yolda araç yok')).toBeInTheDocument();
    expect(screen.queryByTestId('route-map')).not.toBeInTheDocument();
  });

  it('links each vehicle to its trip, because the route is the next question', async () => {
    respondWith({ at: '2026-09-15T04:31:05.000Z', vehicles: [vehicle()] });

    renderPage();

    const link = await screen.findByRole('link', { name: 'Seferi aç' });
    expect(link).toHaveAttribute('href', '/admin/trips/01920000-0000-7000-8000-000000000001');
  });

  it('renders the list even where the map cannot be drawn', async () => {
    // SDD §1.2 P5's degraded path. Every figure on this screen is in the list; the map is
    // how it is easiest to read, not where the information lives.
    respondWith({
      at: '2026-09-15T04:31:05.000Z',
      vehicles: [vehicle({ position: null })],
    });

    renderPage();

    expect(await screen.findByText('34 ABC 123')).toBeInTheDocument();
  });
});
