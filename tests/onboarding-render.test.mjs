import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { allDocs } from "@/lib/docs/content";

/**
 * Rendering and page-wiring tests for the persona onboarding surface
 * (spec art_ztdch8TP). The pure builder's gating is covered in
 * onboarding-checklist.test.mjs; here the component is rendered with
 * react-dom/server to prove the UI presents the gates the builder decided —
 * in particular that a step waiting on vouching is explained, never offered,
 * and that no unearned step grows a mark button.
 */

const step = (over) => ({
  id: "exchange",
  title: "Trade on the exchange",
  description: "Post your first listing or reply.",
  href: "/exchange",
  linkLabel: "Open the exchange",
  docSlug: null,
  done: false,
  selfMarkable: true,
  waitsOnVouching: false,
  ...over,
});

const VOUCH_LOCKED = "This opens when a co-operative has vouched for you.";

test("a self-markable step offers 'Mark done'; nothing else does", () => {
  const html = renderToStaticMarkup(
    OnboardingChecklist({
      steps: [
        step({ id: "consent", selfMarkable: false }),
        step({ id: "exchange", selfMarkable: true }),
      ],
    }),
  );
  assert.equal((html.match(/Mark done/g) || []).length, 1);
});

test("a step waiting on vouching is explained, never offered a link or a button", () => {
  const html = renderToStaticMarkup(
    OnboardingChecklist({
      steps: [
        step({ id: "vouch", href: "/coop", linkLabel: "Find a co-op", selfMarkable: false, waitsOnVouching: true }),
        // As the builder emits it while unvouched: explained, not markable.
        step({ id: "exchange", href: "/exchange", linkLabel: "Open the exchange", selfMarkable: false, waitsOnVouching: true }),
      ],
    }),
  );
  assert.ok(html.includes(VOUCH_LOCKED), "the lock is explained");
  assert.ok(!/href="\/coop"/.test(html), "no link to the vouch step's action while locked");
  // The class-gated exchange step is visible but earns no mark button either.
  assert.equal((html.match(/Mark done/g) || []).length, 0);
});

test("a done step shows 'Done' and neither a link nor a mark button", () => {
  const html = renderToStaticMarkup(
    OnboardingChecklist({ steps: [step({ done: true })] }),
  );
  assert.ok(html.includes("Done"));
  assert.ok(!/Mark done/.test(html));
  assert.ok(!/href="\/exchange"/.test(html));
});

test("each step links its action and, when one exists, its guide", () => {
  const html = renderToStaticMarkup(
    OnboardingChecklist({
      steps: [
        step({ id: "verify", href: "/portal/verify", linkLabel: "Start verification", docSlug: "parent-verification-walkthrough", selfMarkable: false }),
      ],
    }),
  );
  assert.ok(html.includes('href="/portal/verify"'));
  assert.ok(html.includes("Start verification"));
  assert.ok(html.includes('href="/docs/parent-verification-walkthrough"'), "Read the guide");
});

test("the docs [slug] route generates exactly the content module's slugs", async () => {
  const page = await import("@/app/(public)/docs/[slug]/page");
  const generated = page.generateStaticParams().map((p) => p.slug).sort();
  const expected = allDocs().map((d) => d.slug).sort();
  assert.deepEqual(generated, expected);
  assert.equal(generated.length, 11);
});

test("the docs index wires the persona shelves and the tutor slot", () => {
  const src = readFileSync("src/app/(public)/docs/page.tsx", "utf8");
  assert.ok(src.includes("DOC_SETS"), "shelves come from the content module");
  assert.ok(src.includes("TUTOR_SLOT"), "the deferred tutor persona keeps its place");
});

test("the [slug] page 404s unknown slugs and renders only module content", () => {
  const src = readFileSync("src/app/(public)/docs/[slug]/page.tsx", "utf8");
  assert.ok(src.includes("notFound()"), "unknown slug -> 404");
  assert.ok(src.includes("getDoc("), "content is looked up, not inlined");
});

test("the portal home carries the persistent onboarding summary", () => {
  const src = readFileSync("src/app/portal/page.tsx", "utf8");
  assert.ok(src.includes("currentOnboarding"), "onboarding state is read server-side");
  assert.ok(src.includes("buildChecklist"), "the same builder gates the home summary");
  assert.ok(src.includes("checklistComplete"), "the summary disappears only when complete");
  assert.ok(src.includes('href="/portal/start"'), "the summary links to the checklist");
  const start = readFileSync("src/app/portal/start/page.tsx", "utf8");
  assert.ok(start.includes("redirect("), "unauthenticated visitors never see the checklist");
  assert.ok(start.includes("choosePersona"), "persona selection is a server action");
  assert.ok(start.includes("OnboardingChecklist"), "the checklist renders there");
});
