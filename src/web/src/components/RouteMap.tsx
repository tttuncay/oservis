import { useEffect, useMemo } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { MapPinOff } from 'lucide-react';
import type { Coordinates } from '@servisapp/shared';
import { boundsOf, centreOf } from '@/lib/polyline';
import { t } from '@/i18n';

/**
 * A route on a map — FR-RTE-140's *"planned route … with numbered stops"*, FR-TRK-090's
 * fleet, and FR-TRK-100's replay.
 *
 * One component for all three, because they are one picture with different layers: a path,
 * some numbered points, and some vehicles. Three components would be three places to fix a
 * projection bug, and the projection is the part that is easy to get wrong.
 *
 * ## Two decisions inherited from `MapPicker`, and they still hold
 *
 * **The map mounts only where there is something to draw.** Google bills map loads per
 * session (SDD §1.2 P7, §18.5), so there is no map beside a table row and none on a screen
 * whose route has no coordinates.
 *
 * **With no key configured it degrades rather than disappears.** The same posture the
 * geocoding port takes (SDD §1.2 P5): the stop list, the ETAs and the totals are the
 * information; the map is how it is easiest to read. A deployment without a Maps key keeps
 * every one of those and loses only the picture — which also keeps local development
 * working without a billable key.
 *
 * ## Why the overlays are drawn through the Maps API rather than as React children
 *
 * `@vis.gl/react-google-maps` gives components for a `Map` and a `Marker` and nothing for
 * a polyline. Rather than mix two idioms, every overlay here is created imperatively
 * against the map instance and removed on cleanup. That also makes the redraw cheap: a
 * vehicle moving every fifteen seconds updates one marker's position instead of
 * re-rendering a tree.
 */

const MAPS_API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Istanbul, for the case where there is nothing at all to frame. */
const DEFAULT_CENTRE: Coordinates = { lat: 41.0082, lng: 28.9784 };

export interface MapStop extends Coordinates {
  id: string;
  /** The number drawn in the pin. `null` for the school, which is drawn differently. */
  label: string | null;
  isSchool: boolean;
  /** `PENDING`, `ARRIVED`, `COMPLETED`, `SKIPPED`, `CANCELLED`. Decides the colour. */
  state?: string;
  title?: string;
}

export interface MapVehicle extends Coordinates {
  id: string;
  title: string;
  headingDeg?: number | null;
  /** Drawn hollow: the position is old enough that it should not be trusted (FR-TRK-110). */
  stale?: boolean;
}

export interface RouteMapProps {
  /** The road shape, already decoded. Empty draws a straight line through the stops. */
  path?: readonly Coordinates[];
  stops?: readonly MapStop[];
  vehicles?: readonly MapVehicle[];
  /** Tailwind height class. A map with no height renders as nothing at all. */
  className?: string;
}

export function RouteMap({ path = [], stops = [], vehicles = [], className }: RouteMapProps) {
  const everything = useMemo(
    () => [...path, ...stops, ...vehicles].map((point) => ({ lat: point.lat, lng: point.lng })),
    [path, stops, vehicles],
  );

  if (everything.length === 0) {
    return <NothingToDraw className={className} />;
  }

  if (!MAPS_API_KEY) {
    return <MapUnavailable className={className} />;
  }

  return (
    <div className={className ?? 'h-96'}>
      <div className="h-full overflow-hidden rounded-md border">
        <APIProvider apiKey={MAPS_API_KEY}>
          <Map
            defaultCenter={centreOf(everything) ?? DEFAULT_CENTRE}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            fullscreenControl
            style={{ width: '100%', height: '100%' }}
          >
            <Overlays path={path} stops={stops} vehicles={vehicles} />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}

/**
 * Everything drawn on the map, and the framing.
 *
 * A single effect per layer, each keyed on the data it draws. Splitting them matters for
 * the live case: a vehicle reporting every fifteen seconds must not tear down and rebuild
 * a forty-stop route each time.
 */
function Overlays({
  path,
  stops,
  vehicles,
}: {
  path: readonly Coordinates[];
  stops: readonly MapStop[];
  vehicles: readonly MapVehicle[];
}) {
  const map = useMap();

  // The road shape, or — where the provider drew none (FR-RTE-090's fallback) — a straight
  // line through the stops in order. The second is honestly a schematic rather than a
  // route, and it is dashed so nobody reads it as one.
  useEffect(() => {
    if (!map) return;

    const drawn = path.length > 1 ? path : stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    if (drawn.length < 2) return;

    const schematic = path.length <= 1;

    const line = new google.maps.Polyline({
      path: drawn as google.maps.LatLngLiteral[],
      map,
      strokeColor: '#2563eb',
      strokeOpacity: schematic ? 0 : 0.85,
      strokeWeight: 4,
      ...(schematic
        ? {
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
                offset: '0',
                repeat: '12px',
              },
            ],
          }
        : {}),
    });

    return () => line.setMap(null);
  }, [map, path, stops]);

  useEffect(() => {
    if (!map) return;

    const markers = stops.map(
      (stop) =>
        new google.maps.Marker({
          map,
          position: { lat: stop.lat, lng: stop.lng },
          title: stop.title ?? stop.label ?? undefined,
          label: stop.isSchool
            ? null
            : { text: stop.label ?? '', color: '#ffffff', fontSize: '11px', fontWeight: '600' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: stop.isSchool ? 9 : 11,
            fillColor: stopColour(stop),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: 10,
        }),
    );

    return () => {
      for (const marker of markers) marker.setMap(null);
    };
  }, [map, stops]);

  useEffect(() => {
    if (!map) return;

    const markers = vehicles.map(
      (vehicle) =>
        new google.maps.Marker({
          map,
          position: { lat: vehicle.lat, lng: vehicle.lng },
          title: vehicle.title,
          icon: {
            // An arrow rather than a dot, so the heading is legible at a glance — which is
            // the difference between "the bus is on my street" and "the bus is leaving my
            // street".
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            rotation: vehicle.headingDeg ?? 0,
            fillColor: vehicle.stale ? '#ffffff' : '#16a34a',
            fillOpacity: 1,
            strokeColor: vehicle.stale ? '#dc2626' : '#166534',
            strokeWeight: 2,
          },
          zIndex: 20,
        }),
    );

    return () => {
      for (const marker of markers) marker.setMap(null);
    };
  }, [map, vehicles]);

  // Framed on what is drawn, rather than on a fixed zoom. A route down one street and a
  // fleet across three districts both need the whole of themselves on screen, and no
  // single default does that for both.
  //
  // Deliberately keyed on the *stops and path only*: refitting whenever a vehicle moved
  // would drag the viewport out from under an Admin every fifteen seconds.
  useEffect(() => {
    if (!map) return;

    const bounds = boundsOf([...path, ...stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))]);
    if (!bounds) return;

    if (bounds.north === bounds.south && bounds.east === bounds.west) {
      map.setCenter({ lat: bounds.north, lng: bounds.east });
      map.setZoom(15);
      return;
    }

    map.fitBounds(bounds, 48);
  }, [map, path, stops]);

  return null;
}

/** FR-RTE-140's stop states, as colour. Skipped and cancelled read as *not visited*. */
function stopColour(stop: MapStop): string {
  if (stop.isSchool) return '#0f172a';

  switch (stop.state) {
    case 'COMPLETED':
      return '#16a34a';
    case 'ARRIVED':
      return '#f59e0b';
    case 'SKIPPED':
    case 'CANCELLED':
      return '#94a3b8';
    default:
      return '#2563eb';
  }
}

function MapUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed ${className ?? 'h-96'}`}
    >
      <div className="flex max-w-sm items-start gap-2 px-4 py-3">
        <MapPinOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5 text-sm">
          <p className="font-medium">{t('map.unavailableTitle')}</p>
          <p className="text-muted-foreground">{t('map.mapKeyMissing')}</p>
        </div>
      </div>
    </div>
  );
}

function NothingToDraw({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed ${className ?? 'h-96'}`}
    >
      <p className="px-4 py-3 text-sm text-muted-foreground">{t('map.nothingToDraw')}</p>
    </div>
  );
}
