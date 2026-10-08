import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  Download,
  Edit2,
  Lock,
  LockOpen,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ApiError } from '@servisapp/contracts';
import type { TripDetailDto, TripStopDto } from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { TRIP_KEYS, useTrip } from '@/api/routing-hooks';
import { ConfirmDialog, useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { CancelTripDialog } from './CancelTripDialog';
import { EditTripDialog } from './EditTripDialog';
import { TripMapPanel } from './TripMapPanel';
import { formatClock, formatDistance, formatDuration } from './format';

/**
 * FR-RTE-140 — *"the planned route … with numbered stops, estimated arrival time per
 * stop, and total distance and duration"* — plus FR-RTE-110's reordering and
 * FR-RTE-150's route sheet.
 */
export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const query = useTrip(tripId);

  if (query.isLoading) return <p className="text-muted-foreground">{t('common.loading')}</p>;
  if (query.error || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 gap-1.5">
        <Link to="/admin/trips">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('common.back')}
        </Link>
      </Button>
      <TripDetail trip={query.data} />
    </>
  );
}

function TripDetail({ trip }: { trip: TripDetailDto }) {
  const navigate = useNavigate();
  // The school keeps its pinned end (FR-RTE-060) and is never in the reorderable list.
  const movable = trip.stops.filter((stop) => !stop.isSchool);
  const school = trip.stops.find((stop) => stop.isSchool);

  const [order, setOrder] = useState<string[]>(() => movable.map((stop) => stop.id));
  const [confirmingReoptimise, setConfirmingReoptimise] = useState(false);
  const [sheetPending, setSheetPending] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [cancellingTrip, setCancellingTrip] = useState(false);

  useEffect(() => {
    setOrder(trip.stops.filter((stop) => !stop.isSchool).map((stop) => stop.id));
  }, [trip.stops]);

  const saveOrder = useResourceMutation(
    (lock: boolean) => api.routing.updateStopOrder(trip.id, { stopIds: order, lock }),
    TRIP_KEYS,
  );

  const reoptimise = useResourceMutation(
    (_: undefined) => api.routing.reoptimise(trip.id, { force: false, overrideLock: true }),
    TRIP_KEYS,
  );

  const deleteTrip = useResourceMutation(
    (tripId: string) => api.routing.delete(tripId),
    TRIP_KEYS,
  );

  const confirmDelete = useConfirm<TripDetailDto>({
    title: () => t('trip.deleteTitle'),
    body: () => t('trip.deleteConfirm'),
    onConfirm: async (targetTrip) => {
      await deleteTrip.mutateAsync(targetTrip.id);
      navigate('/admin/trips');
    },
    pending: deleteTrip.isPending,
  });

  const dirty = order.join() !== movable.map((stop) => stop.id).join();
  const byId = new Map(trip.stops.map((stop) => [stop.id, stop]));

  const canEdit = trip.state === 'PLANNED' || trip.state === 'STARTED';
  const canDelete = trip.state === 'PLANNED';
  const canCancel = trip.state === 'PLANNED' || trip.state === 'STARTED';

  return (
    <>
      <PageHeader
        title={t('trip.detailTitle', {
          plate: trip.vehiclePlate,
          direction: t(`direction.${trip.direction}`),
        })}
        description={`${trip.serviceDate} · ${trip.schoolName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingTrip(true)}>
                <Edit2 aria-hidden className="h-4 w-4" />
                {t('trip.edit')}
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-600 hover:text-amber-700"
                onClick={() => setCancellingTrip(true)}
              >
                <Ban aria-hidden className="h-4 w-4" />
                {t('trip.cancel')}
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive/80"
                onClick={() => confirmDelete.ask(trip)}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                {t('trip.delete')}
              </Button>
            ) : null}

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void downloadSheet(trip.id, setSheetPending)}>
              <Download aria-hidden className="h-4 w-4" />
              {sheetPending ? t('trip.routeSheetPending') : t('trip.routeSheet')}
            </Button>

            <MutatingButton
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmingReoptimise(true)}
            >
              <RefreshCw aria-hidden className="h-4 w-4" />
              {t('trip.reoptimise')}
            </MutatingButton>
          </div>
        }
      />

      <TripSummary trip={trip} />
      <TripNotices trip={trip} />
      <TripMapPanel trip={trip} />

      {movable.length === 0 ? (
        <EmptyState title={t('trip.noStops')} body={t('trip.emptyBody')} />
      ) : (
        <>
          <StopList
            order={order}
            byId={byId}
            school={school}
            direction={trip.direction}
            onMove={(from, to) => setOrder((current) => move(current, from, to))}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <MutatingButton disabled={!dirty} onClick={() => void saveOrder.mutateAsync(true)}>
              {t('trip.lockOrder')}
            </MutatingButton>
            <MutatingButton
              variant="outline"
              disabled={!dirty}
              onClick={() => void saveOrder.mutateAsync(false)}
            >
              {t('trip.saveOrder')}
            </MutatingButton>

            {trip.orderLocked ? (
              <MutatingButton
                variant="ghost"
                className="gap-1.5"
                onClick={() => void saveOrder.mutateAsync(false)}
              >
                <LockOpen aria-hidden className="h-4 w-4" />
                {t('trip.unlock')}
              </MutatingButton>
            ) : null}

            <p className="text-sm text-muted-foreground">{t('trip.lockedHint')}</p>
          </div>

          {saveOrder.error ? <ErrorState error={saveOrder.error} /> : null}
        </>
      )}

      <ConfirmDialog
        open={confirmingReoptimise}
        title={t('trip.reoptimise')}
        // The confirmation says the call may cost money. SDD §8.3 makes that the largest
        // recurring cost in the system, and a button that spends it silently is one an
        // Admin presses out of curiosity.
        body={t('trip.reoptimiseConfirm')}
        pending={reoptimise.isPending}
        onCancel={() => setConfirmingReoptimise(false)}
        onConfirm={() => {
          void reoptimise.mutateAsync(undefined).finally(() => setConfirmingReoptimise(false));
        }}
      />

      {editingTrip ? (
        <EditTripDialog trip={trip} onClose={() => setEditingTrip(false)} />
      ) : null}

      {cancellingTrip ? (
        <CancelTripDialog trip={trip} onClose={() => setCancellingTrip(false)} />
      ) : null}

      {confirmDelete.dialog}
    </>
  );
}

/** FR-RTE-140's totals, and how the order was arrived at. */
function TripSummary({ trip }: { trip: TripDetailDto }) {
  const figures: [string, string][] = [
    [t('trip.departure'), formatClock(trip.plannedDepartureAt)],
    [t('trip.driver'), trip.driverName],
    [t('trip.host'), trip.hostName ?? t('common.none')],
    [t('trip.students'), `${trip.studentCount} / ${trip.vehicleCapacity}`],
    [t('trip.distance'), formatDistance(trip.plannedDistanceM)],
    [t('trip.duration'), formatDuration(trip.plannedDurationS)],
    [
      t('trip.optimisation'),
      trip.optimisationSource ? t(`optimisationSource.${trip.optimisationSource}`) : '—',
    ],
  ];

  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** FR-RTE-070's block and FR-RTE-080's warnings, in the order of how much they matter. */
function TripNotices({ trip }: { trip: TripDetailDto }) {
  if (trip.blockedReason === null && trip.warnings.length === 0 && trip.routeOptimised) return null;

  return (
    <div className="mb-4 space-y-2">
      {trip.blockedReason === 'CAPACITY' ? (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle aria-hidden className="h-4 w-4 text-destructive" />
          {t('error.TRIP_CAPACITY_EXCEEDED')}
        </p>
      ) : null}

      {trip.routeOptimised ? null : (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">{t('trip.unoptimised')}</p>
      )}

      {trip.warnings.map((warning) => (
        <p key={warning.code} className="rounded-md border bg-muted/40 p-3 text-sm">
          {t(`tripWarning.${warning.code}`)}
          {warning.detail ? <span className="ml-1 opacity-70">({warning.detail})</span> : null}
        </p>
      ))}
    </div>
  );
}

/**
 * The numbered stop list, with the move controls FR-RTE-110 needs.
 *
 * ## Buttons, not HTML5 drag-and-drop
 *
 * A drag handle is faster with a mouse and unusable with a keyboard or a screen reader
 * (NFR-USA-070). Up and down buttons are operable by both, need no library, and reorder
 * exactly as reliably. The affordance an Admin loses is a nicety; the one a keyboard user
 * would lose is the feature.
 */
function StopList({
  order,
  byId,
  school,
  direction,
  onMove,
}: {
  order: readonly string[];
  byId: ReadonlyMap<string, TripStopDto>;
  school: TripStopDto | undefined;
  direction: TripDetailDto['direction'];
  onMove: (from: number, to: number) => void;
}) {
  const rows = order.flatMap((id) => {
    const stop = byId.get(id);
    return stop ? [stop] : [];
  });

  return (
    <ol className="divide-y rounded-lg border">
      {direction === 'AFTERNOON' && school ? <SchoolRow stop={school} /> : null}

      {rows.map((stop, index) => (
        <li key={stop.id} className="flex items-start gap-3 p-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{stop.label ?? `${index + 1}.`}</span>
              <span className="text-sm text-muted-foreground">
                {t('trip.eta')}: {formatClock(stop.eta)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('trip.leg')}: {formatDistance(stop.legDistanceM)}
              </span>
              {stop.state === 'CANCELLED' ? (
                <Badge variant="secondary">{t(`stopState.${stop.state}`)}</Badge>
              ) : null}
            </div>

            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
              {stop.students.map((student) => (
                <li
                  key={student.id}
                  className={student.status === 'ABSENT_DECLARED' ? 'line-through opacity-60' : ''}
                >
                  {student.studentName}
                  {student.className ? ` · ${student.className}` : ''}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 gap-1">
            <MutatingButton
              size="icon"
              variant="ghost"
              title={t('trip.moveUp')}
              aria-label={t('trip.moveUp')}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowUp aria-hidden className="h-4 w-4" />
            </MutatingButton>
            <MutatingButton
              size="icon"
              variant="ghost"
              title={t('trip.moveDown')}
              aria-label={t('trip.moveDown')}
              disabled={index === rows.length - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowDown aria-hidden className="h-4 w-4" />
            </MutatingButton>
          </div>
        </li>
      ))}

      {direction === 'MORNING' && school ? <SchoolRow stop={school} /> : null}
    </ol>
  );
}

/** The school. Pinned by FR-RTE-060, so it carries no move controls. */
function SchoolRow({ stop }: { stop: TripStopDto }) {
  return (
    <li className="flex items-center gap-3 bg-muted/30 p-3">
      <Lock aria-hidden className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{t('trip.schoolStop')}</span>
      <span className="text-sm text-muted-foreground">
        {t('trip.eta')}: {formatClock(stop.eta)}
      </span>
    </li>
  );
}

/**
 * FR-RTE-150 — fetches the signed URL and opens it.
 *
 * The first request for a version that has not been rendered answers `202` and starts
 * the render; the button says so and the next click collects it. Opening the signed URL
 * rather than proxying the bytes is what keeps the object out of the API (NFR-SEC-080).
 */
async function downloadSheet(tripId: string, setPending: (pending: boolean) => void) {
  setPending(true);
  try {
    const { url } = await api.routing.sheet(tripId);
    window.open(url, '_blank', 'noopener');
  } catch (error) {
    // `ROUTE_SHEET_NOT_READY` is the ordinary first answer, not a failure: the render
    // was just enqueued. Anything else propagates to the console.
    if (!(error instanceof ApiError) || error.code !== 'ROUTE_SHEET_NOT_READY') throw error;
  } finally {
    setPending(false);
  }
}

function move(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}
