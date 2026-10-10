import { notFound } from "next/navigation";
import Link from "next/link";

import { getDoc, allDocs } from "@/lib/docs/content";

/** Slugs come from the content module; there is no doc outside it. */
export function generateStaticParams() {
  return allDocs().map((doc) => ({ slug: doc.slug }));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-ink-faint">
        <Link href="/docs" className="underline">
          Help &amp; guides
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-lg font-medium">{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i} className="mt-3 text-[15px] leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
