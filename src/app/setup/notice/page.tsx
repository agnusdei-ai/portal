import { NOTICE } from "@/lib/consent/notice";
import { NoticeForm } from "@/components/setup/notice-form";
import { ConsentDocumentView } from "@/components/consent-document";

/** parental-consent.md §2 step 4: presented in full. No summary, no accordion. */
export default function NoticePage() {
  return (
    <ConsentDocumentView
      title="Before you consent"
      doc={NOTICE}
      footnote={`Notice version ${NOTICE.version}. We record which version you were shown, and when you acknowledged it.`}
    >
      <NoticeForm />
    </ConsentDocumentView>
  );
}
