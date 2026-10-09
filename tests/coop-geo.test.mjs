import { test } from "node:test";
import assert from "node:assert/strict";

import { distanceBand, orderByDistance } from "../src/lib/coop/geo.mjs";
import { readStripped } from "./helpers.mjs";

/**
 * The "near me" sort happens entirely in the browser: the searcher's
 * coordinates are read on the explicit action, used to order the already
 * delivered list, and dropped (docs/portal.md §7 keeps household geography off
 * the server). These tests exercise the real ordering module — plain JS, so
 * `node --test` imports it with no build step — and pin the component to the
 * same promise structurally.
 */

// One degree of latitude is about 69 miles by the mean Earth radius the
// haversine uses, which anchors the synthetic fixtures to real distances.
const ATLANTA = { lat: 33.749, lng: -84.388 };

function coop(id, lat, lng, radiusMi = null) {
  return {
    id,
    name: `Co-op ${id}`,
    state_code: "GA",
    region: "Metro area",
    meeting_day: "Tuesday",
    description: "A fixture co-operative.",
    meeting_area_lat: lat,
    meeting_area_lng: lng,
    meeting_area_radius_mi: radiusMi,
  };
}

test("haversine agrees with the mean Earth radius", () => {
  const miles = orderByDistance([coop("a", 34.749, -84.388)], ATLANTA)[0].distanceMi;
  assert.ok(Math.abs(miles - 69.1) < 1, `one degree of latitude should be ~69 mi, got ${miles}`);
});

test("orders co-ops by distance to the browser's coordinates", () => {
  const coops = [
    coop("far", 35.749, -84.388), // ~138 mi north
    coop("near", 34.249, -84.388), // ~35 mi north
    coop("here", 33.749, -84.388), // the searcher's own metro
  ];
  const order = orderByDistance(coops, ATLANTA).map(({ coop: c }) => c.id);
  assert.deepEqual(order, ["here", "near", "far"]);
});

test("the caller's list is left untouched", () => {
  const coops = [coop("far", 35.749, -84.388), coop("here", 33.749, -84.388)];
  const snapshot = structuredClone(coops);
  orderByDistance(coops, ATLANTA);
  assert.deepEqual(coops, snapshot);
});

test("co-ops without a published meeting area trail, in their original order", () => {
  const coops = [
    coop("unlisted-1", null, null),
    coop("near", 34.249, -84.388),
    coop("unlisted-2", null, null),
  ];
  const rows = orderByDistance(coops, ATLANTA);
  assert.deepEqual(
    rows.map(({ coop: c }) => c.id),
    ["near", "unlisted-1", "unlisted-2"],
  );
  assert.deepEqual(
    rows.map((r) => r.distanceMi),
    [rows[0].distanceMi, null, null],
  );
});

test("equal distances keep the directory's name order", () => {
  const coops = [
    coop("alpha", 34.249, -84.388),
    coop("beta", 33.249, -84.388), // equal distance, south rather than north
  ];
  const order = orderByDistance(coops, ATLANTA).map(({ coop: c }) => c.id);
  assert.deepEqual(order, ["alpha", "beta"]);
});

test("a centroid without a longitude is not treated as a location", () => {
  const coops = [{ ...coop("half", 34.249, -84.388), meeting_area_lng: null }];
  const [row] = orderByDistance(coops, ATLANTA);
  assert.equal(row.distanceMi, null);
  assert.equal(row.withinArea, null);
});

test("withinArea respects the radius each co-op published", () => {
  const coops = [coop("inside", 34.249, -84.388, 50), coop("outside", 34.249, -84.388, 25)];
  const rows = orderByDistance(coops, ATLANTA);
  assert.equal(rows[0].withinArea, true);
  assert.equal(rows[1].withinArea, false);
});

test("distances render as bands, never as precise figures", () => {
  assert.equal(distanceBand(0.4), "under a mile");
  assert.equal(distanceBand(15), "15–20 mi");
  assert.equal(distanceBand(16.3), "15–20 mi");
  assert.equal(distanceBand(99.9), "95–100 mi");
});

test("the near-me component never transmits or persists coordinates", () => {
  const component = readStripped(
    new URL("../src/components/coops/directory.tsx", import.meta.url),
  );
  for (const banned of [
    "fetch(",
    "XMLHttpRequest",
    "sendBeacon",
    "WebSocket",
    "EventSource",
    "useRouter",
    "router.",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document.cookie",
  ]) {
    assert.ok(
      !component.includes(banned),
      `docs/portal.md §7: the near-me control must not use "${banned}" — coordinates are read on the explicit action, sorted in memory, and dropped.`,
    );
  }
});
