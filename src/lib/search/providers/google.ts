import type { SearchProvider } from "../types";

/**
 * Google Programmable Search JSON API, the wave-one general provider (spec:
 * federated resource discovery). The homeschooling lens is the same engine
 * with the query restricted to the curated catalogue's hosts.
 */
export interface GoogleProviderOptions {
  apiKey: string;
  cx: string;
  /** Lens mode: restrict results to these hosts, e.g. "hslda.org". */
  lensDomains?: string[];
  /** Overridable for tests and dogfooding; the real endpoint otherwise. */
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createGoogleProvider(id: string, options: GoogleProviderOptions): SearchProvider {
  const endpoint = options.baseUrl ?? "https://www.googleapis.com/customsearch/v1";
  const doFetch = options.fetcher ?? fetch;

  return {
    id,
    async search(query, { signal }) {
      const q = options.lensDomains?.length
        ? `${query} (${options.lensDomains.map((d) => `site:${d}`).join(" OR ")})`
        : query;
      const url =
        `${endpoint}?key=${encodeURIComponent(options.apiKey)}` +
        `&cx=${encodeURIComponent(options.cx)}&num=10&q=${encodeURIComponent(q)}`;

      const response = await doFetch(url, { signal });
      if (!response.ok) {
        throw new Error(`search provider ${id} returned ${response.status}`);
      }

      const body = (await response.json()) as {
        items?: { title?: string; link?: string; snippet?: string }[];
      };
      return (body.items ?? []).flatMap((item) =>
        item.link && item.title
          ? [{ url: item.link, title: item.title, snippet: item.snippet ?? "", provider: id }]
          : [],
      );
    },
  };
}
