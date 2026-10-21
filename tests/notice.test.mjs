import test from "node:test";
import assert from "node:assert/strict";

import { loadModule } from "./helpers.mjs";

const { NOTICE } = await loadModule(new URL("../src/lib/consent/notice.ts", import.meta.url));

// Blueprint §3.1: the notice states that the label is private, chosen by the
// parent, and must not identify the child.
test("the notice tells the parent what the seat label is and what it must not hold", () => {
  const section = NOTICE.sections.find((s) => s.heading === "The seat label");
  assert.ok(section, "no seat label section");
  const text = section.body.join(" ").toLowerCase();
  for (const phrase of ["private", "you choose", "name", "initials", "birth date", "school"]) {
    assert.ok(text.includes(phrase), phrase);
  }
});
