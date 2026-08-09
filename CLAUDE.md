# Engineering rule

**Lean, and zero code bloat. This is immutable, and every other practice here derives from it.**

Waste is anything that does not earn its line. Delete before you add.

## Before writing code

1. **Does it already exist?** Reuse beats writing. Writing beats abstracting.
2. **Is it needed now?** Unwired code is inventory. If nothing calls it, do not write it;
   if nothing calls it any more, delete it.
3. **Where is the single source of truth?** If a fact would live in two places, put it in one and
   read it from there. A test that keeps two copies in sync is a sign both should not exist.

## The rules that follow

**One source of truth.** The database is authoritative for what the database enforces. A constant
mirroring a table, kept honest by a drift test, is three artefacts doing one artefact's job.

**Comments say why, never what.** `locuto/docs/portal.md` is normative and permanent. Cite it in
one line; do not restage its argument in a comment. Keep a comment only where a reader would
otherwise change the code and break something non-obvious.

**No speculative generality.** No option, parameter, or abstraction without a second caller today.

**Delete dead code the moment it is dead.** Not commented out, not left for later.

**Tests earn their place like anything else.** Test the invariant that would actually be violated.
Do not test that two copies of a fact agree — remove one copy.

**Enforce structurally, once.** A constraint belongs in the schema or a trigger, at one layer.
Duplicating it in the application is bloat unless it exists to give a better error, and then it is
a message, not a second check.

## Quality gate, every change

```bash
npm run typecheck && npm test && npm run build
```

Green before commit. No new dependency without a reason that survives asking "what breaks if we
just write the ten lines?"

## Scope

`locuto/docs/portal.md` governs *what* this repository does. This file governs *how much code* is
allowed to do it. Where a lean instinct and a compliance requirement conflict, compliance wins and
the reason goes in one comment — that is the exception, not a licence to narrate.
