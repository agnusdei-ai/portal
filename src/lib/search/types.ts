/**
 * The seams of federated search. Normative source: the "Federated resource
 * discovery" section of the portal spec (art_ztdch8TP) — providers sit behind
 * one interface so the provider list is configuration rather than
 * architecture, and every hit carries its attribution for as long as it is on
 * screen.
 */
export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  /** Rendered with the result. A hit without attribution is a defect. */
  provider: string;
}

export interface SearchProvider {
  readonly id: string;
  search(query: string, opts: { signal: AbortSignal }): Promise<SearchHit[]>;
}
