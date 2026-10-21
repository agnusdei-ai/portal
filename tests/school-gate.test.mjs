import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

// School plans accept no learner data until a written qualification exists
// (amendment 2 §4.4, DECISIONS.md). Today no hosted column can hold learner
// data, so the block is the absence. A field that could carry it fails here,
// and that is the change that must bring the qualification flag with it.
const LEARNER_DATA = /learner|student|pupil|score|assessment|attendance|progress|transcript|\biep\b|enrol/i;

const DB = "school_gate_test";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

test(
  "no hosted table can hold learner data",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    const names = psql(
      `select table_schema || '.' || table_name || '.' || column_name from information_schema.columns
        where table_schema in ('public', 'consent')
       union
       select n.nspname || '.' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'consent') and c.relkind in ('r', 'v');`,
    ).trim().split("\n");
    const hits = names.filter((n) => LEARNER_DATA.test(n));
    assert.deepEqual(hits, [], "learner data needs the school qualification flag first");
  },
);
