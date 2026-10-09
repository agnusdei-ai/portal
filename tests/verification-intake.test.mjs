import { test } from "node:test";
import assert from "node:assert/strict";

import { intakeSchema, toIdentityIntake } from "@/lib/verification/intake";

/**
 * The intake is the one place a person types identity data. These tests pin
 * the residency-shaped rules: what a US submission must carry, what an
 * international submission must carry, and which documents each may verify
 * with — international is passport, always.
 */

const US_OK = {
  residency: "us",
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1985-04-12",
  email: "ada@example.com",
  line1: "12 Analytical Way",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
};

test("a US submission verifies by license or passport", () => {
  const intake = toIdentityIntake(intakeSchema.parse(US_OK));
  assert.deepEqual(intake.documentTypes, ["drivers_license", "passport"]);
  assert.equal(intake.address.country, "US");
});

test("a US submission requires a two-letter state and a five-digit ZIP", () => {
  const result = intakeSchema.safeParse({
    ...US_OK,
    state: "Oregon",
    postalCode: "9720",
  });
  assert.ok(!result.success);
  const errors = result.error.flatten().fieldErrors;
  assert.ok(errors.state?.length);
  assert.ok(errors.postalCode?.length);
});

test("an international submission requires a passport and a country", () => {
  const result = intakeSchema.safeParse({
    ...US_OK,
    residency: "international",
    state: undefined,
    postalCode: undefined,
    country: "GB",
  });
  assert.ok(result.success);
  const intake = toIdentityIntake(result.data);
  assert.deepEqual(intake.documentTypes, ["passport"]);
  assert.equal(intake.address.country, "GB");
});

test("an international submission without a country is refused", () => {
  const result = intakeSchema.safeParse({
    ...US_OK,
    residency: "international",
    state: undefined,
    postalCode: undefined,
    country: undefined,
  });
  assert.ok(!result.success);
  assert.ok(result.error.flatten().fieldErrors.country?.length);
});

test("the intake's transient contract carries exactly these fields", () => {
  // What a submission may contain, and nothing more. Every field here is
  // something the vendor needs for the check; the parsed shape is what the
  // relay holds in memory — if a field appears that a table column could
  // want, this test names it.
  const parsed = intakeSchema.parse({
    ...US_OK,
    middleName: "Byron",
    phone: "5550100",
    line2: "Unit 2",
    country: "US",
  });
  assert.deepEqual(
    Object.keys(parsed).sort(),
    [
      "city",
      "country",
      "dob",
      "email",
      "firstName",
      "lastName",
      "line1",
      "line2",
      "middleName",
      "phone",
      "postalCode",
      "residency",
      "state",
    ].sort(),
  );
});
