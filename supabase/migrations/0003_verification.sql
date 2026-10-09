-- Verified-adult attestations: the outcome of the Socure ID+ / DocV evaluation.
--
-- Normative source: the "Adult verification" section of the portal spec
-- (art_ztdch8TP), under the operator's ruling of 2026-10-09: Socure,
-- native-first. The card charge remains the consent leg; this table is the
-- identity leg's record.
--
-- The load-bearing property of this table is what it does not hold. Identity
-- PII — name, date of birth, address, SSN, document numbers, document images,
-- selfies — transits the portal to Socure for evaluation and is never written
-- here or anywhere else. What survives is an attestation: a vendor reference,
-- a state, and machine-readable reason codes. A disclosure of this database
-- yields no identity document and no identity data.
--
-- tests/schema-invariants.test.mjs pins the column allowlist and fails CI if
-- it drifts.

create table if not exists public.verification_attestations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  -- One evaluation method is wired: Socure ID+ with DocV. The check documents
  -- that single-vendor ruling; a second vendor is a schema change, not a row.
  method text not null check (method in ('socure_id_plus_docv')),
  -- From the DocV result: which class of document was verified. Never the
  -- number itself, never an image, never the issuing authority or expiry.
  document_type text,
  -- Socure's evaluation / transaction reference — the portal's key into the
  -- vendor's system. It carries no PII of its own.
  vendor_evaluation_id text not null unique,
  -- The accepted-transaction reference a later Selfie Reverification is checked
  -- against, so re-verification never needs a document re-upload.
  docv_reference_id text,
  -- Stable portal vocabulary. The vendor's decisions (accept / reject / refer /
  -- resubmit / review) are mapped to these states by the portal before storage;
  -- application code never branches on vendor words.
  state text not null default 'pending'
    check (state in ('pending', 'verified', 'retry_required', 'manual_review', 'declined')),
  -- Machine-readable, non-PII. Surfaced to the account on a retry or decline.
  reason_codes jsonb not null default '[]',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.verification_attestations enable row level security;

-- The account may read its own attestation (the verify page renders its
-- state); every write belongs to the webhook that receives the vendor's
-- evaluation event, under the service role. There is deliberately no client
-- insert or update policy: an attestation written from a client callback
-- would be a verification the vendor never made.
create policy "account reads own attestation" on public.verification_attestations
  for select using (account_id = current_account_id());
