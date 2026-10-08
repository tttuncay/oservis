import { useCallback, useState } from 'react';
import { APIProvider, Map, Marker, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { MapPinOff } from 'lucide-react';
import type { Coordinates } from '@servisapp/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n';

/**
 * FR-CMP-100 — *"the Admin shall be able to adjust the point manually"*.
 *
 * SDD §21 TI-04 makes this the step the whole address feature rests on rather than a
 * convenience: geocoding quality for informal Turkish addresses is variable, and a
 * plausible-looking wrong point is worse than an obvious gap because nothing downstream
 * can tell it is wrong. A confirmed point is stored `MANUAL` and immune to re-geocoding.
 *
 * ## Two cost and availability decisions
 *
 * **The map mounts only where a point is placed.** Google bills map loads per session
 * (SDD §1.2 P7, §18.5). Rendering a map beside every row of a list would multiply that
 * by the page size for no benefit, so there is no map in any table — only on an address
 * panel and a school form.
 *
 * **With no key configured it degrades rather than disappears.** The same posture the
 * geocoding port already takes (SDD §1.2 P5): the Admin types the coordinates. That
 * keeps FR-CMP-100 satisfiable on a deployment without a Maps key, and keeps local
 * development working without one.
 */

const DEFAULT_CENTRE: Coordinates = { lat: 41.0082, lng: 28.9784 };

const MAPS_API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function MapPicker({
  value,
  onChange,
  label,
  hint,
}: {
  value: Coordinates | null;
  onChange: (next: Coordinates) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {MAPS_API_KEY ? (
        <GoogleMapPicker value={value} onChange={onChange} />
      ) : (
        <ManualCoordinates value={value} onChange={onChange} />
      )}
    </div>
  );
}

function GoogleMapPicker({
  value,
  onChange,
}: {
  value: Coordinates | null;
  onChange: (next: Coordinates) => void;
}) {
  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      const point = event.detail.latLng;
      if (point) onChange({ lat: point.lat, lng: point.lng });
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-md border">
        <APIProvider apiKey={MAPS_API_KEY as string}>
          <Map
            defaultCenter={value ?? DEFAULT_CENTRE}
            defaultZoom={value ? 16 : 11}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            onClick={handleClick}
            style={{ width: '100%', height: '100%' }}
          >
            {value ? <Marker position={value} /> : null}
          </Map>
        </APIProvider>
      </div>
      <p className="text-xs text-muted-foreground">{t('map.clickToPlace')}</p>
      {/* The numeric fields stay available alongside the map. An Admin holding a
          coordinate from elsewhere should not have to hunt for it by clicking. */}
      <ManualCoordinates value={value} onChange={onChange} compact />
    </div>
  );
}

/**
 * The degraded path, and also the precise path.
 *
 * Kept as local text state rather than driven from `value` on every keystroke, because
 * a half-typed "41." is not a number and re-rendering it as `41` moves the cursor and
 * makes the field unusable.
 */
function ManualCoordinates({
  value,
  onChange,
  compact,
}: {
  value: Coordinates | null;
  onChange: (next: Coordinates) => void;
  compact?: boolean;
}) {
  const [lat, setLat] = useState(value ? String(value.lat) : '');
  const [lng, setLng] = useState(value ? String(value.lng) : '');

  const commit = (nextLat: string, nextLng: string) => {
    const parsedLat = Number.parseFloat(nextLat);
    const parsedLng = Number.parseFloat(nextLng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      onChange({ lat: parsedLat, lng: parsedLng });
    }
  };

  return (
    <div className="space-y-2">
      {compact ? null : (
        <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5">
          <MapPinOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">{t('map.unavailableTitle')}</p>
            <p className="text-muted-foreground">{t('map.unavailableBody')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="map-picker-lat" className="text-xs">
            {t('map.latitude')}
          </Label>
          <Input
            id="map-picker-lat"
            inputMode="decimal"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            onBlur={() => commit(lat, lng)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="map-picker-lng" className="text-xs">
            {t('map.longitude')}
          </Label>
          <Input
            id="map-picker-lng"
            inputMode="decimal"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            onBlur={() => commit(lat, lng)}
          />
        </div>
      </div>
    </div>
  );
}
