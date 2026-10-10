import { SiteHeader } from "@/components/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-ink-faint">
          Browse co-ops and curriculum without signing in. An eligible account is needed to post, reply, or set up Bede.
        </div>
      </footer>
    </div>
  );
}
