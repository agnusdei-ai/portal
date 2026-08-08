import { ButtonLink, Card } from "@/components/ui";

const LAYERS = [
  {
    title: "Bede knows your books",
    body: "Point Bede at the curriculum already on your shelf. It teaches from that scope and sequence — not a generic syllabus it invented.",
  },
  {
    title: "Bede runs on your hardware",
    body: "Your curriculum, your children's progress, and everything Bede knows about them stays on a machine you own. None of it reaches us, by construction rather than by promise.",
  },
  {
    title: "Bede keeps your records",
    body: "Attendance, progress, and portfolios in the format your state actually asks for, generated as you go.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">
          Homeschool co-ops &amp; curriculum
        </p>
        <h1 className="mt-4 max-w-2xl text-5xl leading-tight font-semibold text-balance">
          Every co-op and curriculum in one place. Free.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">
          Browse without an account. When you&apos;re ready, Bede takes the curriculum
          you already chose and turns it into a working school year.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/exchange">Browse the exchange</ButtonLink>
          <ButtonLink href="/curriculum" variant="secondary">
            Browse curriculum
          </ButtonLink>
        </div>
      </section>

      <section className="border-y border-rule bg-parchment-deep">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold">What you pay for</h2>
          <p className="mt-2 max-w-xl text-ink-soft">
            Not the directory — that&apos;s a lookup you could do yourself. You pay for
            the part that takes a shelf of books and runs the year.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {LAYERS.map((l) => (
              <Card key={l.title}>
                <h3 className="text-lg font-semibold">{l.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{l.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Card className="flex flex-wrap items-center justify-between gap-6 p-8">
          <div>
            <h2 className="text-2xl font-semibold">Lead a co-op?</h2>
            <p className="mt-2 max-w-md text-sm text-ink-soft">
              List your co-operative so families can find it. We publish what you
              teach and when you meet, and never hold a list of who belongs.
            </p>
          </div>
          <ButtonLink href="/setup?role=director">
            Set up your co-op
          </ButtonLink>
        </Card>
      </section>
    </>
  );
}
