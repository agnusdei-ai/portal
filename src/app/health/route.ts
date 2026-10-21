import { NextResponse } from "next/server";

// Liveness only: it touches no database or vendor, so an upstream outage does
// not get the origin restarted. The commit lets every alert name the build.
export function GET() {
  return NextResponse.json(
    { status: "ok", commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
