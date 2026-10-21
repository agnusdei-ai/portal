# Decisions (authoritative for the loop)

## Confirmed by owner
- Seat label: opaque, parent-only, accepted as consent evidence (counsel confirmed). Format <parent-word>.<code>; key is seat.id; no history; never logged; owner-only via RLS.
- Bede always runs self-hosted. The portal hosts no Bede inference and no learner state.
- Portal is part of the monthly seat; price, minimums, term, seat cap come from the signed contract, never from code constants.
- Faith curricula are optional, never mandated. On by default for family and co-op plans; off by default for school plans unless the contract allows (allow_faith_content). Portal never records a family's faith choices. Copy describes content factually; no historical claims about the Constitution.
- US English everywhere: license, catalog, behavior.

## Defaults chosen to unblock (owner may override)
- Exchange replies expire after 12 months unless both parties keep them.
- Operators read reply bodies only for reported items or ticketed support cases; MFA, separate role, audit entry per read; agents never read bodies.
- Launch: account, seat, consent, Exchange, catalog, entitlements. No payments. bede_support stored NULL. Render behind Cloudflare. Local Postgres for DB tests.
- Price book is inquiry material; prices require written confirmation before appearing in the product.
- Locuto is free and is not a priced line item.
- Co-op billing by agreement ID, no roster. School plans accept no learner data until a qualification flag is set.

## Off-limits to the loop (write BLOCKED.md and stop)
Second on-call administrator; Locuto core license lane; hosted per-account enclaves / Kubernetes; any change to prices; any live migration or production credential.
