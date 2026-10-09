import Link from "next/link";

import { Card } from "@/components/ui";
import { DOC_SETS, TUTOR_SLOT } from "@/lib/docs/content";

/** The docs index: a shelf per persona, and a held seat for the tutor. */
export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Guides</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        How the portal works, written for the person using it. Every path passes
        the same identity check; the platform certifies that you are an adult
        and nothing else.
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

        <section>
          <h2 className="text-lg font-medium text-ink-faint">{TUTOR_SLOT.label}</h2>
          <Card className="mt-3 border-dashed bg-parchment-deep/30">
            <p className="text-sm text-ink-soft">{TUTOR_SLOT.note}</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
