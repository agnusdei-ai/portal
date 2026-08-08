import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-rule bg-parchment/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-serif text-lg font-semibold text-ink">
          Agnus&nbsp;Dei
        </Link>

        <nav className="flex items-center gap-5 text-sm text-ink-soft">
          <Link href="/curriculum" className="hover:text-ink">
            Curriculum
          </Link>
          <Link href="/coops" className="hover:text-ink">
            Co-ops
          </Link>
          <Link href="/exchange" className="hover:text-ink">
            Exchange
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <ButtonLink href="/portal" variant="secondary">
              Portal
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <ButtonLink href="/setup">Start with Bede</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
