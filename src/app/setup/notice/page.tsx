import {
  NOTICE_LEAD,
  NOTICE_SECTIONS,
  NOTICE_VERSION,
} from "@/lib/consent/notice";
import { NoticeForm } from "@/components/setup/notice-form";
import { Card } from "@/components/ui";

/**
 * compliance/parental-consent.md §2 step 4: the direct notice is presented in
 * full. In full is the operative phrase, so there is no summary, no accordion
 * and no link standing in for the text.
 */
export default function NoticePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Before you consent</h1>
      <p className="mt-3 font-medium text-ink">{NOTICE_LEAD}</p>

      <Card className="mt-8 space-y-6">
        {NOTICE_SECTIONS.map((section) => (
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

      <p className="mt-4 text-xs text-ink-faint">
        Notice version {NOTICE_VERSION}. We record which version you were shown,
        and when you acknowledged it.
      </p>

      <div className="mt-10">
        <NoticeForm />
      </div>
    </div>
  );
}
