/**
 * BuildFlow — Geo utilities (Haversine distance + geo-fence check).
 */

const EARTH_RADIUS_METRES = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points, in metres.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METRES * c;
}

/** Default geo-fence radius in metres. */
export const DEFAULT_GEOFENCE_RADIUS_M = 500;

/**
 * Returns true if the given point is within `radiusMetres` of the site.
 * If the site has no coordinates, returns true (no fence enforced).
 */
export function isWithinGeofence(opts: {
  siteLat?: number | null;
  siteLng?: number | null;
  lat: number;
  lng: number;
  radiusMetres?: number;
}): { within: boolean; distance: number } {
  if (opts.siteLat == null || opts.siteLng == null) {
    return { within: true, distance: 0 };
  }
  const radius = opts.radiusMetres ?? DEFAULT_GEOFENCE_RADIUS_M;
  const distance = haversineDistance(opts.lat, opts.lng, opts.siteLat, opts.siteLng);
  return { within: distance <= radius, distance: Math.round(distance) };
}