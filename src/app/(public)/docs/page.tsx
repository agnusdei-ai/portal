import Link from "next/link";

import { DOC_SETS } from "@/lib/docs/content";

/** The docs index: a shelf per persona. */
export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Help &amp; guides</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Find straightforward help with your account, the Exchange, co-ops,
        and using Bede. Identity verification confirms you are an adult;
        it is not a teaching credential or background check.
      </p>

      <div className="mt-8 space-y-10">
        {DOC_SETS.map((set) => (
          <section key={set.persona}>
            <h2 className="text-lg font-medium">{set.label}</h2>
            <p className="mt-1 text-sm text-ink-soft">{set.intro}</p>
            <ul className="mt-3 space-y-2">
              {set.docs.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={`/docs/${doc.slug}`}
                    className="block rounded-lg border border-rule bg-white p-4 hover:border-brand"
                  >
                    <h3 className="font-medium">{doc.title}</h3>
                    <p className="mt-1 text-sm text-ink-soft">{doc.intro}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
