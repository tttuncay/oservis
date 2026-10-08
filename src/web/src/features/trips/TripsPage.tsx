import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Ban, Edit2, Lock, RouteOff, Trash2 } from 'lucide-react';
import {
  DIRECTIONS,
  TRIP_SORT_COLUMNS,
  TRIP_STATES,
  type Direction,
  type TripState,
  type TripSummaryDto,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation, useVehicles } from '@/api/hooks';
import { TRIP_KEYS, useTrips } from '@/api/routing-hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter } from '@/components/ListFilters';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/ConfirmDialog';
import { t } from '@/i18n';
import { CancelTripDialog } from './CancelTripDialog';
import { EditTripDialog } from './EditTripDialog';
import { formatClock, formatDistance } from './format';

/**
 * FR-RTE-140's list half — a day of trips, by vehicle.
 */
export function TripsPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(today());
  const [editingTrip, setEditingTrip] = useState<TripSummaryDto | null>(null);
  const [cancellingTrip, setCancellingTrip] = useState<TripSummaryDto | null>(null);

  const list = useListState({
    initialFilters: {
      direction: undefined as Direction | undefined,
      state: undefined as TripState | undefined,
      vehicleId: undefined as string | undefined,
      needsAttention: undefined as boolean | undefined,
    },
    sortableColumns: TRIP_SORT_COLUMNS,
    defaultSort: { column: 'plannedDepartureAt', direction: 'asc' },
  });

  const query = useTrips({ ...list.query, date });
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc', status: 'ACTIVE' });

  const deleteTrip = useResourceMutation(
    (tripId: string) => api.routing.delete(tripId),
    TRIP_KEYS,
  );

  const confirmDelete = useConfirm<TripSummaryDto>({
    title: () => t('trip.deleteTitle'),
    body: () => t('trip.deleteConfirm'),
    onConfirm: (trip) => deleteTrip.mutateAsync(trip.id),
    pending: deleteTrip.isPending,
  });

  const columns: ColumnDef<TripSummaryDto, unknown>[] = [
    {
      id: 'templateName',
      header: t('routeTemplate.title') || 'Güzergah',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.templateName || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'vehiclePlate',
      header: t('trip.vehicle'),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 font-medium">
          {row.original.vehiclePlate}
          {row.original.orderLocked ? (
            <Lock aria-label={t('trip.orderLocked')} className="h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
        </span>
      ),
    },
    {
      id: 'direction',
      header: t('trip.direction'),
      cell: ({ row }) => (
        <Badge variant={row.original.direction === 'MORNING' ? 'secondary' : 'outline'}>
          {t(`direction.${row.original.direction}`)}
        </Badge>
      ),
    },
    {
      id: 'plannedDepartureAt',
      header: t('trip.departure'),
      cell: ({ row }) => formatClock(row.original.plannedDepartureAt),
    },
    { id: 'schoolName', header: t('trip.school'), cell: ({ row }) => row.original.schoolName },
    {
      id: 'driverName',
      header: t('trip.driver'),
      cell: ({ row }) => row.original.driverName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'studentCount',
      header: t('trip.students'),
      cell: ({ row }) => (
        <span className={row.original.blockedReason === 'CAPACITY' ? 'font-semibold text-destructive' : ''}>
          {row.original.studentCount} / {row.original.vehicleCapacity}
        </span>
      ),
    },
    { id: 'stopCount', header: t('trip.stops'), cell: ({ row }) => row.original.stopCount },
    {
      id: 'plannedDistanceM',
      header: t('trip.distance'),
      cell: ({ row }) => formatDistance(row.original.plannedDistanceM),
    },
    {
      id: 'state',
      header: t('trip.state'),
      cell: ({ row }) => <TripFlags trip={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const trip = row.original;
        const canEdit = trip.state === 'PLANNED' || trip.state === 'STARTED';
        const canDelete = trip.state === 'PLANNED';
        const canCancel = trip.state === 'PLANNED' || trip.state === 'STARTED';

        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={t('trip.edit')}
                onClick={() => setEditingTrip(trip)}
              >
                <Edit2 aria-hidden className="h-4 w-4" />
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                title={t('trip.cancel')}
                onClick={() => setCancellingTrip(trip)}
              >
                <Ban aria-hidden className="h-4 w-4" />
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive/80"
                title={t('trip.delete')}
                onClick={() => confirmDelete.ask(trip)}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('trip.title')}
        description={t('trip.subtitle')}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="trip-date">{t('trip.date')}</Label>
          <Input
            id="trip-date"
            type="date"
            value={date}
            max={today()}
            className="w-44"
            onChange={(event) => {
              const selectedDate = event.target.value;
              const maxDate = today();
              if (selectedDate && selectedDate > maxDate) {
                setDate(maxDate);
              } else {
                setDate(selectedDate);
              }
              list.firstPage();
            }}
          />
        </div>

        <ChoiceFilter
          label={t('trip.direction')}
          value={list.filters.direction}
          onChange={(direction) => list.setFilters({ direction: direction as Direction | undefined })}
          options={DIRECTIONS.map((direction) => ({
            value: direction,
            label: t(`direction.${direction}`),
          }))}
        />

        <ChoiceFilter
          label={t('trip.state')}
          value={list.filters.state}
          onChange={(state) => list.setFilters({ state: state as TripState | undefined })}
          options={TRIP_STATES.map((state) => ({ value: state, label: t(`tripState.${state}`) }))}
        />

        <ChoiceFilter
          label={t('trip.vehicle')}
          width="w-48"
          value={list.filters.vehicleId}
          onChange={(vehicleId) => list.setFilters({ vehicleId })}
          options={(vehicles.data?.data ?? []).map((vehicle) => ({
            value: vehicle.id,
            label: vehicle.plate,
          }))}
        />

        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={list.filters.needsAttention === true}
            onChange={(event) =>
              list.setFilters({ needsAttention: event.target.checked ? true : undefined })
            }
          />
          {t('trip.needsAttention')}
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={list.sortableColumns}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('trip.emptyTitle')}
        emptyBody={t('trip.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={(trip) => navigate(`/admin/trips/${trip.id}`)}
      />

      {editingTrip ? (
        <EditTripDialog trip={editingTrip} onClose={() => setEditingTrip(null)} />
      ) : null}

      {cancellingTrip ? (
        <CancelTripDialog trip={cancellingTrip} onClose={() => setCancellingTrip(null)} />
      ) : null}

      {confirmDelete.dialog}
    </>
  );
}

/**
 * The state badge, plus whatever the Admin needs to know without opening the row.
 *
 * A blocked trip and an unoptimised one are different problems with different urgency:
 * the first will not run, the second will run and take longer than it needed to. Both
 * are shown, and the block is shown first.
 */
function TripFlags({ trip }: { trip: TripSummaryDto }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {trip.state === 'CANCELLED' ? (
        <Badge
          variant="secondary"
          className="gap-1 border-destructive/20 bg-destructive/10 text-destructive"
          title={trip.cancelReason ? `İptal Gerekçesi: ${trip.cancelReason}` : undefined}
        >
          <Ban aria-hidden className="h-3 w-3" />
          <span>{t(`tripState.${trip.state}`)}</span>
          {trip.cancelReason ? (
            <span className="max-w-[140px] truncate text-xs font-normal opacity-90">
              ({trip.cancelReason})
            </span>
          ) : null}
        </Badge>
      ) : (
        <Badge variant="default">
          {t(`tripState.${trip.state}`)}
        </Badge>
      )}

      {trip.blockedReason === 'CAPACITY' ? (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle aria-hidden className="h-3 w-3" />
          {t('error.TRIP_CAPACITY_EXCEEDED')}
        </Badge>
      ) : null}

      {trip.routeOptimised ? null : (
        <Badge variant="outline" className="gap-1" title={t('trip.unoptimised')}>
          <RouteOff aria-hidden className="h-3 w-3" />
          {t('trip.unoptimised')}
        </Badge>
      )}

      {trip.warnings.length > 0 ? (
        <Badge variant="outline" title={trip.warnings.map((warning) => t(`tripWarning.${warning.code}`)).join('\n')}>
          <AlertTriangle aria-hidden className="mr-1 h-3 w-3" />
          {trip.warnings.length}
        </Badge>
      ) : null}
    </div>
  );
}

/** Today, in the browser's own zone — which is the tenant's, for a Turkish operator. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
