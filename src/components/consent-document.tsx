import type { ConsentDocument } from "@/lib/consent/document";
import { Card } from "@/components/ui";

export function ConsentDocumentView({
  title,
  doc,
  footnote,
  children,
}: {
  title: string;
  doc: ConsentDocument;
  footnote: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-3 font-medium text-ink">{doc.lead}</p>

      <Card className="mt-8 space-y-6">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-medium text-ink">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </Card>

      <p className="mt-4 text-xs text-ink-faint">{footnote}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
