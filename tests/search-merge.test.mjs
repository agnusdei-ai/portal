import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupeByUrl, mergeHits, rankHits } from "../src/lib/search/merge.ts";

const hit = (url, title, provider = "web") => ({
  url,
  title,
  snippet: `${title} — ${provider}`,
  provider,
});

test("merge flattens providers in configured order", () => {
  const merged = mergeHits(
    [[hit("https://a.example/1", "A1")], [hit("https://b.example/1", "B1")]],
    "anything",
  );
  assert.deepEqual(
    merged.map((h) => h.url),
    ["https://a.example/1", "https://b.example/1"],
  );
});

test("dedupe keeps the first occurrence of a url", () => {
  const deduped = dedupeByUrl([
    hit("https://a.example/1", "From web", "web"),
    hit("https://b.example/1", "From lens", "lens"),
    hit("https://a.example/1", "From lens dup", "lens"),
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].provider, "web");
  assert.equal(deduped[0].title, "From web");
});

test("ranking puts hits covering more query terms first", () => {
  const ranked = rankHits(
    [
      hit("https://x.example/off-topic", "Unrelated page"),
      hit("https://a.example/math", "Math curriculum for homeschool"),
      hit("https://b.example/math", "Math"),
    ],
    "homeschool math",
  );
  assert.deepEqual(
    ranked.map((h) => h.title),
    ["Math curriculum for homeschool", "Math", "Unrelated page"],
  );
});

test("ranking is stable within equal coverage", () => {
  const input = [hit("https://1.example/", "Same"), hit("https://2.example/", "Same")];
  assert.deepEqual(
    rankHits(input, "word").map((h) => h.url),
    ["https://1.example/", "https://2.example/"],
  );
});

test("every merged hit keeps its attribution", () => {
  const merged = mergeHits(
    [[hit("https://a.example/1", "A1", "web")], [hit("https://a.example/2", "A2", "homeschool")]],
    "a1",
  );
  for (const h of merged) assert.ok(h.provider.length > 0);
  assert.deepEqual(
    merged.map((h) => h.provider),
    ["web", "homeschool"],
  );
});
