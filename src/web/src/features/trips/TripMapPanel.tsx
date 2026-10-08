import { useMemo, useState } from 'react';
import { Radio, Route, WifiOff } from 'lucide-react';
import type { TripDetailDto, TripStopDto } from '@servisapp/shared';
import { SIGNAL_LOSS_SECONDS } from '@servisapp/shared';
import { useTripLive, useTripPath } from '@/api/tracking-hooks';
import { RouteMap, type MapStop, type MapVehicle } from '@/components/RouteMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { decodePolyline } from '@/lib/polyline';
import { t } from '@/i18n';
import { formatDistance } from './format';

/**
 * FR-RTE-140's map, FR-TRK-090's live vehicle and FR-TRK-100's replay — one panel.
 *
 * Phase 5 deferred the map with a note: *"a polyline layer belongs with Phase 7's live
 * tracking, which brings the vehicle marker that makes a map worth looking at"*. This is
 * that, and the three layers are one component because they are one picture. An Admin
 * opening a trip wants to see the route, where the vehicle is on it, and — for a trip that
 * has finished — where it actually went. Splitting those across three screens would make
 * the comparison, which is the only reason to look at any of them, impossible.
 *
 * ## What is drawn depends on the trip's state, and only on that
 *
 * ```
 *   PLANNED                 the planned route and its numbered stops
 *   STARTED                 …plus the vehicle, live
 *   FINISHED / CANCELLED    …plus the recorded path, on request
 * ```
 *
 * The live subscription is opened only while the trip is `STARTED`. A socket held open on
 * a trip that finished this morning is a room the server would refuse to join anyway
 * (SDD §9.3), and a poll on it is fifteen seconds of asking a question with a fixed answer.
 *
 * ## The replay is opt-in
 *
 * A path is up to two thousand points and it is personal data — where a vehicle carrying
 * identified children went, minute by minute (FR-KVK-030 deletes it after thirty days for
 * that reason). Fetching it whenever an Admin opens a finished trip would move that data
 * across the wire on every idle glance. It is one button, and pressing it is the act.
 */
export function TripMapPanel({ trip }: { trip: TripDetailDto }) {
  const isRunning = trip.state === 'STARTED';
  const isOver = trip.state === 'FINISHED' || trip.state === 'CANCELLED';

  const [showReplay, setShowReplay] = useState(false);

  const live = useTripLive(trip.id, { enabled: isRunning });
  const replay = useTripPath(showReplay ? trip.id : undefined);

  const planned = useMemo(() => decodePolyline(trip.plannedPolyline), [trip.plannedPolyline]);

  // The replay wins over the plan when it is shown: the two are the same journey, and
  // drawing both would produce two lines an Admin has to tell apart by colour alone.
  const path = showReplay && replay.data ? replay.data.points : planned;

  const stops = useMemo(() => mapStops(trip.stops, live.data?.stops), [trip.stops, live.data]);

  const vehicles = useMemo<MapVehicle[]>(() => {
    const position = live.data?.position;
    if (!isRunning || !position) return [];

    return [
      {
        id: trip.id,
        title: trip.vehiclePlate,
        lat: position.lat,
        lng: position.lng,
        headingDeg: position.headingDeg,
        // Drawn hollow past the threshold. The client judges staleness from the reading's
        // own timestamp rather than waiting to be told, which is what keeps FR-TRK-110
        // legible when the socket is the thing that dropped.
        stale: live.data?.signalLost || isStale(position.at),
      },
    ];
  }, [isRunning, live.data, trip.id, trip.vehiclePlate]);

  return (
    <section className="mb-4 space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Route aria-hidden className="h-4 w-4 text-muted-foreground" />
          {showReplay ? t('tracking.replayTitle') : t('tracking.mapTitle')}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {isRunning ? <LiveBadge live={live.live} signalLost={live.data?.signalLost} /> : null}

          {isOver ? (
            <Button variant="outline" size="sm" onClick={() => setShowReplay((shown) => !shown)}>
              {showReplay ? t('tracking.hideReplay') : t('tracking.showReplay')}
            </Button>
          ) : null}
        </div>
      </header>

      <RouteMap path={path} stops={stops} vehicles={vehicles} className="h-96" />

      {showReplay ? <ReplaySummary replay={replay} planned={trip.plannedDistanceM} /> : null}
    </section>
  );
}

/**
 * FR-INT-020 made visible.
 *
 * *"Live"* and *"refreshed fifteen seconds ago"* are different promises to somebody
 * watching a vehicle to decide whether to ring a driver, and a screen that showed the same
 * badge for both would be making the stronger one on the weaker evidence.
 */
function LiveBadge({ live, signalLost }: { live: boolean; signalLost: boolean | undefined }) {
  if (signalLost) {
    return (
      <Badge variant="destructive" className="gap-1" title={t('tracking.signalLostHint', {
        minutes: Math.round(SIGNAL_LOSS_SECONDS / 60),
      })}>
        <WifiOff aria-hidden className="h-3 w-3" />
        {t('tracking.signalLost')}
      </Badge>
    );
  }

  return live ? (
    <Badge className="gap-1" title={t('tracking.liveHint')}>
      <Radio aria-hidden className="h-3 w-3" />
      {t('tracking.live')}
    </Badge>
  ) : (
    <Badge variant="secondary" title={t('tracking.pollingHint')}>
      {t('tracking.polling')}
    </Badge>
  );
}

function ReplaySummary({
  replay,
  planned,
}: {
  replay: ReturnType<typeof useTripPath>;
  planned: number | null;
}) {
  if (replay.isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  if (!replay.data || replay.data.points.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm">
        <p className="font-medium">{t('tracking.replayEmpty')}</p>
        <p className="text-muted-foreground">{t('tracking.replayEmptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border p-3 text-sm sm:grid-cols-3">
        <Figure label={t('tracking.recordedDistance')} value={formatDistance(replay.data.recordedDistanceM)} />
        <Figure label={t('trip.distance')} value={formatDistance(planned)} />
        <Figure label={t('tracking.recordedPoints')} value={String(replay.data.points.length)} />
      </dl>

      {replay.data.truncated ? (
        <p className="text-xs text-muted-foreground">{t('tracking.replayTruncated')}</p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t('tracking.replaySubtitle')}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/**
 * The planned stops, with the live state overlaid where there is one.
 *
 * The plan comes from `GET /trips/:id`, which an Admin loaded once; the states come from
 * the live payload, which updates. Merging them here rather than refetching the whole trip
 * on every stop transition keeps a forty-child payload — with names, addresses and
 * telephone numbers — off a fifteen-second cycle.
 */
function mapStops(
  planned: readonly TripStopDto[],
  live: { id: string; state: string }[] | undefined,
): MapStop[] {
  const states = new Map(live?.map((stop) => [stop.id, stop.state]));

  return planned.map((stop) => ({
    id: stop.id,
    lat: stop.lat,
    lng: stop.lng,
    isSchool: stop.isSchool,
    label: stop.isSchool ? null : String(stop.sequence + 1),
    state: states.get(stop.id) ?? stop.state,
    title: stop.isSchool ? t('trip.schoolStop') : (stop.label ?? undefined),
  }));
}

/** FR-TRK-110, judged by the client from the reading's own timestamp. */
function isStale(at: string): boolean {
  const taken = Date.parse(at);
  return Number.isFinite(taken) && Date.now() - taken > SIGNAL_LOSS_SECONDS * 1_000;
}
