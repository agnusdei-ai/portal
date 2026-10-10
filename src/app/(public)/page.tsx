import { ButtonLink, Card } from "@/components/ui";

const LAYERS = [
  {
    title: "Start with your own books",
    body: "Look up the curriculum you already use and see where Bede is designed to help. You choose what your family learns.",
  },
  {
    title: "Keep learning in the household",
    body: "Children's learning records belong on hardware your household controls, not in the public Portal.",
  },
  {
    title: "Know what is supported",
    body: "Each curriculum listing describes Bede's level of support, so you can decide what fits your family.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">
          Made for homeschool families
        </p>
        <h1 className="mt-4 max-w-2xl text-5xl leading-tight font-semibold text-balance">
          Find good resources. Meet your community.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">
          Explore homeschool co-ops, browse curriculum, and exchange materials with
          other families. You can look around without an account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/exchange">Explore the exchange</ButtonLink>
          <ButtonLink href="/coops" variant="secondary">
            Find a co-op
          </ButtonLink>
        </div>
      </section>

      <section className="border-y border-rule bg-parchment-deep">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold">Teaching with the books you choose</h2>
          <p className="mt-2 max-w-xl text-ink-soft">
            Bede is designed to support the curriculum you have chosen. Browse the
            directory to see where help is available before setting up.
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
            <h2 className="text-2xl font-semibold">Lead a homeschool co-op?</h2>
            <p className="mt-2 max-w-md text-sm text-ink-soft">
              Help families learn about your co-op. The directory shows information
              your co-op chooses to share, without publishing a member list.
            </p>
          </div>
          <ButtonLink href="/coops">
            Learn about co-ops
          </ButtonLink>
        </Card>
      </section>
    </>
  );
}
