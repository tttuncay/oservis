import type { Coordinates } from '@servisapp/shared';

/**
 * Google's Encoded Polyline Algorithm, decoded.
 *
 * `trips.planned_polyline` holds whatever the route provider returned. For the Routes API
 * that is an encoded polyline — a compact string that is *the* reason a forty-stop route
 * fits in a JSON payload at all, and the reason it has to be decoded somewhere.
 *
 * ## Decoded on the client, deliberately
 *
 * The server could decode it and send an array of points. It does not, because the array
 * is roughly twenty times the size of the string and it would be sent on every read of
 * every trip — SDD §8.3's whole argument is about not paying repeatedly for something
 * computed once, and bandwidth on a mobile connection is the same argument in a different
 * currency.
 *
 * ## Not every value here is an encoded polyline
 *
 * The fallback optimiser produces `null` (it computes an order, not a shape) and the fake
 * provider used in tests produces `fake:…`. Both are legitimate, and neither is a defect
 * to report — a route with no drawn shape is drawn as a straight line through its stops.
 * {@link decodePolyline} answers `[]` for anything it does not recognise rather than
 * throwing, because a map that fails to render is worse than a map that renders plainly.
 */

/** Precision Google encodes at: five decimal places, i.e. about a metre. */
const PRECISION = 1e5;

export function decodePolyline(encoded: string | null | undefined): Coordinates[] {
  if (!encoded || encoded.startsWith('fake:')) return [];

  // Bound to a local before the closure below reads it: TypeScript's narrowing does not
  // survive into a nested function, and widening the parameter's type to satisfy it would
  // hide the guard that makes the narrowing true.
  const source: string = encoded;

  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < source.length) {
      lat += nextValue();
      lng += nextValue();
      points.push({ lat: lat / PRECISION, lng: lng / PRECISION });
    }
  } catch {
    // A truncated or corrupted string. The stops are still drawn; only the road shape is
    // lost, which is a degraded map rather than a broken screen.
    return points;
  }

  return points;

  /**
   * One signed value: five-bit chunks, low-order first, each with a continuation bit, and
   * the whole shifted left by one with the sign in the low bit.
   */
  function nextValue(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      if (index >= source.length) throw new Error('truncated polyline');
      byte = source.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}

/**
 * A bounding box over a set of points, or `null` where there are none.
 *
 * Used to frame a map on what it is showing rather than on a fixed centre and zoom. A
 * route across three districts and a route down one street both need the whole of
 * themselves on screen, and no single default zoom does that for both.
 */
export function boundsOf(points: readonly Coordinates[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} | null {
  if (points.length === 0) return null;

  const first = points[0] as Coordinates;
  let north = first.lat;
  let south = first.lat;
  let east = first.lng;
  let west = first.lng;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  return { north, south, east, west };
}

/** The centre of a set of points — the map's `defaultCenter` where bounds are not used. */
export function centreOf(points: readonly Coordinates[]): Coordinates | null {
  const bounds = boundsOf(points);
  if (!bounds) return null;

  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}
