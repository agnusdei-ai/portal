import type { SearchHit } from "./types";

/**
 * First occurrence wins: the provider list is configured in trust order, so a
 * hit seen before another at the same URL is the one kept. Exact URL match —
 * cross-provider duplicates that differ by tracking parameters are not worth a
 * normaliser's worth of false merges.
 */
export function dedupeByUrl(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const kept: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    kept.push(hit);
  }
  return kept;
}

function coverage(hit: SearchHit, terms: string[]): number {
  const haystack = `${hit.title}\n${hit.url}\n${hit.snippet}`.toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length;
}

/**
 * Stable, simple ranking: hits mentioning more of the query's terms come
 * first, and equal coverage keeps the provider's own order (Array#sort is
 * stable). Not intelligence — just enough that a merged list is not arbitrary.
 */
export function rankHits(hits: SearchHit[], query: string): SearchHit[] {
  const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
  if (terms.length === 0) return hits;
  return hits
    .map((hit, i) => ({ hit, i, score: coverage(hit, terms) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((e) => e.hit);
}

export function mergeHits(perProvider: SearchHit[][], query: string): SearchHit[] {
  return rankHits(dedupeByUrl(perProvider.flat()), query);
}
