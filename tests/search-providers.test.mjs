import { test } from "node:test";
import assert from "node:assert/strict";

import { createGoogleProvider } from "../src/lib/search/providers/google.ts";

const FIXTURE_ITEMS = {
  items: [
    { title: "State homeschool network", link: "https://hs.example/network", snippet: "laws and forms" },
    { title: "Math curriculum reviews", link: "https://curricula.example/math", snippet: "compared" },
    // Items without a link or title are dropped rather than rendered broken.
    { title: "No link here" },
    { link: "https://untitled.example/", snippet: "no title" },
  ],
};

function fixtureFetch(status = 200, body = FIXTURE_ITEMS) {
  return async () => new Response(JSON.stringify(body), { status });
}

test("the adapter maps api items to attributed hits", async () => {
  const provider = createGoogleProvider("web", {
    apiKey: "k",
    cx: "c",
    fetcher: fixtureFetch(),
  });

  const hits = await provider.search("homeschool laws", { signal: new AbortController().signal });
  assert.deepEqual(hits, [
    {
      url: "https://hs.example/network",
      title: "State homeschool network",
      snippet: "laws and forms",
      provider: "web",
    },
    {
      url: "https://curricula.example/math",
      title: "Math curriculum reviews",
      snippet: "compared",
      provider: "web",
    },
  ]);
});

test("the lens restricts the query to curated hosts", async () => {
  let requested;
  const fetcher = async (url) => {
    requested = url;
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  };
  const provider = createGoogleProvider("homeschool", {
    apiKey: "k!&",
    cx: "c",
    lensDomains: ["hslda.org", "a2zhomeschooling.com"],
    fetcher,
  });

  await provider.search("algebra", { signal: new AbortController().signal });
  const q = decodeURIComponent(new URL(requested).searchParams.get("q"));
  assert.equal(q, "algebra (site:hslda.org OR site:a2zhomeschooling.com)");
  // Credentials and identifiers still reach the endpoint intact.
  assert.equal(new URL(requested).searchParams.get("key"), "k!&");
  assert.equal(new URL(requested).searchParams.get("cx"), "c");
});

test("a provider error surfaces rather than masquerading as zero results", async () => {
  const provider = createGoogleProvider("web", { apiKey: "k", cx: "c", fetcher: fixtureFetch(429) });
  await assert.rejects(
    provider.search("q", { signal: new AbortController().signal }),
    /returned 429/,
  );
});
