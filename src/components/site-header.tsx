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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4 sm:gap-6">
        <Link href="/" className="font-serif text-lg font-semibold text-ink">
          Agnus&nbsp;Dei
        </Link>

        <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft sm:order-none sm:w-auto">
          <Link href="/curriculum" className="hover:text-ink">
            Curriculum
          </Link>
          <Link href="/search" className="hover:text-ink">
            Resources
          </Link>
          <Link href="/coops" className="hover:text-ink">
            Find co-ops
          </Link>
          <Link href="/exchange" className="hover:text-ink">
            Exchange
          </Link>
          <Link href="/docs" className="hover:text-ink">
            Help
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <ButtonLink href="/portal" variant="secondary">
              My home
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <ButtonLink href="/setup">Get started</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
