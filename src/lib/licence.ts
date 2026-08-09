import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * A seat's licence token: shown once, stored only as a hash, rotated on re-issue.
 * It carries nothing about a child because the household build assembles its own
 * configuration (portal.md §5).
 */
export function mintLicenceToken(): { token: string; sha256: Buffer } {
  const token = randomBytes(32).toString("base64url");
  return { token, sha256: sha256Of(token) };
}

export function sha256Of(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
