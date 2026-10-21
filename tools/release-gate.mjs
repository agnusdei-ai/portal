// Release gate: blueprint section 9 and amendment 1 section 5. Each item is
// evidenced or the gate fails. Writes release-evidence-<commit>.json.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const results = [];
const record = (item, ok, detail) => results.push({ item, ok, detail });
const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const commit = sh("git rev-parse HEAD");
record("Tree is clean, so the evidence is for this commit", sh("git status --porcelain") === "", commit);

let output = "";
let gatesOk = false;
try {
  output = execSync("npm run gates", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  gatesOk = true;
} catch (err) {
  output = String(err.stdout ?? "") + String(err.stderr ?? "");
}
const tally = (name) => Number(output.match(new RegExp(`^# ${name} (\\d+)$`, "m"))?.[1] ?? NaN);
record("Lint, typecheck, tests, build, secret scan pass", gatesOk, `${tally("pass")} of ${tally("tests")} tests`);
record("No test skipped (a skipped database test is no evidence)", tally("skipped") === 0, `${tally("skipped")} skipped`);

const EVIDENCE = {
  "Schema invariants": ["schema-invariants"],
  "Every table has RLS; cross-account access fails": ["rls", "inbox-rls", "listings-rls", "bookmarks-rls"],
  "Field allow-list": ["allowlist"],
  "Nothing sensitive in logs or agent responses": ["logscrub", "agent-surface", "agents-discovery"],
  "Retention job removes expired replies, logs no content": ["retention"],
  "Every operator read of a reply is audited": ["operator-audit"],
  "Notice and copy claim no private or encrypted replies": ["notice-claims", "notice"],
  "Catalog records are sourced and reviewed": ["catalog"],
};
for (const [item, names] of Object.entries(EVIDENCE)) {
  const missing = names.filter((n) => !existsSync(`tests/${n}.test.mjs`));
  record(item, gatesOk && missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : names.join(", "));
}

const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const bundle = existsSync(".next/static") ? files(".next/static").map((f) => readFileSync(f, "utf8")).join("\n") : "";
// Minified bundles keep no names, so only the key's value is a real check.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
record(
  "The service-role key never reaches browser code",
  bundle !== "" && Boolean(key) && !bundle.includes(key),
  !bundle ? "no build output" : key ? "searched .next/static for the key" : "SUPABASE_SERVICE_ROLE_KEY not set; cannot check",
);

if (process.env.DATABASE_URL) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "select url from public.curricula where reviewed_at is not null union all select url from public.resource_links where reviewed_at is not null",
  );
  await client.end();
  const broken = [];
  for (const { url } of rows) {
    const status = await fetch(url, { method: "HEAD", redirect: "follow" }).then((r) => r.status, () => 0);
    if (status === 0 || status >= 400) broken.push(`${url} (${status || "no response"})`);
  }
  record("Every published catalog record has a working link", broken.length === 0, broken.length ? broken.join("; ") : `${rows.length} links`);
} else {
  record("Every published catalog record has a working link", false, "DATABASE_URL not set; links not checked");
}

const signoff = existsSync("docs/release-signoff.md") ? readFileSync("docs/release-signoff.md", "utf8") : "";
for (const line of signoff.split("\n").filter((l) => /^- \[[ x]\]/.test(l))) {
  const item = line.replace(/^- \[[ x]\] /, "").replace(/ Reference:.*$/, "");
  const ref = line.match(/Reference:\s*(\S.*)$/)?.[1] ?? "";
  record(item, line.startsWith("- [x]") && ref !== "", ref || "not signed off");
}

const evidence = { commit, generated_at: new Date().toISOString(), passed: results.every((r) => r.ok), results };
writeFileSync(`release-evidence-${commit}.json`, JSON.stringify(evidence, null, 2) + "\n");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.item} — ${r.detail}`);
console.log(evidence.passed ? "\nRelease gate passed." : "\nRelease gate failed.");
process.exit(evidence.passed ? 0 : 1);
