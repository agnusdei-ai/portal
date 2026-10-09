import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mapSocureDecision,
  permittedDocuments,
  provisionalState,
} from "@/lib/verification/states";

/**
 * The spec's state mapping (art_ztdch8TP): the vendor's five decisions map to
 * the portal's attestation states, and application code never branches on the
 * vendor's words. These tests fail if the mapping drifts.
 */

test("the five vendor outcomes map to the portal's states", () => {
  assert.equal(mapSocureDecision("accept"), "verified");
  assert.equal(mapSocureDecision("resubmit"), "retry_required");
  assert.equal(mapSocureDecision("refer"), "manual_review");
  assert.equal(mapSocureDecision("review"), "manual_review");
  assert.equal(mapSocureDecision("reject"), "declined");
});

test("an accept at evaluation time is pending, not verified", () => {
  // No document has been captured at the evaluation call; "verified" arrives
  // only with the DocV completion event.
  assert.equal(provisionalState("accept"), "pending");
  assert.equal(provisionalState("resubmit"), "retry_required");
  assert.equal(provisionalState("refer"), "manual_review");
  assert.equal(provisionalState("review"), "manual_review");
  assert.equal(provisionalState("reject"), "declined");
});

test("US residents may verify by license or passport, international by passport only", () => {
  assert.deepEqual(permittedDocuments("us"), ["drivers_license", "passport"]);
  assert.deepEqual(permittedDocuments("international"), ["passport"]);
});
