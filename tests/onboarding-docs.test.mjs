import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CERTIFIES_ADULTHOOD,
  DOC_SETS,
  STANDING_IS_EARNED,
  allDocs,
  getDoc,
} from "@/lib/docs/content";

/**
 * The per-persona docs (spec art_ztdch8TP, "Personas and guided onboarding").
 * The content module is the whole surface — the pages render it — so the
 * promises the personas make are asserted here, where the words live.
 */

const docText = (doc) =>
  [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.body])].join("\n");

test("each persona has exactly its guides", () => {
  const expected = {
    parent: [
      "parent-getting-started",
      "parent-verification-walkthrough",
      "parent-coop-membership",
      "parent-waiver-plain-language",
    ],
    educator: [
      "educator-onboarding",
      "educator-vouching",
      "educator-etiquette",
      "educator-what-verification-confers",
    ],
    guide: [
      "guide-onboarding",
      "guide-coop-publishing",
      "guide-moderation-disputes",
    ],
    tutor: ["tutor-onboarding", "tutor-agent-interface"],
  };

  assert.deepEqual(
    DOC_SETS.map((set) => set.persona),
    ["parent", "educator", "guide", "tutor"],
    "every persona has a shelf; the tutor's filled the slot PR #11 held",
  );
  for (const [persona, slugs] of Object.entries(expected)) {
    const set = DOC_SETS.find((s) => s.persona === persona);
    assert.deepEqual(
      set?.docs.map((d) => d.slug),
      slugs,
      `${persona}'s guides`,
    );
  }
  assert.equal(allDocs().length, 13);
});

test("every doc renders with a title, an intro, and sectioned body text", () => {
  for (const doc of allDocs()) {
    assert.ok(doc.title.length > 0, `${doc.slug} title`);
    assert.ok(doc.intro.length > 0, `${doc.slug} intro`);
    assert.ok(doc.sections.length > 0, `${doc.slug} sections`);
    for (const section of doc.sections) {
      assert.ok(section.heading.length > 0, `${doc.slug} heading`);
      assert.ok(section.body.every((p) => p.length > 0), `${doc.slug} body`);
    }
  }
});

test("the plain-language disclaimers appear in every persona's path", () => {
  for (const set of DOC_SETS) {
    const shelf = set.docs.map(docText).join("\n");
    assert.ok(
      shelf.includes(CERTIFIES_ADULTHOOD),
      `${set.persona} must state: ${CERTIFIES_ADULTHOOD}`,
    );
    assert.ok(
      shelf.includes(STANDING_IS_EARNED),
      `${set.persona} must state: ${STANDING_IS_EARNED}`,
    );
  }
});

test("the educator docs say the platform does not credential — vouching alone does", () => {
  const vouching = docText(getDoc("educator-vouching"));
  assert.ok(vouching.includes("does not credential"));
  assert.ok(vouching.includes("vouch"), "the vouch is the mechanism");
});

test("the guide docs carry the publishing rule: advertise existence, never meeting places", () => {
  const publishing = docText(getDoc("guide-coop-publishing"));
  assert.ok(
    publishing.includes("never meeting places") ||
      publishing.includes("does not publish where you meet"),
  );
  assert.ok(
    /address/i.test(publishing),
    "the metro-granularity line is stated with what it excludes",
  );
});

test("the parent docs answer residency and the waiver's readability", () => {
  const walkthrough = docText(getDoc("parent-verification-walkthrough"));
  assert.ok(/passport/.test(walkthrough), "international residents verify by passport");
  const waiver = docText(getDoc("parent-waiver-plain-language"));
  assert.ok(waiver.includes("not end-to-end encrypted"), "the central disclosure, plainly");
});

test("the tutor onboarding doc carries the trust path and the phase-B boundary", () => {
  const onboarding = docText(getDoc("tutor-onboarding"));
  assert.ok(onboarding.includes("does not credential tutors"), "vouching, not the platform");
  assert.ok(
    onboarding.includes("tutor's teaching class"),
    "the vouch's class is named",
  );
  assert.ok(
    /household-owned/.test(onboarding),
    "tutoring configuration and sessions live in household-owned systems",
  );
  assert.ok(
    onboarding.includes("The portal does not tutor"),
    "the boundary is stated in the portal's own voice",
  );
});

test("the agent-interface guide covers enrollment, the PII refusal, and the boundary", () => {
  const guide = docText(getDoc("tutor-agent-interface"));
  assert.ok(guide.includes("GET /api/agents/tutors"), "the shipped endpoint, named");
  assert.ok(
    /no API keys/.test(guide),
    "enrollment is the account holder's own session, not a credential",
  );
  assert.ok(
    /never returns/i.test(guide),
    "the PII refusal is stated as a refusal",
  );
  assert.ok(
    /no-store/.test(guide),
    "trust data's cache posture is stated",
  );
  assert.ok(
    /household/.test(guide),
    "the household-systems boundary is stated for integrators",
  );
});

test("unknown slugs resolve to nothing, so the page can 404", () => {
  assert.equal(getDoc("no-such-doc"), undefined);
});
