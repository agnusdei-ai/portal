"use client";

import { useState } from "react";

import { distanceBand, orderByDistance } from "@/lib/coop/geo.mjs";
import { Card } from "@/components/ui";

// The row shape is owned by the ordering module's signature; deriving it here
// keeps one definition of what a "near me" sort consumes.
type DirectoryCoop = Parameters<typeof orderByDistance>[0][number];

type Locate =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "sorted"; lat: number; lng: number }
  | { phase: "unavailable" };

const UNAVAILABLE_COPY =
  "Your browser could not share a location, so the list stays in name order. " +
  "A location is used here in your browser only and is never sent anywhere.";

export function CoopDirectory({ coops }: { coops: DirectoryCoop[] }) {
  const [locate, setLocate] = useState<Locate>({ phase: "idle" });

  // Coordinates are read on this explicit action, sorted against in memory,
  // and dropped on navigation — no request, no storage, ever.
  function nearMe() {
    if (!("geolocation" in navigator)) {
      setLocate({ phase: "unavailable" });
      return;
    }
    setLocate({ phase: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocate({
          phase: "sorted",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => setLocate({ phase: "unavailable" }),
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  const sorted = locate.phase === "sorted" ? orderByDistance(coops, locate) : null;
  const rows: { coop: DirectoryCoop; distanceMi: number | null; withinArea: boolean | null }[] =
    sorted ??
    coops.map((coop) => ({ coop, distanceMi: null, withinArea: null }));

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={nearMe}
          disabled={locate.phase === "locating"}
          className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ring-1 ring-rule bg-white text-ink hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locate.phase === "locating" ? "Finding nearby co-ops…" : "Show co-ops near me"}
        </button>
        <p role="status" className="text-sm text-ink-soft">
          {locate.phase === "locating"
            ? "Asking your browser for a location…"
            : locate.phase === "unavailable"
              ? UNAVAILABLE_COPY
              : sorted
                ? "Ordered by distance to each co-op's published meeting area. Your location stayed in this browser."
                : "Order the directory by how far each co-op's meeting area is from you."}
        </p>
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {rows.map(({ coop, distanceMi, withinArea }) => (
          <li key={coop.id}>
            <Card className="h-full">
              <h2 className="text-lg font-semibold">{coop.name}</h2>
              <p className="text-sm text-ink-faint">
                {[coop.region, coop.state_code].filter(Boolean).join(", ")}
                {coop.meeting_day ? ` · Meets ${coop.meeting_day}` : ""}
              </p>
              <p className="mt-3 text-sm text-ink-soft">{coop.description}</p>
              {distanceMi != null && (
                <p className="mt-3 text-sm font-medium text-ink">
                  about {distanceBand(distanceMi)} away
                  {withinArea === false ? " — beyond its published meeting area" : ""}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
