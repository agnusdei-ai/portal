# Amendment 2: Self-Hosted Bede and Contract-Driven Seats

**Applies to:** blueprint revision 2 and amendment 1. **Status:** Proposed; supersedes `D-BEDE-SCOPE` in `DECISIONS.md`.

## 1. Decisions recorded

- **D-BEDE-RUNS:** Bede always runs in a self-hosted environment. No Bede inference or learner state is hosted by the portal.
- **D-SEAT-PRICING:** The portal is included in the monthly seat. Price, minimums, term, and seat caps come from the signed contract, never from constants in code.
- **D-PRICING-SOURCE:** The October 20, 2026 customer inquiry sheets are the working price book. They are inquiry material, not a public rate card, and require written confirmation.

## 2. Price book as supplied

| Plan | Price | Scope |
|---|---|---|
| Family | $199 per month, or $2,149 per year | Up to six children in one household; includes Bede Tutor, Locuto messaging, Family Portal, parent tools |
| Co-op | From $149 per family per month | Ten-family minimum; separately arranged |
| School evaluation | $950 total | Proposed 6 to 8 weeks, about 15 to 25 learners |
| Per-learner campus | $25 per learner per month, $625 monthly minimum | 25-seat minimum, 12-month commitment |
| Founding campus | $2,600 per campus per month | Unlimited enrolled seats, eligible agreements Fall 2026 to Spring 2027 |
| Standard campus | $3,500 per campus per month | Unlimited enrolled seats; each additional campus needs a separate license |

The annual family price checks out: twelve months at $199 is $2,388, so $2,149 saves $239. The founding campus saves $900 per month against standard, or $10,800 over 12 months.

## 3. What this resolves

- **Bede location:** The three-zone design stands. The landing page may state that Bede runs on the customer's own hardware, once the build matches the claim.
- **Seat price:** The inferred $49 seat is retired. Seat price is contract data.
- **Curriculum support:** Still decided separately; launch keeps `bede_support` as null.

## 4. Conflicts to resolve in code and copy

1. **Locuto is not a paid line item.** The family sheet bundles Locuto messaging inside the $199 membership, while the decision register rules Locuto itself free. Checkout copy must price the household build and portal, not a "Locuto license."
2. **Household versus seat.** The family plan is priced per household with up to six children. School plans price per learner or per campus. The billing unit therefore varies by contract; the child-level seat label remains a portal record, not necessarily a billing unit.
3. **Co-op minimum without a roster.** A ten-family minimum requires only a count of paying families. The specification prohibits a centrally held co-op roster, so billing must use account-level subscriptions grouped by a co-op agreement identifier, with no member list.
4. **Schools and real data.** The pilot is teacher-directed, synthetic-data only, and provides no direct student tutoring; real learner data needs separate qualification and written authorization. The portal must not accept school learner data until that qualification exists. School seat labels follow the same opaque rule.
5. **Unlimited seats.** Unlimited enrolled seats do not mean unlimited simultaneous use; appliance capacity is qualified per workload. A null seat cap must not imply a capacity promise.
6. **Faith content.** Public charter use requires a nondevotional academic scope, and family faith subjects are not a public charter curriculum. Catalog records need a scope tag so school accounts never see faith-subject material by default.

## 5. Entitlement model

Add a contract-driven entitlement record per paying account:

| Field | Meaning |
|---|---|
| `contract_id` | Opaque reference to the signed agreement |
| `plan_kind` | family, coop, school_eval, per_learner, campus |
| `billing_unit` | household, family, learner, campus |
| `seat_cap` | Integer, or null for unlimited enrolled seats |
| `minimum_monthly` | Contract minimum, if any |
| `term_start`, `term_end` | Commitment dates |
| `price_ref` | Reference to the contract price, not a hardcoded amount |
| `status` | active, suspended, ended |

Rules: no price constants in code; changing a plan is a recorded amendment; suspension on dispute follows the contract; no learner data fields.

## 6. Queue additions

| ID | Task | Gate |
|---|---|---|
| H01 | Entitlement table and migration (section 5), RLS owner-only | `tests/entitlement.test.mjs` |
| H02 | Remove hardcoded seat price and "Locuto household license" copy | `tests/copy-claims.test.mjs` |
| H03 | Seat-cap enforcement, null means unlimited, no capacity claim | `tests/seat-cap.test.mjs` |
| H04 | Co-op billing by agreement ID with no roster | `tests/coop-billing.test.mjs` |
| H05 | Block learner-data fields for school plans until qualification flag is set | `tests/school-gate.test.mjs` |
| H06 | Catalog scope tag; school accounts exclude faith-subject records by default | `tests/catalog-scope.test.mjs` |
| H07 | Landing copy: Bede runs on customer hardware; no claim beyond shipped behavior | `tests/copy-claims.test.mjs` |

## 7. Still the owner's

Second on-call administrator, Locuto core license lane, whether hosted per-account enclaves are needed, and written confirmation of every price before it appears in the product.
