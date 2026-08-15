# Changelog

All notable changes to the Homeschool Community Portal will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project uses pre-1.0 iterative versioning until General Availability.

## [v0.1] - 2026-08-15 - Pre-release

**Status:** Pre-release / Beta. This release supports iterative testing of a secure household-member portal and exchange. General Availability is targeted for on or before **September 30, 2026**, subject to successful safety, security, fraud-prevention, and load testing. The portal will be declared viable for general user traffic only after that testing confirms readiness.

### Added
- Secure, verified household-member messaging and exchange capabilities
- License-based verification during onboarding
- Household-controlled installation option for deployment on customer-owned hardware
- Local session-data model for self-hosted deployments; session data remains on the customer’s hardware
- Privacy-minimizing data design, retaining only the minimum operational, security, verification-outcome, and moderation records needed to protect the service
- Policy-violation and safety-event logging to support moderation and investigations
- Anti-fraud foundation including account-verification controls, rate limits, suspicious-activity monitoring, duplicate-account prevention, reporting, blocking, and administrative review workflows

### Hardware and self-hosting notice
Customers are responsible for procuring, operating, securing, maintaining, and backing up their own hardware and self-hosted deployments. Bede and Agnus Dei Technologies make no express warranty regarding customer-owned hardware and disclaim liability to the extent permitted by applicable law for its ownership, operation, availability, security, maintenance, or failure.

### Roadmap to v1.0
- Complete fraud, safety, security, and load testing
- Expand moderation, investigation, and account-review workflows
- Validate onboarding and verification controls against abuse scenarios
- Declare production readiness only after testing confirms viability for user traffic
