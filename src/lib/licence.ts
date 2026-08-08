import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * A seat's licence token. Handed to the household build once and never again;
 * the portal keeps only its hash, so a disclosure of this database does not
 * yield a usable licence.
 *
 * The token authorises a household build to run. It carries no child data, and
 * there is nothing for it to carry: docs/portal.md §5 puts the child-to-
 * curriculum join, the tutoring configuration and everything else about the
 * child on household hardware, so the household build assembles its own
 * configuration and the portal ships it nothing.
 */
export function mintLicenceToken(): { token: string; sha256: Buffer } {
  const token = randomBytes(32).toString("base64url");
  return { token, sha256: sha256Of(token) };
}

export function sha256Of(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
