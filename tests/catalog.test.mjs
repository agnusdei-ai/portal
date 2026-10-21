import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

// Agents stage catalog metadata; only a signed-in human reviewer publishes it
// (blueprint §6). Launch publishes no Bede support claim (DECISIONS.md).

const DB = "catalog_test";
const REVIEWER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const { psql, admin, asUser, failure, ready, bootstrap } = dbHarness(DB);

const asAgent = (sql) => psql(`set role service_role;\n${sql}`);
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};
const stage = (id, url, extra = {}) => {
  const row = { kind: "'curriculum'", title: "'Test text'", publisher: "'Test press'", subject: "'Math'", url: `'${url}'`, source_url: `'${url}'`, retrieved_on: "'2026-10-21'", agent_run_id: "'run-1'", ...extra };
  const cols = Object.keys(row).filter((k) => row[k] !== null);
  return asAgent(`insert into public.catalog_candidates (id, ${cols.join(", ")}) values ('${id}', ${cols.map((k) => row[k]).join(", ")});`);
};
const CANDIDATE = "eeeeeeee-0000-0000-0000-000000000001";

test(
  "catalog records reach the public only through human review",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(`insert into auth.users (id, email) values ('${REVIEWER}', 'r@test.local'), ('${MEMBER}', 'm@test.local');
          insert into public.user_roles (user_id, role) values ('${REVIEWER}', 'catalog_reviewer');`);

    await t.test("staging validates links, sources, and duplicates", () => {
      assert.match(refused(() => stage("eeeeeeee-0000-0000-0000-0000000000f1", "http://example.test/x")) ?? "", /url_check/);
      assert.match(refused(() => stage("eeeeeeee-0000-0000-0000-0000000000f2", "https://example.test/x", { source_url: null })) ?? "", /source_url/);
      assert.match(refused(() => stage("eeeeeeee-0000-0000-0000-0000000000f3", "https://example.test/x", { publisher: null })) ?? "", /check/);
      stage(CANDIDATE, "https://example.test/text", { faith_content: "true" });
      assert.match(refused(() => stage("eeeeeeee-0000-0000-0000-0000000000f4", "https://example.test/text")) ?? "", /catalog_candidates_url_idx/);
    });

    await t.test("an agent cannot publish, directly or by review", () => {
      assert.match(refused(() => asAgent(`select public.review_candidate('${CANDIDATE}', true);`)) ?? "", /signed-in catalog reviewer/);
      assert.match(
        refused(() => asAgent(`insert into public.curricula (slug, title, publisher, subject) values ('x', 'x', 'x', 'Math');`)) ?? "",
        /permission denied/,
      );
    });

    await t.test("a member without the reviewer role cannot review", () => {
      assert.match(failure(MEMBER, `select public.review_candidate('${CANDIDATE}', true);`) ?? "", /signed-in catalog reviewer/);
      assert.equal(asUser(MEMBER, "select count(*) from public.catalog_candidates;"), "0");
    });

    await t.test("a reviewer's approval publishes a sourced record with no support claim", () => {
      asUser(REVIEWER, `select public.review_candidate('${CANDIDATE}', true);`);
      const row = psql("set role anon; select slug, bede_support is null, faith_content, source_url, reviewed_at is not null from public.curricula;")
        .split("\n").at(-2);
      assert.equal(row, "test-press-test-text|t|t|https://example.test/text|t");
      assert.match(refused(() => psql("set role anon; select reviewed_by from public.curricula;")) ?? "", /permission denied/);
      assert.match(failure(REVIEWER, `select public.review_candidate('${CANDIDATE}', true);`) ?? "", /no staged candidate/);
    });

    await t.test("a rejection publishes nothing and frees the link", () => {
      const second = "eeeeeeee-0000-0000-0000-000000000002";
      stage(second, "https://example.test/other");
      asUser(REVIEWER, `select public.review_candidate('${second}', false);`);
      assert.equal(psql("select count(*) from public.curricula;").trim(), "1");
      stage("eeeeeeee-0000-0000-0000-000000000003", "https://example.test/other");
    });
  },
);
