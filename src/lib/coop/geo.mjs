/**
 * Client-side geography for the co-op directory's "near me" control.
 *
 * The searcher's coordinates exist only in the browser for the duration of a
 * sort — docs/portal.md §7 keeps household geography off the server entirely —
 * so the maths must run with no round trip. Plain, dependency-free JS so the
 * tests import the real module under `node --test` with no build step.
 */

/**
 * Great-circle distance in miles between two coarse points.
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 */
function haversineMiles(from, to) {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.sqrt(a));
}

/**
 * A distance banded to metro precision — "15–20 mi", never a precise figure —
 * so the rendered page is no more exact than the published centroids are.
 * @param {number} miles
 */
export function distanceBand(miles) {
  if (miles < 1) return "under a mile";
  const low = Math.floor(miles / 5) * 5;
  return `${low}\u2013${low + 5} mi`;
}

/**
 * The row shape a "near me" sort consumes: what the directory page selects.
 * @typedef {object} DirectoryCoop
 * @property {string} id
 * @property {string} name
 * @property {string | null} state_code
 * @property {string | null} region
 * @property {string | null} meeting_day
 * @property {string | null} description
 * @property {number | null} meeting_area_lat
 * @property {number | null} meeting_area_lng
 * @property {number | null} meeting_area_radius_mi
 */

/**
 * Order co-ops for a "near me" sort: listings with a published meeting area by
 * great-circle distance to the searcher, listings without one after them in
 * their original order — a region-only listing is never given a fake location
 * (docs/portal.md §10). Returns a new array; the caller's list is untouched.
 * @param {readonly DirectoryCoop[]} coops
 * @param {{ lat: number, lng: number }} origin
 * @returns {{ coop: DirectoryCoop, distanceMi: number | null, withinArea: boolean | null }[]}
 */
export function orderByDistance(coops, origin) {
  return coops
    .map((coop, index) => {
      const hasArea = coop.meeting_area_lat != null && coop.meeting_area_lng != null;
      const distanceMi = hasArea
        ? haversineMiles(origin, { lat: coop.meeting_area_lat, lng: coop.meeting_area_lng })
        : null;
      const withinArea =
        hasArea && coop.meeting_area_radius_mi != null
          ? distanceMi <= coop.meeting_area_radius_mi
          : null;
      return { coop, index, distanceMi, withinArea };
    })
    .sort((a, b) => {
      if (a.distanceMi == null || b.distanceMi == null) {
        if (a.distanceMi == null && b.distanceMi == null) return a.index - b.index;
        return a.distanceMi == null ? 1 : -1;
      }
      return a.distanceMi - b.distanceMi || a.index - b.index;
    })
    .map(({ coop, distanceMi, withinArea }) => ({ coop, distanceMi, withinArea }));
}
