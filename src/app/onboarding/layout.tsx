import Link from "next/link";

import { getFamily } from "@/lib/onboarding/queries";
import { Stepper } from "@/components/onboarding/stepper";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const family = await getFamily();
  const reached = family?.onboarding_step ?? "family";

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <Link href="/" className="font-serif text-lg font-semibold">
            Agnus&nbsp;Dei
          </Link>
          <span className="ml-3 text-sm text-ink-faint">Setting up Bede</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[15rem_1fr]">
        <aside className="md:sticky md:top-10 md:self-start">
          <Stepper reached={reached} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
