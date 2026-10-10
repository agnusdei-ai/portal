# Writing for people

Agnus Dei helps real homeschool families find co-ops, browse curriculum, and exchange learning materials. Bede is the household learning companion. Locuto is Agnus Dei's separate encrypted messenger.

Write as a helpful person, not as a software brochure. Use short sentences, familiar words, and a clear next step. Avoid marketing superlatives, unexplained technical terms and claims that planned features already exist.

## Membership and access

**Membership is for verified humans only.** Anonymous people without independently verified identities, impersonators, fabricated or synthetic people, bots, agents, robots and synthetic representatives of a human are excluded from membership. A person remains accountable for their own actions and cannot confer membership on a bot by delegation. Public browsing is allowed without membership; participation is for eligible, verified human adults only. Assistive software may carry out narrowly authorized non-member functions, but may not join or act in the adult Exchange as a person. See [membership admission policy](member-admission-policy.md).

Identity verification does **not** require publishing a person's legal name, private contact information, home address or documentation. The Portal's member identities are not a public directory, and Locuto contact identities remain separate.

## Current experience, described accurately

- Browsing public listings, curriculum and co-ops does not require an account.
- An eligible account, adult identity verification and a separate Exchange communication waiver are required to post or reply.
- **Portal Exchange replies are not end-to-end encrypted today.** The service operator may read them for safety and fraud review.
- Locuto provides a separate encrypted messenger. **It is not yet integrated with the Portal's reply path.**
- Household learning records, co-op family rosters, children's progress and Locuto identifiers do not belong in the hosted Portal.
- Verification checks an adult's identity; it is not a teaching credential, background check or Locuto peer authentication.
- Bede consent/licensing is separate from adult Exchange participation.
- The existing read-only tutor discovery API currently uses the adult's authenticated session. That design needs further review before unattended agent access can meet the human-only membership policy.

## Prefer these words

| Internal phrase | Plain-language alternative |
| --- | --- |
| Portal (as a navigation destination) | My home |
| Exchange relay | Replies appear in the Portal |
| Communication axes | Who can contact whom |
| Verification principal | Verified adult |
| Vouching | A co-op confirms your role |
| Licence seat | Bede licence (one per child) |
| Enrol agent system | Read the tutor discovery guide |
| No results returned | No matches yet. Try another search. |

Do not rename database columns, API fields, consent records or security states solely to change the visible wording.

## Truthfulness and security

- A **verified adult** has completed the configured identity check. A card payment, login or email is not a substitute.
- A **verified Locuto contact** means an independent cryptographic identity check completed; a Portal request or invitation is not enough.
- **Private**, **anonymous**, **secure**, **verified** and **end-to-end encrypted** are not interchangeable. Describe who can read or learn what.
- Do not say that bots and fake accounts have been completely prevented until the admission, session, abuse and verification gates have been implemented and tested. The rule itself is absolute; evidence of effective enforcement is a separate engineering task.
- Hosted agent services do not receive private message plaintext, decryption keys, member identity credentials or human membership privileges.
- Avoid claims of audits, compliance certification, beta readiness, live payments, launched integrations or dates without current evidence.

## Editorial review

- Does every screen have an understandable action and useful loading, error, success and empty states?
- Does it describe existing behavior rather than an approved future design?
- Are Exchange, parental consent, adult identity checks and identity privacy explained consistently?
- Does it avoid marketing language that sounds like a safety guarantee without proof?
- Is it accessible at mobile widths, through keyboard input and with screen readers?
- Are the README, changelog, help guides and security policy consistent with the current release?

See the [Portal delivery checklist](implementation-checklist.md). The governing Locuto protocol requirements are held in the separate Locuto repository and are not replaced by this copy guide.
