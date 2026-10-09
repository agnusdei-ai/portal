import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERSONA_COPY,
  buildChecklist,
  checklistComplete,
  isPersona,
  isSelfMarkable,
  vouchClass,
} from "@/lib/onboarding/checklist";

/**
 * The persona checklist's gating (spec art_ztdch8TP, "Personas and guided
 * onboarding"; tutor path per the phase-B ruling of 2026-10-09). The steps are
 * a decision, so the decision is executed here over fixtures: parent path
 * order, verification gating, the educator/guide/tutor vouching gate, the
 * tutor's agent-API enrollment guidance, and the no-bypass rule — a mark may
 * never stand in for a system fact.
 */

function facts(over = {}) {
  return {
    hasAccount: false,
    verificationState: null,
    vouched: false,
    hasParticipated: false,
    markedSteps: [],
    ...over,
  };
}

const ids = (persona, f = facts()) => buildChecklist(persona, f).map((s) => s.id);
const find = (persona, f, id) => buildChecklist(persona, f).find((s) => s.id === id);

test("the parent path is the default and runs consent → verify → coop → participate", () => {
  assert.deepEqual(ids("parent"), ["consent", "verify", "coop", "participate"]);
});

test("the educator and guide paths run verify → vouch → participate", () => {
  assert.deepEqual(ids("educator"), ["verify", "vouch", "participate"]);
  assert.deepEqual(ids("guide"), ["verify", "vouch", "participate"]);
});

test("the tutor path runs verify → vouch → enroll, aimed at the shipped agent API", () => {
  assert.deepEqual(ids("tutor"), ["verify", "vouch", "enroll"]);
  const enroll = find("tutor", facts(), "enroll");
  assert.equal(enroll?.href, "/docs/tutor-agent-interface");
  assert.equal(enroll?.docSlug, "tutor-agent-interface");
});

test("verification gates the verify step for every persona", () => {
  for (const persona of ["parent", "educator", "guide", "tutor"]) {
    assert.equal(find(persona, facts(), "verify")?.done, false, `${persona} unverified`);
    assert.equal(
      find(persona, facts({ verificationState: "verified" }), "verify")?.done,
      true,
      `${persona} verified`,
    );

    // Every in-flight or negative attestation state stays undone.
    for (const state of ["pending", "retry_required", "manual_review", "declined"]) {
      assert.equal(
        find(persona, facts({ verificationState: state }), "verify")?.done,
        false,
        `${persona} ${state}`,
      );
    }
  }
});

test("educator and guide participate steps wait on vouching, and only a vouch lifts the wait", () => {
  for (const persona of ["educator", "guide"]) {
    const locked = find(persona, facts({ verificationState: "verified" }), "participate");
    assert.equal(locked?.waitsOnVouching, true, `${persona} waits while unvouched`);

    const lifted = find(
      persona,
      facts({ verificationState: "verified", vouched: true }),
      "participate",
    );
    assert.equal(lifted?.waitsOnVouching, false, `${persona} opens once vouched`);
  }
});

test("the tutor's enroll step gates on vouching exactly like the educator's participate", () => {
  const locked = find(
    "tutor",
    facts({ verificationState: "verified", vouched: false }),
    "enroll",
  );
  assert.equal(locked?.waitsOnVouching, true, "enrollment guidance waits while unvouched");

  const lifted = find(
    "tutor",
    facts({ verificationState: "verified", vouched: true }),
    "enroll",
  );
  assert.equal(lifted?.waitsOnVouching, false, "enrollment guidance opens once vouched");
});

test("the vouch step is done only on a vouch — never on a mark", () => {
  for (const persona of ["educator", "guide", "tutor"]) {
    const marked = find(persona, facts({ markedSteps: ["vouch"] }), "vouch");
    assert.equal(marked?.done, false, `${persona} a mark is not a vouch`);
    assert.equal(marked?.selfMarkable, false, `${persona} the vouch step is not markable`);
  }
});

test("the tutor's vouch step names the class and the no-credentialing rule", () => {
  const vouch = find("tutor", facts(), "vouch");
  assert.ok(vouch?.description.includes("does not credential tutors"));
  assert.ok(vouch?.description.includes("tutor's teaching"));
});

test("no bypass: marks cannot complete any derived step, on any persona", () => {
  const everything = ["consent", "verify", "vouch", "coop", "enroll", "participate"];
  for (const persona of ["parent", "educator", "guide", "tutor"]) {
    for (const step of buildChecklist(persona, facts({ markedSteps: everything }))) {
      const markable =
        (persona === "parent" && step.id === "coop") ||
        (persona === "tutor" && step.id === "enroll");
      assert.equal(step.done, markable, `${persona}/${step.id} mark honouring`);
      assert.equal(step.selfMarkable, markable, `${persona}/${step.id} markability`);
    }
  }
});

test("the human-choice steps are the parent's co-op discovery and the tutor's enroll", () => {
  assert.equal(isSelfMarkable("parent", "coop"), true);
  assert.equal(isSelfMarkable("tutor", "enroll"), true);
  for (const stepId of ["consent", "verify", "participate", "vouch", "nonexistent"]) {
    for (const persona of ["parent", "educator", "guide", "tutor"]) {
      assert.equal(isSelfMarkable(persona, stepId), false, `${persona}/${stepId}`);
    }
  }
});

test("the parent co-op step completes on its mark and no other mark", () => {
  const marked = buildChecklist("parent", facts({ markedSteps: ["coop"] }));
  assert.equal(marked.find((s) => s.id === "coop")?.done, true);
  assert.equal(checklistComplete(marked), false, "a mark alone does not finish the path");
});

test("the tutor's enroll step completes on its mark, and no other mark", () => {
  const marked = buildChecklist("tutor", facts({ markedSteps: ["enroll"] }));
  assert.equal(marked.find((s) => s.id === "enroll")?.done, true);
  assert.equal(
    marked.find((s) => s.id === "verify")?.done,
    false,
    "the enroll mark says nothing about verification",
  );
  assert.equal(checklistComplete(marked), false, "a mark alone does not finish the path");
});

test("completion requires every step of the persona's path", () => {
  const parent = facts({
    hasAccount: true,
    verificationState: "verified",
    hasParticipated: true,
    markedSteps: ["coop"],
  });
  assert.equal(checklistComplete(buildChecklist("parent", parent)), true);

  for (const persona of ["educator", "guide"]) {
    const allButVouch = facts({ verificationState: "verified", hasParticipated: true });
    assert.equal(checklistComplete(buildChecklist(persona, allButVouch)), false);
    const complete = facts({
      verificationState: "verified",
      vouched: true,
      hasParticipated: true,
    });
    assert.equal(checklistComplete(buildChecklist(persona, complete)), true);
  }

  const tutorAllButEnroll = facts({ verificationState: "verified", vouched: true });
  assert.equal(checklistComplete(buildChecklist("tutor", tutorAllButEnroll)), false);
  const tutorAllButVouch = facts({
    verificationState: "verified",
    markedSteps: ["enroll"],
  });
  assert.equal(
    checklistComplete(buildChecklist("tutor", tutorAllButVouch)),
    false,
    "a mark cannot stand in for the vouch",
  );
  const tutorComplete = facts({
    verificationState: "verified",
    vouched: true,
    markedSteps: ["enroll"],
  });
  assert.equal(checklistComplete(buildChecklist("tutor", tutorComplete)), true);
});

test("vouchClass maps each persona to the class its vouch elevates", () => {
  assert.equal(vouchClass("parent"), null);
  assert.equal(vouchClass("educator"), "teacher");
  assert.equal(vouchClass("tutor"), "teacher");
  assert.equal(vouchClass("guide"), "guide");
});

test("persona names are closed and copy exists for each", () => {
  for (const persona of ["parent", "educator", "guide", "tutor"]) {
    assert.equal(isPersona(persona), true);
    assert.ok(PERSONA_COPY[persona].label.length > 0);
  }
  assert.equal(isPersona("admin"), false);
});
