import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { loadModule, readStripped } from "./helpers.mjs";

// Amendment 1 §4.1: a posting reminder on every Exchange free-text field, and
// a report action on every listing and conversation.

const { POSTING_REMINDER } = await loadModule(new URL("../src/lib/exchange/schema.ts", import.meta.url));

test("the reminder names what must stay out", () => {
  for (const word of ["child's name", "school", "address", "phone"]) assert.ok(POSTING_REMINDER.includes(word), word);
});

test("every free-text field in the Exchange forms carries the reminder", () => {
  const dir = "src/components/exchange";
  let checked = 0;
  for (const file of readdirSync(dir)) {
    const text = readStripped(join(dir, file));
    // A Field is the label, hint and control together; each one that wraps a
    // text control for title, body or reason must pass the reminder as hint.
    for (const field of text.matchAll(/<Field\b[\s\S]*?<\/Field>/g)) {
      if (!/name="(title|body|reason)"/.test(field[0])) continue;
      assert.match(field[0], /POSTING_REMINDER/, `${file}: ${field[0].slice(0, 80)}`);
      checked++;
    }
  }
  assert.equal(checked, 4, "listing title, listing body, reply, report reason");
});

test("listings and conversations both offer a report action", () => {
  for (const page of ["src/app/(public)/exchange/[id]/page.tsx", "src/app/portal/inbox/page.tsx"]) {
    assert.match(readStripped(page), /<ReportForm\b/, page);
  }
});
