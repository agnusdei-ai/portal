/**
 * Hand-maintained mirror of supabase/migrations/0001_zones.sql.
 *
 * Row types must stay `type` aliases rather than `interface`. An interface has
 * no implicit index signature, so it silently fails supabase-js's GenericSchema
 * constraint and degrades every query in the codebase to `never`.
 *
 * Only the `public` schema is modelled. The `consent` schema is unreachable
 * through PostgREST by design (docs/portal.md §5), so it has no client types;
 * server code touches it through src/lib/consent/record.ts.
 */

export type SeatState = "active" | "revoked";
export type PortalRole = "account_owner" | "coop_director" | "moderator";
export type BedeSupport = "native" | "assisted" | "unsupported";
export type ListingCategory =
  | "materials"
  | "coop_opening"
  | "class_offering"
  | "announcement";
export type ListingState = "active" | "expired" | "withdrawn" | "removed";
export type ParticipantClass = "parent" | "teacher" | "guide" | "coop";

export type ConsentMethod = "payment_card" | "fallback_pending";
export type ConsentState =
  | "notice_acknowledged"
  | "granted"
  | "refused"
  | "withdrawn"
  | "disputed";

export type VerificationMethod = "socure_id_plus_docv";
export type VerificationDocumentType = "drivers_license" | "passport";
export type VerificationState =
  | "pending"
  | "verified"
  | "retry_required"
  | "manual_review"
  | "declined";

export type Account = {
  id: string;
  owner_user_id: string;
  state_code: string | null;
  created_at: string;
};

export type Seat = {
  id: string;
  account_id: string;
  state: SeatState;
  licence_token_sha256: string | null;
  licence_issued_at: string | null;
  issued_at: string;
  revoked_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};

export type UserRole = {
  user_id: string;
  role: PortalRole;
  coop_listing_id: string | null;
  granted_at: string;
};

export type Curriculum = {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  subject: string;
  grade_min: string | null;
  grade_max: string | null;
  philosophy: string | null;
  description: string | null;
  bede_support: BedeSupport;
  created_at: string;
};

export type ResourceLink = {
  id: string;
  title: string;
  url: string;
  subject: string | null;
  description: string | null;
  created_at: string;
};

export type CoopListing = {
  id: string;
  slug: string;
  name: string;
  state_code: string | null;
  region: string | null;
  description: string | null;
  meeting_day: string | null;
  enquiry_ref: string;
  is_listed: boolean;
  // 0005_coop_geo.sql — coarse, director-published meeting areas; never a
  // street address or postcode (docs/portal.md §7).
  meeting_area_lat: number | null;
  meeting_area_lng: number | null;
  meeting_area_radius_mi: number | null;
  created_at: string;
};

export type Listing = {
  id: string;
  category: ListingCategory;
  title: string;
  body: string;
  state_code: string;
  region: string;
  posted_by_account: string;
  posted_as: ParticipantClass;
  state: ListingState;
  expires_at: string;
  created_at: string;
};

export type ListingReply = {
  id: string;
  listing_id: string;
  from_account: string;
  body: string;
  created_at: string;
};

export type ListingReport = {
  id: string;
  listing_id: string;
  reported_by: string | null;
  reason: string;
  resolved_at: string | null;
  created_at: string;
};

export type Bookmark = {
  id: string;
  account_id: string;
  url: string;
  title: string;
  source_label: string | null;
  subject: string;
  note: string | null;
  created_at: string;
};

/**
 * The consent record. Modelled for server-side use only; there is no PostgREST
 * route to it. Fields are exactly compliance/parental-consent.md §4's retained
 * list, and adding one here without a citation there is a compliance change
 * rather than a schema change.
 */
export type ConsentRecord = {
  id: string;
  owner_user_id: string;
  account_id: string | null;
  notice_version: string;
  notice_acknowledged_at: string;
  consent_completed_at: string | null;
  processor_reference: string | null;
  child_account_name: string;
  method: ConsentMethod;
  state: ConsentState;
  refusal_reason: string | null;
  seat_id: string | null;
  created_at: string;
};

export type AccountParticipant = {
  account_id: string;
  class: ParticipantClass;
  granted_at: string;
};

export type CoopAffiliation = {
  coop_listing_id: string;
  account_id: string;
  class: ParticipantClass;
  vouched_at: string;
  revoked_at: string | null;
};

export type PermittedAxis = {
  a: ParticipantClass;
  b: ParticipantClass;
  note: string;
};

export type CommunicationWaiver = {
  account_id: string;
  version: string;
  sha256: string;
  accepted_at: string;
  withdrawn_at: string | null;
};

export type PaymentDispute = {
  id: string;
  seat_id: string | null;
  processor_reference: string;
  kind: "dispute" | "refund";
  opened_at: string;
  resolved_at: string | null;
  outcome: string | null;
};

/**
 * The outcome of the Socure ID+ / DocV evaluation — an attestation, never an
 * identity. 0003_verification.sql is the source of truth for the column
 * allowlist; tests/schema-invariants.test.mjs fails if this row ever gains a
 * column that could hold a name, birthdate, address, document image or number.
 */
export type VerificationAttestation = {
  id: string;
  account_id: string;
  method: VerificationMethod;
  document_type: VerificationDocumentType | null;
  vendor_evaluation_id: string;
  docv_reference_id: string | null;
  state: VerificationState;
  reason_codes: string[];
  verified_at: string | null;
  created_at: string;
};

type Table<Row, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rels;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type FK<Column extends string, Referenced extends string> = {
  foreignKeyName: `${string}_${Column}_fkey`;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Referenced;
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      accounts: Table<Account>;
      curricula: Table<Curriculum>;
      resource_links: Table<ResourceLink>;
      coop_listings: Table<CoopListing>;
      user_roles: Table<UserRole>;
      seats: Table<Seat, [FK<"account_id", "accounts">]>;
      listings: Table<Listing, [FK<"posted_by_account", "accounts">]>;
      listing_replies: Table<
        ListingReply,
        [FK<"listing_id", "listings">, FK<"from_account", "accounts">]
      >;
      listing_reports: Table<
        ListingReport,
        [FK<"listing_id", "listings">, FK<"reported_by", "accounts">]
      >;
      bookmarks: Table<Bookmark, [FK<"account_id", "accounts">]>;
      permitted_axes: Table<PermittedAxis>;
      account_participants: Table<AccountParticipant, [FK<"account_id", "accounts">]>;
      communication_waivers: Table<CommunicationWaiver, [FK<"account_id", "accounts">]>;
      payment_disputes: Table<PaymentDispute, [FK<"seat_id", "seats">]>;
      coop_affiliations: Table<
        CoopAffiliation,
        [FK<"coop_listing_id", "coop_listings">, FK<"account_id", "accounts">]
      >;
      verification_attestations: Table<VerificationAttestation>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      seat_state: SeatState;
      portal_role: PortalRole;
      bede_support: BedeSupport;
      listing_category: ListingCategory;
      listing_state: ListingState;
      consent_method: ConsentMethod;
      consent_state: ConsentState;
      participant_class: ParticipantClass;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
