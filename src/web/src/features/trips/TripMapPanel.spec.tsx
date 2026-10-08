import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDetailDto, TripLiveDto, TripPathDto } from '@servisapp/shared';
import { TripMapPanel } from './TripMapPanel';

/**
 * FR-RTE-140's map layer, FR-TRK-090's live vehicle and FR-TRK-100's replay — the panel
 * Phase 5 deferred.
 *
 * ## What a jsdom test can actually prove about a map
 *
 * Not the picture. It can prove the three things that decide *which* picture is drawn, and
 * every one of them is a rule rather than a rendering:
 *
 *  - a running trip opens a live subscription; a finished one does not
 *  - the replay is fetched on request and never on load, because a path is personal data
 *    (FR-KVK-030) and an idle glance must not move it across the wire
 *  - *live* and *polling* are different badges, because they are different promises
 *
 * The map itself is stubbed. `@vis.gl/react-google-maps` loads a script from Google on
 * mount; a unit test that let it would depend on a key and a bill.
 */

const MAP_STUB = vi.hoisted(() => ({
  RouteMap: ({ path, stops, vehicles }: { path?: unknown[]; stops?: unknown[]; vehicles?: unknown[] }) => (
    <div
      data-testid="route-map"
      data-path={String(path?.length ?? 0)}
      data-stops={String(stops?.length ?? 0)}
      data-vehicles={String(vehicles?.length ?? 0)}
    />
  ),
}));

vi.mock('@/components/RouteMap', () => MAP_STUB);

/**
 * The socket is stubbed to *never connect*, which is the honest default for a unit test
 * and also the case FR-INT-020 exists for. The connected path is proven end to end against
 * a real server in `apps/api/test/tracking-gateway.integration.spec.ts`; what this file
 * asserts is that the screen works when the socket does not.
 */
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: () => undefined,
    off: () => undefined,
    close: () => undefined,
    removeAllListeners: () => undefined,
    emitWithAck: () => Promise.resolve({ ok: false }),
  }),
}));

function trip(overrides: Partial<TripDetailDto> = {}): TripDetailDto {
  return {
    id: '01920000-0000-7000-8000-000000000001',
    serviceDate: '2026-09-15',
    direction: 'MORNING',
    state: 'STARTED',
    plannedDepartureAt: '2026-09-15T04:00:00.000Z',
    vehicleId: 'v1',
    vehiclePlate: '34 ABC 123',
    vehicleCapacity: 20,
    driverName: 'Ali Yılmaz',
    hostName: null,
    schoolId: 's1',
    schoolName: 'Kadıköy İlkokulu',
    stopCount: 2,
    studentCount: 3,
    routeOptimised: true,
    optimisationSource: 'PROVIDER',
    orderLocked: false,
    blockedReason: null,
    warnings: [],
    plannedDistanceM: 8_400,
    plannedDurationS: 1_800,
    templateId: null,
    plannedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    generationRunId: null,
    startedAt: '2026-09-15T04:02:00.000Z',
    finishedAt: null,
    cancelReason: null,
    retrospective: false,
    stops: [
      {
        id: 'stop-1',
        sequence: 0,
        label: '1. durak',
        lat: 40.9903,
        lng: 29.0253,
        isSchool: false,
        isAdhoc: false,
        state: 'PENDING',
        eta: '2026-09-15T04:15:00.000Z',
        arrivedAt: null,
        departedAt: null,
        skipReason: null,
        legDistanceM: 1_200,
        legDurationS: 300,
        dwellS: 45,
        students: [],
      },
      {
        id: 'stop-school',
        sequence: 1,
        label: 'Okul',
        lat: 41.0255,
        lng: 29.0157,
        isSchool: true,
        isAdhoc: false,
        state: 'PENDING',
        eta: '2026-09-15T04:35:00.000Z',
        arrivedAt: null,
        departedAt: null,
        skipReason: null,
        legDistanceM: 4_000,
        legDurationS: 700,
        dwellS: 0,
        students: [],
      },
    ],
    ...overrides,
  };
}

const LIVE: TripLiveDto = {
  tripId: '01920000-0000-7000-8000-000000000001',
  state: 'STARTED',
  at: '2026-09-15T04:31:05.000Z',
  position: {
    lat: 40.995,
    lng: 29.03,
    headingDeg: 40,
    speedMps: 9,
    at: '2026-09-15T04:31:00.000Z',
  },
  signalLost: false,
  stops: [
    { id: 'stop-1', sequence: 0, label: '1. durak', state: 'COMPLETED', eta: null, arrivedAt: '2026-09-15T04:14:00.000Z' },
    { id: 'stop-school', sequence: 1, label: 'Okul', state: 'PENDING', eta: null, arrivedAt: null },
  ],
};

const PATH: TripPathDto = {
  tripId: '01920000-0000-7000-8000-000000000001',
  state: 'FINISHED',
  startedAt: '2026-09-15T04:02:00.000Z',
  finishedAt: '2026-09-15T04:47:00.000Z',
  points: [
    { lat: 40.99, lng: 29.02, at: '2026-09-15T04:02:00.000Z', speedMps: 0, headingDeg: 0, accuracyM: 8 },
    { lat: 40.995, lng: 29.03, at: '2026-09-15T04:20:00.000Z', speedMps: 9, headingDeg: 40, accuracyM: 8 },
    { lat: 41.0255, lng: 29.0157, at: '2026-09-15T04:47:00.000Z', speedMps: 0, headingDeg: 0, accuracyM: 8 },
  ],
  recordedDistanceM: 9_100,
  truncated: false,
};

/** Answers `/live` and `/path` from the fixtures above; anything else is a test defect. */
function respond(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: unknown) => {
    const url = String(input);
    const body = url.includes('/path') ? PATH : LIVE;

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      headers: new Headers(),
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPanel(detail: TripDetailDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <TripMapPanel trip={detail} />
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

describe('TripMapPanel (FR-RTE-140, FR-TRK-090, FR-TRK-100)', () => {
  it('draws the planned route and every stop', async () => {
    respond();
    renderPanel(trip({ state: 'PLANNED', startedAt: null }));

    const map = await screen.findByTestId('route-map');

    // Three points from the specification's example polyline, two stops from the trip.
    expect(map).toHaveAttribute('data-path', '3');
    expect(map).toHaveAttribute('data-stops', '2');
  });

  it('does not subscribe or poll for a trip nobody has started', async () => {
    const fetchMock = respond();
    renderPanel(trip({ state: 'PLANNED', startedAt: null }));

    await screen.findByTestId('route-map');

    // A `PLANNED` trip has no live state to ask about, and asking every fifteen seconds
    // would be a request per screen for a fixed answer.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the vehicle on a running trip', async () => {
    respond();
    renderPanel(trip());

    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute('data-vehicles', '1'),
    );
  });

  it('says it is polling rather than claiming to be live when the socket is down', async () => {
    // FR-INT-020. "Live" and "refreshed fifteen seconds ago" are different promises to
    // somebody deciding whether to ring a driver.
    respond();
    renderPanel(trip());

    expect(await screen.findByText('15 sn’de bir yenileniyor')).toBeInTheDocument();
    expect(screen.queryByText('Canlı')).not.toBeInTheDocument();
  });

  it('reports a silent vehicle (FR-TRK-110)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...LIVE, signalLost: true }),
        headers: new Headers(),
      }),
    );

    renderPanel(trip());

    expect(await screen.findByText('Sinyal yok')).toBeInTheDocument();
  });

  it('offers the replay only once the trip is over', async () => {
    respond();

    const { unmount } = renderPanel(trip());
    await screen.findByTestId('route-map');
    expect(screen.queryByRole('button', { name: 'Rota kaydını göster' })).not.toBeInTheDocument();
    unmount();

    renderPanel(trip({ state: 'FINISHED', finishedAt: '2026-09-15T04:47:00.000Z' }));
    expect(
      await screen.findByRole('button', { name: 'Rota kaydını göster' }),
    ).toBeInTheDocument();
  });

  it('fetches the recorded path only when asked for it (FR-KVK-030)', async () => {
    // A path is where a vehicle carrying identified children went, minute by minute. It is
    // deleted after thirty days for that reason, and it should not cross the wire because
    // somebody opened a screen.
    const fetchMock = respond();
    renderPanel(trip({ state: 'FINISHED', finishedAt: '2026-09-15T04:47:00.000Z' }));

    const button = await screen.findByRole('button', { name: 'Rota kaydını göster' });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/path'))).toBe(false);

    await userEvent.click(button);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/path'))).toBe(true),
    );
  });

  it('draws the recorded path and compares it against the plan', async () => {
    respond();
    renderPanel(trip({ state: 'FINISHED', finishedAt: '2026-09-15T04:47:00.000Z' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Rota kaydını göster' }));

    // Three recorded points replace the plan's three polyline points on the map…
    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute('data-path', '3'),
    );

    // …and the two distances are shown side by side, which is the only reason to look.
    expect(await screen.findByText('9.1 km')).toBeInTheDocument();
    expect(screen.getByText('8.4 km')).toBeInTheDocument();
  });

  it('explains an empty replay rather than showing a blank map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(
              String(input).includes('/path')
                ? { ...PATH, points: [], recordedDistanceM: 0 }
                : LIVE,
            ),
          headers: new Headers(),
        }),
      ),
    );

    renderPanel(trip({ state: 'FINISHED', finishedAt: '2026-09-15T04:47:00.000Z' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Rota kaydını göster' }));

    // A trip driven before the mobile application existed, or one whose readings have
    // passed retention. Both are ordinary, and neither is an error.
    expect(await screen.findByText('Bu sefer için konum kaydı yok')).toBeInTheDocument();
  });
});
