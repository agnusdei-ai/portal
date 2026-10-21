import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { dbHarness, loadModule } from "./helpers.mjs";

// Seat labels, consent data, tokens, and listing or reply text never reach a
// log (blueprint §3.1, amendment 1 §4.1). Every console call in src is read:
// what it interpolates may not name sensitive data, and it may not hand over a
// whole error object, whose fields can quote a row.

const SENSITIVE = /seat_?label|seat_?word|body|token|licen[cs]e|processor_reference|consent|repl(y|ies)|title|description|email/i;

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

function logCalls(text) {
  const calls = [];
  for (const m of text.matchAll(/console\.\w+\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (depth > 0 && i < text.length) {
      if (text[i] === "(") depth++;
      if (text[i] === ")") depth--;
      i++;
    }
    calls.push(text.slice(m.index + m[0].length, i - 1));
  }
  return calls;
}

// Static text in a literal is the developer's message; interpolations and bare
// expressions are data.
function dataOnly(args) {
  return args
    .replace(/`(?:[^`$]|\$(?!\{))*`/g, "``")
    .replace(/`[^`]*`/g, (lit) => [...lit.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]).join(" "))
    .replace(/"[^"]*"|'[^']*'/g, '""');
}

test("no log call interpolates sensitive data or a whole error object", () => {
  const offences = [];
  for (const file of sources("src")) {
    for (const args of logCalls(readFileSync(file, "utf8"))) {
      const data = dataOnly(args);
      if (SENSITIVE.test(data)) offences.push(`${file}: ${args}`);
      for (const arg of data.split(",").map((a) => a.trim())) {
        if (/^(e|err|error)$/.test(arg)) offences.push(`${file}: whole error object in ${args}`);
      }
    }
  }
  assert.deepEqual(offences, []);
});

const DB = "logscrub_test";
const USER = "11111111-1111-1111-1111-111111111111";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

test(
  "a consent query failure carries the constraint, never the row",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(async () => {
      await globalThis.__consentPool?.end();
      admin(`drop database if exists ${DB} with (force)`);
    });
    psql(
      `insert into auth.users (id, email) values ('${USER}', 'a@test.local');
       insert into consent.notice_versions (version, sha256) values ('v1', '\\x00');
       insert into consent.consent_records (owner_user_id, notice_version, notice_acknowledged_at, seat_label)
       values ('${USER}', 'v1', now(), 'lantern.k7q2');`,
    );

    process.env.DATABASE_URL = `${process.env.TEST_DATABASE_URL.replace(/\/+$/, "")}/${DB}`;
    const { consentQuery } = await loadModule(new URL("../src/lib/db.ts", import.meta.url));

    await assert.rejects(
      consentQuery(
        `insert into consent.consent_records (owner_user_id, notice_version, notice_acknowledged_at, seat_label) values ($1, 'v1', now(), $2)`,
        [USER, "harbor.k7q2"],
      ),
      (err) => {
        assert.match(err.message, /consent_records_seat_code_idx/);
        assert.doesNotMatch(JSON.stringify({ ...err, message: err.message, stack: err.stack }), /k7q2|harbor|lantern/);
        return true;
      },
    );
  },
);
