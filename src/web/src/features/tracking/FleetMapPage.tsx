import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, WifiOff } from 'lucide-react';
import type { FleetVehicleDto } from '@servisapp/shared';
import { SIGNAL_LOSS_SECONDS } from '@servisapp/shared';
import { useFleet } from '@/api/tracking-hooks';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RouteMap, type MapVehicle } from '@/components/RouteMap';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';
import { formatClock } from '../trips/format';

/**
 * FR-TRK-090 — *"the Admin shall be able to view the live position of all active Vehicles
 * of their Tenant on a single map"*.
 *
 * ## One map and one list, not one map
 *
 * The map answers *where*; the list answers *which*, *how far through* and *how many
 * children are aboard* — and it is the half that works on a phone, with a screen reader,
 * and on a deployment with no Maps key (NFR-USA-070, SDD §1.2 P5). Selecting a vehicle in
 * the list narrows the map to it, which is the only interaction on the screen and the one an
 * Admin actually performs: *"where is 34 ABC 123 and what is it doing"*.
 *
 * ## It polls; it does not subscribe
 *
 * SDD §6.3's rooms are per trip. A fleet of forty vehicles would be forty subscriptions
 * delivering forty streams of positions to redraw one map — and would still need this
 * request for the plates, the crew names and the stop counts the socket does not carry.
 * One request every fifteen seconds is both cheaper and simpler, and it is the same
 * interval FR-INT-020 fixes for the fallback.
 *
 * The *trip* screen subscribes, because there the subject is one vehicle and the latency
 * between a position arriving and a marker moving is the whole point.
 *
 * ## No stops are drawn here, and that is not an omission
 *
 * FR-TRK-090 is about *vehicles*. Every stop of every active route is four hundred pins on
 * one map — unreadable, and it would put the tenant's entire morning geography on a single
 * screen for anyone standing behind the Admin. The next stop is *named* in the list, with
 * its time; the route itself is one click away on the trip screen, where the audience for
 * it is.
 */
export function FleetMapPage() {
  const fleet = useFleet();
  const [selected, setSelected] = useState<string | null>(null);

  const vehicles = fleet.data?.vehicles ?? [];

  const markers = useMemo<MapVehicle[]>(
    () =>
      vehicles
        .filter((vehicle): vehicle is FleetVehicleDto & { position: NonNullable<FleetVehicleDto['position']> } =>
          vehicle.position !== null,
        )
        .map((vehicle) => ({
          id: vehicle.tripId,
          title: `${vehicle.vehiclePlate} · ${vehicle.driverName}`,
          lat: vehicle.position.lat,
          lng: vehicle.position.lng,
          headingDeg: vehicle.position.headingDeg,
          stale: vehicle.signalLost,
        })),
    [vehicles],
  );

  if (fleet.error) {
    return <ErrorState error={fleet.error} onRetry={() => void fleet.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title={t('tracking.title')}
        description={t('tracking.subtitle')}
        actions={
          <Badge variant="secondary">
            {t('tracking.vehicleCount', { count: vehicles.length })}
          </Badge>
        }
      />

      {vehicles.length === 0 && !fleet.isLoading ? (
        <EmptyState title={t('tracking.noVehicles')} body={t('tracking.noVehiclesBody')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <RouteMap vehicles={selectedOnly(markers, selected)} className="h-[28rem]" />

          <ul className="space-y-2" aria-label={t('tracking.title')}>
            {vehicles.map((vehicle) => (
              <li key={vehicle.tripId}>
                <VehicleCard
                  vehicle={vehicle}
                  selected={vehicle.tripId === selected}
                  onSelect={() =>
                    setSelected((current) => (current === vehicle.tripId ? null : vehicle.tripId))
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Selecting a vehicle narrows the map to it.
 *
 * With nothing selected the map shows the fleet, which is the question the screen exists
 * to answer. With one selected it shows that vehicle alone, which is what an Admin who has
 * just been rung about one bus wants — and, incidentally, is what makes the marker findable
 * among forty.
 */
function selectedOnly(markers: readonly MapVehicle[], selected: string | null): MapVehicle[] {
  if (selected === null) return [...markers];
  return markers.filter((marker) => marker.id === selected);
}

function VehicleCard({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: FleetVehicleDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm transition-colors ${selected ? 'border-primary bg-accent/40' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Bus aria-hidden className="h-4 w-4 text-muted-foreground" />
          {vehicle.vehiclePlate}
        </span>

        {vehicle.signalLost ? (
          <Badge
            variant="destructive"
            className="gap-1"
            title={t('tracking.signalLostHint', {
              minutes: Math.round(SIGNAL_LOSS_SECONDS / 60),
            })}
          >
            <WifiOff aria-hidden className="h-3 w-3" />
            {t('tracking.signalLost')}
          </Badge>
        ) : vehicle.position === null ? (
          <Badge variant="secondary" title={t('tracking.noPositionHint')}>
            {t('tracking.noPosition')}
          </Badge>
        ) : (
          <Badge variant="secondary">{t(`direction.${vehicle.direction}`)}</Badge>
        )}
      </button>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Figure label={t('trip.driver')} value={vehicle.driverName} />
        <Figure label={t('trip.school')} value={vehicle.schoolName} />
        <Figure
          label={t('tracking.nextStop')}
          value={
            vehicle.nextStop
              ? `${vehicle.nextStop.label ?? `#${vehicle.nextStop.sequence + 1}`}${
                  vehicle.nextStop.eta ? ` · ${formatClock(vehicle.nextStop.eta)}` : ''
                }`
              : '—'
          }
        />
        <Figure
          label={t('tracking.stopsRemaining')}
          value={`${vehicle.stopsRemaining} · ${t('tracking.aboard')} ${vehicle.studentsAboard}`}
        />
        <Figure
          label={t('tracking.lastSeen')}
          value={vehicle.position ? formatClock(vehicle.position.at) : '—'}
        />
        <Figure
          label={t('tracking.startedAt')}
          value={vehicle.startedAt ? formatClock(vehicle.startedAt) : '—'}
        />
      </dl>

      <Link
        to={`/admin/trips/${vehicle.tripId}`}
        className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        {t('tracking.openTrip')}
      </Link>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
