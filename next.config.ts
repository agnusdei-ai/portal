import type { NextConfig } from "next";

// Standalone output is what the Dockerfile copies: the server and only the
// dependencies it traces, so the image carries no dev tooling.
const nextConfig: NextConfig = { output: "standalone" };

export default nextConfig;
