# Requirement Traceability Matrix

Maintained per SRS Appendix A. **No requirement may be closed without an associated passing test
case.** A design element with no originating requirement indicates either unrequested work or a gap
in the specification, and is reconciled rather than left.

Status values: `Not started` · `In progress` · `Implemented` · `Verified` (implemented **and**
covered by a passing test).

## Phase 0 — Repository scaffold

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-INT-040 | §6.1 Error conventions | `apps/api/src/common/errors/all-exceptions.filter.ts` | `all-exceptions.filter.spec.ts`, `health.integration.spec.ts` | Verified |
| NFR-MNT-020 | §18.3 Observability | `apps/api/src/common/logging/`, `common/middleware/request-id.middleware.ts` | `request-id.middleware.spec.ts` | Verified |
| NFR-MNT-030 | §2.3 ORM / migrations | `apps/api/prisma/migrations/` | `baseline-migration.integration.spec.ts` | Verified |
| NFR-MNT-040 | §16 Secrets | `.env.example`, `apps/api/src/config/env.schema.ts` | `env.schema.spec.ts` | Verified |
| NFR-MNT-060 | §4.2 Layer 3, §19.2 | `apps/api/test/tenant-isolation.spec.ts` | `tenant-isolation.spec.ts` | Verified (Phase 1 — see below) |
| NFR-SEC-060 | §16 Dependency scanning | `.github/workflows/ci.yml`, `.github/dependabot.yml`, `docs/dependency-exceptions.md` | CI `audit` step | Verified |
| NFR-SEC-070 | §16 Log hygiene | `apps/api/src/common/logging/redaction.ts` | `redaction.spec.ts` | Verified |
| — (infrastructure) | §2.2 Worker replica set | `apps/api/src/worker.ts` | `heartbeat.scheduler.spec.ts` | Verified |
| — (infrastructure) | §18.3 Health endpoint | `apps/api/src/health/` | `health.service.spec.ts`, `health.integration.spec.ts`, `HealthPage.spec.tsx` | Verified |
| — (infrastructure) | §4.2 Non-BYPASSRLS app role | `prisma/migrations/…_baseline_postgis` | `tenant-isolation.spec.ts` | Verified |

## Phase 1 — Tenancy, identity, audit, feature flags

### AUTH — Authentication, registration and authorisation

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-AUTH-010 | §7.1 Registration flow | `modules/identity/services/registration.service.ts` | `registration.integration.spec.ts` — "creates the account PENDING_APPROVAL" | Verified |
| FR-AUTH-020 | §7.1, ports/`otp-delivery.port.ts` | `services/otp.service.ts`, `adapters/noop-otp-delivery.adapter.ts` | `registration.integration.spec.ts` — "verifies the phone by one-time code" | Verified |
| FR-AUTH-030 | §7.1 security note | `services/auth.service.ts` (token carries no tenant) | `identity.integration.spec.ts` — "pending approval" | Verified |
| FR-AUTH-040 | §7.1, §6.2 | `registration.service.ts`, `controllers/registrations.controller.ts` | `registration.integration.spec.ts` — "approval" | Verified |
| FR-AUTH-050 | §12 (deferred despatch) | `ports/notification.port.ts`, `adapters/email-notification.adapter.ts` | `registration.integration.spec.ts` — approve/reject; `identity-notifications.integration.spec.ts` — the delivered mail | Verified — despatch closed in *Closing the open list*, step 2 |
| FR-AUTH-060 | §6.2 `/admin/users/invite` | `registration.service.ts#invite` | `registration.integration.spec.ts` — "creates an account directly by invitation" | Verified |
| FR-AUTH-070 | §4.3 Cross-tenant identity | `services/membership.service.ts` | `identity.integration.spec.ts` — "a guardian in two tenants" | Verified |
| FR-AUTH-080 | §6.2, §7.2 | `auth.service.ts#login`, `schemas/auth.ts` (discriminated union) | `identity.integration.spec.ts` — "login" | Verified |
| FR-AUTH-090 | §6.2 password reset | `auth.service.ts#requestPasswordReset/confirm` | `identity.integration.spec.ts`, `registration.integration.spec.ts` | Verified |
| FR-AUTH-100 | §16 | `auth.service.ts#recordFailedAttempt` | `identity.integration.spec.ts` — "lockout" | Verified |
| FR-AUTH-110 | §7.2 Tokens | `services/token.service.ts`, `repositories/refresh-token.repository.ts` | `identity.integration.spec.ts` — "refresh tokens" | Verified |
| FR-AUTH-120 | §16 | `services/password.service.ts`, `data/common-passwords.txt` | `password.service.spec.ts` | Verified |
| FR-AUTH-130 | — (SDD §6.2 abridged) | `registration.service.ts#setMembershipStatus` | `registration.integration.spec.ts` — "suspension" | Verified |
| FR-AUTH-140 | §7.3 Authorisation | `common/guards/` (auth, roles, feature-flag) | `authorisation-matrix.integration.spec.ts` | Verified |
| FR-AUTH-150 | §7.7 | — | — | Not started — **[V2 — Phase 12]**, deliberately not implemented |
| FR-AUTH-160 | §7.5 B2C social login | `services/handshake.service.ts`, `ports/identity-provider.port.ts`, `adapters/jwks-identity-provider.adapter.ts`; client side `apps/mobile/src/auth/identity-provider.ts` (step 1 only — native Google SDK, see decision 11) | `handshake-match.integration.spec.ts` — "the surface split", "the handshake token opens the handshake and nothing else"; `fake-identity-provider.adapter.spec.ts`. The client half is device-only: obtaining a token needs Play Services and a real Google account, so it is covered by the manual checklist in `docs/CALISTIRMA.md` §10 rather than by a suite | Verified (server); client half manually exercised |
| FR-AUTH-170 | §7.5 the phone handshake | `handshake.service.ts#requestPhoneCode/verifyPhone`, `token.service.ts` (handshake token), `common/guards/decorators.ts#HandshakeOnly` | `handshake-match.integration.spec.ts` — **Tier 1**, 18 cases | Verified |
| FR-AUTH-180 | §7.4 Shadow accounts | `registration.service.ts#invite/provisionShadow`, `membership.service.ts#assignableRoleIn` | `invitations.integration.spec.ts` — "lets the Admin assign a student before the guardian has ever signed in"; `registration.integration.spec.ts` — "creates a shadow account from a phone number alone" | Verified |
| FR-AUTH-190 | §7.6 Rejection and recovery | `services/invitation.service.ts#accept/reject/listFor` | `invitations.integration.spec.ts` — "accepts, and the children the Admin linked are simply there", "rejects without losing the Admin's configuration" | Verified |
| FR-AUTH-200 | §7.6 Resend | `invitation.service.ts#resend/correctPhone`, `registrations.controller.ts` | `invitations.integration.spec.ts` — "returns a rejected invitation to pending…", "bounds resends at three a day" | Verified |
| FR-AUTH-210 | §7 *Two authentication domains* | `handshake.service.ts#assertNotWebRole` | `handshake-match.integration.spec.ts` — "no web role authenticates through a provider" (3 cases) | Verified |

### TEN — Multi-tenancy

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-TEN-010 | §4.1, §5.1 | migrations `20260807000000`, `_canary` | `tenant-isolation.spec.ts` | Verified |
| FR-TEN-020 | §4.2 all three layers | RLS policies · `common/tenancy/` · `tenant-isolation.spec.ts` | `tenant-isolation.spec.ts` | Verified |
| FR-TEN-030 | §4.3 | `membership.service.ts#listMemberships` | `identity.integration.spec.ts`, `feature-flags.integration.spec.ts` | Verified |
| FR-TEN-040 | §5.2 | Company scope tables, all `tenant_id NOT NULL` + RLS | `tenant-isolation.spec.ts` | Verified — closed in Phase 2 |
| FR-TEN-050 | §4.4 | `impersonation.service.ts`; platform scope has no tenant context | `impersonation.integration.spec.ts` — FR-SYS-120 | Verified |

### SYS and FLG — Platform administration and feature flags

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-SYS-010 | §6.2 `/platform/tenants` | `modules/platform/services/tenant.service.ts` | `authorisation-matrix.integration.spec.ts`, `audit-immutability.integration.spec.ts` | Verified |
| FR-SYS-030 | §6.2 | `tenant.service.ts#create` (`trialDays`, default 30) | `feature-flags.integration.spec.ts` (tenant creation) | Implemented |
| FR-SYS-050 | §6.2 `/status` | `tenant.service.ts#setStatus` (state machine) | `audit-immutability.integration.spec.ts` | Implemented |
| FR-SYS-060 | — | `tenant.service.ts#assertWritable` | `company-crud.integration.spec.ts` — "a READ_ONLY tenant may read but not write" | Verified — exercised from Phase 2, as planned |
| FR-SYS-100 | §4.4, §7.2 | `platform/services/impersonation.service.ts`, `token.service.ts` | `impersonation.integration.spec.ts` | Verified |
| FR-SYS-110 | §12 | `ports/notification.port.ts` (`impersonation.started`), `adapters/email-notification.adapter.ts`, `infra/mail/` | `impersonation.integration.spec.ts`; `identity-notifications.integration.spec.ts` — "delivers to the tenant's Admin and carries the recorded reason" | Verified — the email closed in *Closing the open list*, step 2 |
| FR-SYS-120 | §4.4 | No tenant context ⇒ RLS returns nothing | `impersonation.integration.spec.ts`, `tenant-isolation.spec.ts` | Verified |
| FR-SYS-020/040/070/080/090 | §6.2, §13 | — | — | Not started — Phase 9 (sysadmin console) |
| FR-FLG-010 | §5.2 `feature_flags` | `platform/services/feature-flag.service.ts` | `feature-flags.integration.spec.ts` | Verified |
| FR-FLG-020 | §6.2 `PUT …/flags` | `feature-flag.service.ts` (cache invalidated on write) | `feature-flags.integration.spec.ts` | Verified |
| FR-FLG-030 | §7.3 vs FR-FLG-030 — see note | `auth.service.ts#login` returns 200 + `access` notice | `feature-flags.integration.spec.ts` | Verified |
| FR-FLG-040 | §7.3 guard chain | `common/guards/feature-flag.guard.ts` | `feature-flags.integration.spec.ts` | Verified |

### KVK — Audit (write path only; retention and consent are Phase 6)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-KVK-080 | §17.4 | `modules/compliance/audit.interceptor.ts`, `audit.service.ts` | `audit-immutability.integration.spec.ts` | Verified |
| FR-KVK-090 | §17.4, §5.2 | migration `20260807000200_audit_log` (REVOKE + trigger) | `audit-immutability.integration.spec.ts` | Verified |

### Non-functional

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| NFR-SEC-020 | §16 Passwords | `password.service.ts` (`ARGON2_OPTIONS`) | `password.service.spec.ts` | Verified |
| NFR-SEC-040 | §7.3 | `common/guards/` registered as `APP_GUARD` | `authorisation-matrix.integration.spec.ts` | Verified |
| NFR-SEC-050 | §16 Rate limiting | `common/rate-limit/token-bucket.service.ts`, `guards/rate-limit.guard.ts` | `rate-limit.integration.spec.ts` | Verified |
| NFR-SEC-070 | §16 Log hygiene | `common/logging/redaction.ts` (`redactObject`) | `redaction-object.spec.ts`, `audit-immutability.integration.spec.ts` | Verified |
| NFR-SEC-090 | §16 Session expiry | `env.schema.ts` (access ≤ 30 min, refresh ≤ 30 d); administrative half added in Phase 3 | `env.schema.spec.ts`, `identity.integration.spec.ts`, `web-session.integration.spec.ts` | Verified — the correction below was closed in Phase 3 |
| NFR-MNT-060 | §4.2 Layer 3 | `test/tenant-isolation.spec.ts` (schema-derived) | `tenant-isolation.spec.ts` | Verified |

#### Correction — NFR-SEC-090, found during Phase 3 design

This row read `Verified` and should not have. NFR-SEC-090 has two halves: *"Administrative sessions
shall expire after 12 hours of inactivity; mobile sessions after 30 days."* Phase 1 implemented a
single global `REFRESH_TOKEN_TTL_DAYS` (default 30) applied to both surfaces, which satisfies the
mobile half and leaves the administrative half unenforced — a stolen web refresh token stays valid
for thirty days.

Closed in Phase 3 by `WEB_REFRESH_TOKEN_TTL_HOURS` (default 12), branched on the `surface`
discriminator `loginSchema` already carries and `auth.service.ts#assertSurfaceMatchesRoles` already
reads. It is deliberately **not** closed by an idle timer in the browser: SDD §1.2 P2 makes the
server the only authority, and a timer a modified client can ignore is not an expiry.

The lesson is about this file rather than about the code — a requirement with two clauses was closed
against one of them. A row is `Verified` only when a test exercises **every** clause of the
requirement text.

### Decisions recorded during Phase 1

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §5.2 places `feature_flags`, `subscriptions`, `user_tenant_roles` and `audit_log` in "platform scope (no RLS)", yet all carry `tenant_id` — and §4.2 layer 3 discovers tenant-scoped tables by that column | RLS on `feature_flags` and `subscriptions`; `user_tenant_roles`, `audit_log` and `impersonation_sessions` registered as platform-scope exemptions in `src/common/tenancy/platform-tables.registry.ts`, each with a written justification and a named compensating control. A permanent `tenant_isolation_canary` table keeps the layer-3 data assertions alive independently of which domain tables exist. |
| 2 | FR-AUTH-020 requires phone-OTP verification; SRS §6.2 marks the SMS gateway `[V2] — interface defined, disabled` | `OtpDeliveryPort` with the full challenge lifecycle enforced server-side; `NoopOtpDeliveryAdapter` records the despatch and logs the code only outside production (SDD §1.2 P6 degraded path). No vendor code. |
| 3 | Roles live only in `user_tenant_roles` (`tenant_id NOT NULL`), so a Sysadmin — who by SDD §4.4 has no tenant context — had no way to hold their role | `users.platform_role` added by migration `20260807000400_platform_role`, constrained to `SYSADMIN`. **An addition to SDD §5.2**, which is marked abridged. Chosen over a singleton "platform" tenant, which would have required excluding one row from every tenant listing and every subscription calculation, forever. |
| 4 | FR-FLG-030 ("explanatory message rather than an error") vs SDD §7.3 ("rejected with `FEATURE_DISABLED`") | Different surfaces, both implemented: `POST /auth/login` returns **200** with an `access` notice and no tokens; every other endpoint returns **403 `FEATURE_DISABLED`**. |
| 5 | SDD §4.2 describes the tenant context as "a Prisma middleware wrapping every operation in a transaction" | A client extension cannot re-route the operation it intercepts through a transaction it opens, so a literal implementation sets the context on a different connection from the query. Implemented as `TenantPrismaService.runInTenantContext` (the wrap) plus a fail-closed extension that throws `TENANT_CONTEXT_MISSING` when a tenant-scoped model is reached outside one. |
| 6 | SDD §6.2 has no route for a multi-tenant identity to choose its working tenant, but §6.1 forbids taking the tenant from a header or body per request | Added `POST /auth/select-tenant`: the membership is verified server-side and a new access token is issued for it. §6.2 is marked abridged. |
| 7 | FR-SYS-080 (announcements) appears in PROJECT_PLAN §Phase 1 | Deferred to Phase 9 with the rest of the sysadmin console; `docs/PROJECT_PLAN.md` amended to match. |
| 8 | The common-password deny list | `apps/api/src/modules/identity/data/common-passwords.txt` ships a curated ~370-entry seed (global top passwords plus Türkiye-specific entries a global list lacks), supplemented by structural rules for sequences, repeats and keyboard walks. Designed to be replaced wholesale by a 10k corpus with no code change. |

## Phase 2 — Company configuration

*Module `company` (CMP). Schema: migration `20260808000000_company_configuration`.*

### CMP — Company configuration

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-CMP-010 | §5.2 `schools` | `modules/company/services/school.service.ts`, `repositories/school.repository.ts` | `company-crud.integration.spec.ts` — "schools (FR-CMP-010)" | Verified |
| FR-CMP-020 | §5.2 `vehicles` | `services/vehicle.service.ts` | `company-crud.integration.spec.ts` — "vehicles (FR-CMP-020)" | Verified |
| FR-CMP-030 | §13 `checkVehicleDocuments`, §6.2 `/vehicles/alerts` | `jobs/vehicle-document.service.ts`, `jobs/vehicle-document.processor.ts`, `vehicle.service.ts#alerts` | `vehicle-document.service.spec.ts` (boundaries), `vehicle-documents.integration.spec.ts` | Verified |
| FR-CMP-040 | §5.2 `staff` | `services/staff.service.ts` | `company-crud.integration.spec.ts` — "staff (FR-CMP-040)" | Verified |
| FR-CMP-050 | §5.2 `students`, `addresses` | `services/student.service.ts`, `services/address.service.ts` | `company-crud.integration.spec.ts` — "students (FR-CMP-050)"; `geocoding.integration.spec.ts` — home + alternative | Verified |
| FR-CMP-060 | §5.2 `vehicle_assignments` (`EXCLUDE USING gist`) | `services/assignment.service.ts` | `assignments.integration.spec.ts` — "overlapping assignments are refused", "substitution leaves history intact" | Verified |
| FR-CMP-070 | §5.2 `vehicle_assignments.host_id` nullable | `assignment.service.ts` | `assignments.integration.spec.ts` — "assigns a driver with no host (FR-CMP-070)" | Verified |
| FR-CMP-080 | §5.2 `route_templates`, `route_template_students` | `services/route-template.service.ts` | `route-templates.integration.spec.ts` — "membership (FR-CMP-080)" | Verified |
| FR-CMP-090 | §6.2, `CapacityStatus` | `route-template.service.ts#capacityOf` | `route-templates.integration.spec.ts` — "the capacity warning is a warning, not a block" | Verified |
| FR-CMP-100 | §8.3, §21 TI-04, `ports/geocoding.port.ts` | `services/geocoding.service.ts`, `adapters/{google,fake}-geocoding.provider.ts`, `address.service.ts#setGeo` | `geocoding.integration.spec.ts`; `fake-geocoding.provider.spec.ts` | Verified |
| FR-CMP-110 | §6.2 `/students/import`, §21 TI-08 | `import/student-import.{service,parser,template}.ts`, `jobs/geocode-address.processor.ts` | `student-import.parser.spec.ts`; `student-import.integration.spec.ts` | Verified |
| FR-CMP-120 | §5.2 `guardian_links` | `services/guardian-link.service.ts`, `adapters/guardian-link.adapter.ts` | `guardian-links.integration.spec.ts`; `registration.integration.spec.ts` — "links the approved Guardian to their children" | Verified |
| FR-CMP-130 | §5.2 `school_calendar_exceptions`, §8.1 step 1 | `services/school.service.ts`, `repositories/school-calendar.repository.ts` | `school-calendar.integration.spec.ts` — "non-service days (FR-CMP-130)" | Verified |
| FR-CMP-140 | §5.2 `school_calendar_exceptions` | `school.service.ts` | `school-calendar.integration.spec.ts` — "dismissal-time exceptions (FR-CMP-140)" | Verified |

### KVK and NFR discharged in this phase

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-KVK-100 | §5.2 `students.medical_note`, `photo_key` | `services/student-sensitive-data.policy.ts`, `student.service.ts#present` | `student-sensitive-data.integration.spec.ts` | Verified — **approximated**, see decision 3 below |
| NFR-SEC-080 | §16 File upload | `infra/storage/object-storage.service.ts`, `student.service.ts#setPhoto/photoUrl` | `student-sensitive-data.integration.spec.ts` — "signed and expires in 15 minutes" | Verified |
| FR-TEN-040 | §5.2 | Every company table carries `tenant_id`; RLS in the same migration | `tenant-isolation.spec.ts` (13 tenant-scoped tables) | Verified — was "needs Schools (Phase 2)" |
| FR-SYS-060 | — | `platform/services/tenant.service.ts#assertWritable`, called by every company write | `company-crud.integration.spec.ts` — "a READ_ONLY tenant may read but not write" | Verified — was "exercised from Phase 2" |

### Decisions recorded during Phase 2

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §5.2 declares `addresses.geo NOT NULL`, but §21 TI-08 and FR-CMP-110 require bulk-import geocoding to run as a **background** job — so the row must exist before its coordinates do. The two cannot both hold. | `addresses.geo` is nullable, paired with a `geo_status` enum (`PENDING`/`RESOLVED`/`FAILED`/`MANUAL`) and a CHECK keeping the two in step. No coordinate is ever invented: TI-04 warns that informal Turkish addresses geocode badly, and a plausible-looking wrong point is worse than an obvious gap because nothing downstream can tell it is wrong. `schools.geo` stays `NOT NULL` — FR-CMP-010 has the Admin enter it directly. **Ratified.** |
| 2 | `vehicle_assignments`' exclusion constraint: SDD §5.2 uses the default `'[)'` bounds, making `valid_to` exclusive. | Inclusive `'[]'` bounds, and `tenant_id` leads the index per SDD §5.1. `valid_to` reads as "valid through" to every Admin and to FR-CMP-060's "date-bounded"; inclusive bounds are what make the substitution arithmetic (`valid_to = effective_from - 1 day`) mean what it says. Asserted directly in `assignments.integration.spec.ts` — "refuses an assignment that overlaps on the boundary day alone". |
| 3 | FR-KVK-100 grants access to "the Driver and Host assigned to that Student's **active trip**", but trips do not exist until Phase 4 generates them. | `StudentSensitiveDataPolicy` reads it as: the caller holds an active `vehicle_assignments` row **today** on a vehicle whose active route template carries that student. Wider than the requirement by a day, narrower in nothing. Recorded rather than left silent, because a denial that reads as "implemented" is worse than a documented approximation — nobody revisits it. Phase 5 narrows the method body; no call site changes. **Ratified.** |
| 4 | SDD §6.2 lists no route for per-school calendar exceptions, route-template membership, assignment substitution or import progress. | Added under their parents: `POST/GET/DELETE /schools/:id/calendar-exceptions`, `POST/DELETE /route-templates/:id/students`, `POST /vehicles/:id/assignments/substitute` and `/:assignmentId/end`, `GET /students/import/:importId`. §6.2 is marked abridged ("standard REST CRUD per resource, plus"). Substitution is its own route rather than a PATCH: a PATCH would suggest the existing row is edited, which is the one thing FR-CMP-060 forbids. |
| 5 | `route_templates` has deliberately **no** uniqueness on `(vehicle_id, direction)`, though `trips` carries `UNIQUE (vehicle_id, direction, service_date)`. | Left to Phase 4. Two active templates for one vehicle and direction would collide at generation, but how that is reconciled — one trip serving two schools, or a refusal — is Phase 4's decision. A constraint added now is one Phase 4 may have to drop, and dropping a constraint is how data that violated it silently arrives. |

### Defects found and fixed during Phase 2 verification

Each was found by a test written for this phase; each test remains as the regression guard.

| # | Defect | Fix |
|---|---|---|
| 1 | `GOOGLE_MAPS_API_KEY=` (empty, as `.env.example` ships it) failed `z.string().min(1).optional()`, because `.optional()` admits only `undefined`. The API would not boot from the documented setup. | Empty coerced to absent in `config/env.schema.ts`. Regression: `env.schema.spec.ts` — "treats an empty API key as absent". |
| 2 | `RegistrationService.approve` opened its transaction with `runInPlatformContext`, which sets no `app.tenant_id`. The reused transaction then made every student read inside FR-AUTH-040's guardian linking return zero rows under RLS — so linking could never have worked, reported as "student not found". | Opened with `runInTenantContext`; the platform-scoped tables in the same transaction carry no policy and are unaffected. Regression: `registration.integration.spec.ts` — "links the approved Guardian to their children". |
| 3 | `SchoolRepository.create` bound bell times as `Date` parameters cast to `::time`, which the driver serialises in **server-local** time. On a container set to Europe/Istanbul an 08:30 bell was stored as 10:30. Invisible on a UTC runner. The typed update path was unaffected, so the two disagreed. | Bound as `HH:MM` strings. Integration suites now run under `TZ=America/New_York` so any such leak surfaces on every machine. Regression: `company-crud.integration.spec.ts`, `school-calendar.integration.spec.ts`. |
| 4 | `StudentImportService` used `jobId: geocode:<id>`; BullMQ rejects a custom job id containing `:`. Every bulk import failed at `addBulk`, after the students had been written. | Hyphen separator. Regression: `student-import.integration.spec.ts` — the whole suite. |
| 5 | A second `HOME` address for one student surfaced the unique index as a 500. | Pre-checked, with new error code `ADDRESS_TYPE_DUPLICATE` and Turkish message. Regression: `geocoding.integration.spec.ts` — "refuses a second home address". |
| 6 | Two CLAUDE.md layering violations: `GuardianLinkService` injected `UserRepository` and `VehicleDocumentService` injected `TenantRepository`, both across module boundaries. The latter also capped its tenant sweep at 1,000 rows with no paging, silently skipping tenants past it. | The dead `UserRepository` read removed (a PARENT membership already implies the user exists, by foreign key); the job now calls new `TenantService.listOperating()`, which pages. |
| 7 | `POST /vehicles/:id/assignments/:assignmentId/end` returned 201 for an operation that creates nothing. | `@HttpCode(HttpStatus.OK)`. |

### Test-infrastructure changes

| Change | Why |
|---|---|
| `test/tenant-seed.registry.ts` (new) | `tenant-isolation.spec.ts` discovers tables automatically, but its data assertions need a seeded row per tenant in each. The registry supplies them in FK order, and the suite fails with "no seed registered for `<table>`" when one is missing — naming the file to edit rather than reporting `expected 0 to be greater than 0`. |
| `test/fixtures.ts` | `cleanupTenants` now clears company rows child-first (every `tenant_id` FK is `ON DELETE RESTRICT`); `cleanupUsers` clears `guardian_links` first for the same reason. Company fixture builders added. |
| `test/app-harness.ts` | Binds `GoogleGeocodingProvider` to a stub that throws, making SDD §19.2's *"no test calls the Google Maps API"* a property of the wiring rather than of configuration. |
| `apps/api/vitest.integration.config.ts` | `TZ=America/New_York` — neither UTC nor the tenant default, so a value serialised in server-local time shows up as a several-hour shift on every machine. This is how defect 3 was caught. |
| `test/baseline-migration.integration.spec.ts` | The phase-boundary table list advanced from Phase 1 to Phase 2; the "later phase" guard now names the Phase 3–5 tables. |

## Phase 3 — Admin web: shell and company configuration screens

*Scope `apps/web`, `packages/contracts`, `packages/i18n`, plus the API-shape work named below.
Inserted into `docs/PROJECT_PLAN.md` before implementation began; Finance and later phases
renumbered one higher. See that document's Amendments table.*

**Built.** Rows carry the test that closes them, because a phase must not be closed against a
screen that merely renders. `Verified` below means the requirement has a passing test; where a
requirement's surface is covered by a component test *and* by the end-to-end path, both are named.

Two rows are `Implemented` rather than `Verified` and say why: their screens exist and are reachable,
but the test that would close them is not written. They are listed again under *Not closed* at the
end of this section so the gap is not hidden inside a table.

### Requirements claimed

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-CMP-010/020/040/050 | §15.1 features, §15.2 forms | `features/{schools,vehicles,staff,students}/` + `SchoolDialog`, `VehicleDialog`, `StaffPage`, `StudentDialog` | `admin-console-journey.integration.spec.ts` — "creates a student"; `FormKit.spec.tsx` — shared-schema validation | Verified |
| FR-CMP-030 | §15.2 tables | `features/vehicles/VehicleAlertsPage` over `GET /vehicles/alerts`; `expiringWithinDays` filter on the main list | `list-envelope.integration.spec.ts` — "filters vehicles by an expiry window"; `vehicle-documents.integration.spec.ts` (ordering, Phase 2) | Verified |
| FR-CMP-060/070 | §6.2 assignments | `features/vehicles/AssignmentsPanel` (add, substitute, end — no edit path exists) | `assignments.integration.spec.ts` (Phase 2, the rules the panel calls); `AssignmentsPanel.spec.tsx` — "offers no edit control on a bounded assignment" | Verified — closed in *Closing the open list*, step 3 |
| FR-CMP-080/090 | §15.2 | `features/route-templates/` + `CapacityBadge` | `admin-console-journey.integration.spec.ts` — "creates a route template and puts the student on it", asserting the capacity status on both the detail and the list | Verified |
| FR-CMP-100 | §15.2 map | `components/MapPicker` → `PATCH /addresses/:id/geo`, on `StudentAddressesPanel` | `admin-console-journey.integration.spec.ts` — "adds an address, then confirms the point by hand" (`MANUAL`, `verifiedByAdmin`) | Verified |
| FR-CMP-110 | §15.2 bulk import | `features/students/import/` — `parse-preview.ts` (client preview) → `POST /students/import` → row-level report | `student-import.integration.spec.ts` (Phase 2, the report this renders); `parse-preview.spec.ts`; `StudentImportPage.spec.tsx` | Verified — closed in *Closing the open list*, step 3 |
| FR-CMP-120 | §6.2 guardian links | `features/students/StudentGuardiansPanel` + the `GET /guardians` picker | `list-envelope.integration.spec.ts` — "lists the tenant's parents with the number of children each holds"; `guardian-links.integration.spec.ts` (Phase 2) | Verified |
| FR-CMP-130/140 | §6.2 calendar exceptions | `features/schools/SchoolCalendarPanel` | `school-calendar.integration.spec.ts` (Phase 2, both requirement halves) | Verified |
| FR-AUTH-040/060 | §6.2 `/admin/registrations` | `features/approvals/ApprovalsPage` (approve, reject, invite) | `registration.integration.spec.ts` (Phase 2); `list-envelope` — the paged queue | Verified |
| FR-AUTH-080/110 | §7.2 | `auth/AuthProvider`, `api/client.ts` single-flight refresh | `client.spec.ts` — "issues one request for concurrent callers"; `admin-console-journey` — login on the web surface | Verified |
| FR-TEN-030 | §4.3 | `auth/TenantSwitcher` → `POST /auth/select-tenant`; company name in `AdminLayout` | `identity.integration.spec.ts` — "a guardian in two tenants" (Phase 1) | Implemented — the switcher itself has no component test; see *Not closed* |
| FR-FLG-030 | §7.3 | `auth/LoginPage` renders `LoginResponse.access` as a notice, not an error screen | `feature-flags.integration.spec.ts` (Phase 1, the 200-with-notice this renders) | Verified |
| FR-SYS-060 | §15.2 read-only mode | `components/ReadOnlyProvider`, `MutatingButton`, `MutatingFieldset` | `FormKit.spec.tsx` — "disables every control and states why", "distinguishes a suspended account"; `admin-console-journey` — "refuses every write once the tenant is READ_ONLY" | Verified |
| FR-SYS-100 | §15.2 impersonation | `auth/ImpersonationBanner` (tenant, reason, live countdown) over `MeResponse.impersonation` | `impersonation.integration.spec.ts` + `admin-console-journey` — `impersonation` is null outside a session; `ImpersonationBanner.spec.tsx` — 8 cases on a fixed clock | Verified — closed in *Closing the open list*, step 3 |
| NFR-USA-050 | §15.1 | every string from `packages/i18n`; `eslint-rules/no-literal-turkish.mjs` | `pnpm lint --max-warnings 0`; `packages/i18n` parity and no-empty-string tests | Verified |
| NFR-USA-060 | §6.1 error body | `components/ErrorState` and `FormKit`'s `SubmitError` render `ApiError.message`, never `code` | `DataTable.spec.tsx` — "renders the API message and not the error code"; `FormKit.spec.tsx` — same for a rejected submit | Verified |
| NFR-USA-070 | — | `components/ConfirmDialog` + `useConfirm` on every destructive action; cancel is autofocused | `DataTable.spec.tsx` (destructive controls); manual — see *Not closed* | Implemented |
| NFR-SEC-090 | §16 | `WEB_REFRESH_TOKEN_TTL_HOURS` (default 12), carried in the refresh token's `surface` claim | `web-session.integration.spec.ts` — grant, stored expiry, refusal past the window, and no widening on rotation | Verified |

### API-shape work this phase authorises

No new business logic. Each lands with its own integration test, because changing a response shape
without one is how the mobile client breaks silently in Phase 7.

| Change | Why | SDD ref. |
|---|---|---|
| `Page<T>` (`{ data, nextCursor }`) envelope on the eight list endpoints | They return a bare array today, so no client can tell whether a next page exists. The type is already declared in `packages/shared/src/schemas/company.ts` and used nowhere. | §6.1 |
| `sort` parameter per resource, against a per-resource allow-list of columns | The DoD requires server-side sorting. An allow-list rather than a free column name, so a query cannot be steered off the index strategy. | §5.3, §6.1 |
| `search` + `status` on schools; `search` + `status` + expiry window on vehicles | Both list endpoints accept `paginationSchema` only — no filter of any kind. | §6.1 |
| `GET /guardians` (ADMIN, cursor-paged, `search`) | SRS §6.1 names Guardians an Admin screen and FR-CMP-120's picker needs to resolve a `userId`. Neither is reachable today; the nearest fallback pages every user in the tenant with no role filter. | §6.2 (abridged) |
| `GET` / `PATCH /me/tenant` (ADMIN, own tenant, derived from the token) | An Admin cannot read or edit their own company: `/platform/tenants/:id` is `@Roles('SYSADMIN')`. Sysadmin-only fields stay there. | §6.2 (abridged) |
| `impersonation: { expiresAt, tenantName, reason } \| null` on `MeResponse` | `isImpersonating` is a bare boolean, so after a reload FR-SYS-100's banner cannot show remaining session time — the one thing that makes it more than decoration. | §6.2 |

### Decisions recorded during Phase 3 implementation

| # | Point | Resolution |
|---|---|---|
| 6 | Keyset pagination compares `(sortColumn, id)` against the anchor row's pair. A `NULL` in the sort column makes that comparison `NULL` rather than `true`, so a row with an empty value vanishes from every page after the first — a list that looks complete and quietly is not. | **Only `NOT NULL` columns are offered as sorts.** `licenceExpiry`, `className`, `RouteTemplate.name` and the two vehicle expiry dates are filtered on instead, which has no such problem. Stated in `sortableQuery`'s doc comment and in each allow-list, so the next person adding a column is told why. Urgency on vehicles remains reachable through `expiringWithinDays` and `GET /vehicles/alerts`. |
| 7 | `query.ts` needed `uuidSchema` from `auth.ts` for the cursor, and `auth.ts` needed `sortableQuery` from `query.ts` for the registration list. Both read the other at module-evaluation time, which is a `ReferenceError` and not a style complaint. | `schemas/primitives.ts` holds `uuidSchema` and depends on nothing. Re-exported from `@servisapp/shared`, so no consumer's import changed. |
| 8 | `PendingRegistration` was declared in `apps/api`'s registration service with `createdAt: Date`. The console renders it, and a `Date` is not a wire type. | Moved to `packages/shared` with `createdAt: string`, per CLAUDE.md's single-source-of-truth rule. The service now serialises explicitly. |
| 9 | `GET /guardians` needs `studentCount`, which only `guardian_links` (company) can answer, while the people come from `user_tenant_roles` (identity). | `GuardianDirectoryService` lives in `company` and calls `MembershipService`, which `identity` exports — a service, never another module's repository. The `studentId` filter originally designed for the picker was dropped: the student detail screen already holds its own links and excludes them client-side, which avoids a cross-module join for no gain. |
| 10 | The phase brief says "apps/web only. No new backend endpoints. If a screen needs an endpoint that does not exist, list it and stop." | Raised rather than absorbed, and resolved in favour of `PROJECT_PLAN.md`, which is this project's authority on scope and whose Phase 3 section explicitly authorises the API-shape work above. Without it the phase's own definition of done — server-side pagination, sorting and filtering — is unreachable, and two named screens have no data source. Confirmed with the operator before any code was written. |
| 11 | `DataTable` reports a sort click as a plain `string`; each resource's allow-list is a narrower union. | `useListState` takes the allow-list and narrows `query.sort` to it, so asking for a column the server does not offer is a compile error rather than a 422 found in testing. The one cast is contained in `setSort` and justified there: the only headers the table makes clickable are the ones handed to it from that same list. |

### Not closed — **all three closed**, in *Closing the open list*, step 3

Three surfaces were built and reachable with no test of their own, and were recorded here
rather than counted as verified. Each row names the test Phase 3 asked for and the file
that now contains it; the phrasing of the *"what is missing"* column is left as it was
written, because it is what the test was written against.

| What | Why it matters | What was missing | Closed by |
|---|---|---|---|
| `AssignmentsPanel` (FR-CMP-060/070) | The substitution rules are covered by `assignments.integration.spec.ts`, so the *behaviour* is verified server-side. What is untested is that the panel offers substitution and ending and never an edit. | A component test asserting no edit control exists on a bounded assignment. | `AssignmentsPanel.spec.tsx` — 6 cases |
| `ImpersonationBanner` countdown (FR-SYS-100) | The session data is verified; the banner's derivation of remaining time from `expiresAt`, and its survival of a reload, are not. | A component test with a fixed clock. | `ImpersonationBanner.spec.tsx` — 8 cases |
| `parse-preview.ts` and the import report table (FR-CMP-110) | The server's row-level report is verified by `student-import.integration.spec.ts`. The client's CSV preview — including the semicolon delimiter Turkish Excel writes — is untested. | A unit test over the parser, and a component test over the rejected-row table. | `parse-preview.spec.ts` — 12 cases; `StudentImportPage.spec.tsx` — 8 cases |

Nothing above changed what the phase does; each was a test that should have existed before
the phase was called complete, and it took two further phases to write them. That delay is
the lesson, not the tests.

### Decisions recorded during Phase 3 design

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §15.1 and the phase brief call for a typed client **generated from the OpenAPI document the NestJS app emits**. There is no such document: `@nestjs/swagger` is not a dependency, and DTOs are Zod schemas applied by `ZodValidationPipe`, not class-validator classes for Swagger to reflect over. | `packages/contracts` is a **hand-written** typed client whose every signature is a `@servisapp/shared` type. Generating a spec would first require hand-writing `@ApiProperty` DTO classes mirroring every Zod schema — a second definition of every type, which is precisely what CLAUDE.md's "never redeclare a type locally" and the generation requirement both exist to prevent. `packages/shared` is already the single source of truth and both sides already import it; the client adds no types of its own, so a shared-type change is a compile error at every call site. An `openapi.json` emitted **from the Zod schemas** remains available later as documentation output, never as the type source. |
| 2 | PROJECT_PLAN Phase 3 was Finance; the admin web was not a phase at all. | Inserted as Phase 3, later phases renumbered. Recorded in PROJECT_PLAN's Amendments table rather than applied silently — rule 4 of that document. |
| 3 | NFR-SEC-090's administrative session was closed in Phase 1 against the mobile clause only. | Corrected above; enforced server-side in this phase. |
| 4 | `apps/web` has no map library, and FR-CMP-100's confirmation step is non-optional (SDD §21 TI-04). | `@vis.gl/react-google-maps`, matching SDD §6.2's "Maps SDK (mobile and web)" and the Google geocoding provider Phase 2 already built. Map loads are billed per session, so the picker mounts only on the address tab and never in a list (SDD §1.2 P7). With no key configured it degrades to manual latitude/longitude entry rather than disappearing (P5) — the same posture the geocoding port already takes. |
| 5 | The dashboard is a listed screen, but the aggregate endpoint is Phase 9 (SDD §15.3). | Placeholder. It does **not** issue a dozen parallel resource requests in the meantime — that is the exact shape §15.3 exists to forbid, and it would be load-bearing by the time the real endpoint arrived. |

## Phase 4 — Finance

### FIN — Fee definition (SRS §4.12.1)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-FIN-010 | §5.2 `fee_plans`, §6.2 | `modules/finance/services/fee-plan.service.ts` | `finance-arithmetic.integration.spec.ts`, `sibling-discount.integration.spec.ts` — "one fee per academic year" | Verified |
| FR-FIN-020 | §11.2 Instalment generation | `instalment-schedule.ts`, `services/student-fee.service.ts` | `instalment-schedule.spec.ts` — "Σ instalments === net_total for amounts 1…100000 × counts 1…12"; `finance-arithmetic.integration.spec.ts` | Verified |
| FR-FIN-030 | §11.2 Sibling discount | `student-fee.service.ts#resolveDiscount`, `company/services/guardian-link.service.ts#findSiblingStudentIds` | `sibling-discount.integration.spec.ts` — 2 and 3 children, after one leaves mid-year | Verified |
| FR-FIN-040 | §5.2 `student_fees.manual_adjustment` | `student-fee.service.ts` | `sibling-discount.integration.spec.ts` — "applies a surcharge after the percentage" | Verified |
| FR-FIN-050 | §6.2 `PATCH /finance/instalments/:id` | `services/instalment.service.ts#adjust` | `instalment-lifecycle.integration.spec.ts` — "adjustment before payment" | Verified |
| FR-FIN-060 | §5.2 termination columns, `payments.kind = REFUND` | `student-fee.service.ts#terminate`, `payment.service.ts#refund` | `instalment-lifecycle.integration.spec.ts` — "mid-year termination", "refund" | Verified |

### FIN — Payment recording (SRS §4.12.2)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-FIN-070 | §11.3 Payment application | `services/payment.service.ts#record` | `finance-arithmetic.integration.spec.ts` — "overpayment is rejected"; `payment-concurrency.integration.spec.ts` | Verified |
| FR-FIN-080 | §11.3 | `instalment-status.ts#deriveInstalmentStatus` | `instalment-status.spec.ts`; `finance-arithmetic.integration.spec.ts` — "partial payment" | Verified |
| FR-FIN-090 | §11.3 Reversal, CON-07 | `payment.service.ts#reverse`, `repositories/payment.repository.ts`, migration trigger | `payment-immutability.integration.spec.ts` (16 cases); `finance-arithmetic.integration.spec.ts` — "reversal restores the prior balance" | Verified |
| FR-FIN-100 | §11.4 Overdue transition | `jobs/overdue-instalments.service.ts` | `finance-jobs.integration.spec.ts` — `markOverdueInstalments` | Verified |
| FR-FIN-110 | §13 `sendPaymentReminders` | `jobs/payment-reminders.service.ts` | `finance-jobs.integration.spec.ts` — emits `instalment.due` / `instalment.overdue`, despatches nothing | Verified |
| FR-FIN-120 | §11.4 (no interest) | *absence* — nothing computes a charge | `instalment-status.spec.ts`; `finance-jobs.integration.spec.ts` — "adds no interest or penalty" | Verified |
| FR-FIN-130 | §6.2 `POST …/waive` | `instalment.service.ts#waive` | `instalment-lifecycle.integration.spec.ts` — "waiver" | Verified |
| FR-FIN-140 | §11.6 Puppeteer, §16 signed URL | `services/receipt.service.ts`, `packages/report-templates/src/receipt.ts`, `adapters/puppeteer-pdf.renderer.ts` | `finance-expenses.integration.spec.ts` — "receipts"; `finance-wiring.integration.spec.ts` | Verified |
| FR-FIN-150 | §6.2 `GET /me/fees` | `services/guardian-fee.service.ts`, `controllers/my-fees.controller.ts`; `apps/mobile/src/features/parent/FeesScreen.tsx` | `finance-wiring.integration.spec.ts` (route registered); `FeesScreen.spec.tsx` — 11 cases | Verified — the screen landed in *Closing the open list*, step 4 |
| FR-FIN-160 | §5.2 `payments.method` CHECK admits `ONLINE` | — | `payment-immutability.integration.spec.ts` — kind/sign invariant | Not started — **[V2]**, schema accommodates it, code does not implement it |
| FR-FIN-170 | — | — | — | Not started — **[V2]** |

### FIN — Expenses (SRS §4.12.3)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-FIN-180 | §5.2 `expenses`, category CHECK | `services/expense.service.ts` | `finance-expenses.integration.spec.ts` — all nine categories | Verified |
| FR-FIN-190 | §5.2 `expenses.vehicle_id` nullable | `expense.service.ts` | `finance-expenses.integration.spec.ts` — "vehicle attribution" | Verified |
| FR-FIN-200 | §16, NFR-SEC-080 | `expense.service.ts#attach`, `infra/storage` | `finance-expenses.integration.spec.ts` — "attachments" | Verified |
| FR-FIN-210 | §13 `generateRecurringExpenses` | `services/recurring-expense.service.ts`, `jobs/recurring-expenses.job.ts` | `finance-jobs.integration.spec.ts` — idempotency, inactive and unstarted rules | Verified |
| FR-FIN-220 | — | — | — | Not started — **[V2]**; salaries are ordinary expense categories in V1 |

### FIN — Financial reporting (SRS §4.12.4)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-FIN-230 | §11.6 | `services/report.service.ts#incomeExpense` | `finance-reports.integration.spec.ts` — accrual vs cash, every month present | Verified |
| FR-FIN-240 | §5.3 index, §6.2 | `report.service.ts#receivables`, `instalment.repository.ts#findReceivables` | `finance-reports.integration.spec.ts` — guardian details, settled and waived excluded | Verified |
| FR-FIN-250 | §11.5, resolves SRS OI-06 | `apportionment.ts`, `report.service.ts#vehicleProfitability` | `apportionment.spec.ts`; `finance-reports.integration.spec.ts` — "student changes vehicle mid-month" | Verified |
| FR-FIN-260 | §6.2 | `report.service.ts#studentStatement` | `finance-reports.integration.spec.ts` — "student statement" | Verified |
| FR-FIN-270 | §6.2 | `report.service.ts#occupancy` | `finance-reports.integration.spec.ts` — distinct students per vehicle | Verified — `averageAttendance` is null until Phase 6 records attendance |
| FR-FIN-280 | §11.6 | `services/report-export.service.ts`, `packages/report-templates` | `finance-reports.integration.spec.ts` — "exports to Excel and to PDF"; `html.spec.ts` | Verified |
| FR-FIN-290 | §11.1 Money representation | `packages/shared/src/money.ts`, `numeric(12,2)` throughout | `money.spec.ts` (62 cases); `finance-arithmetic.integration.spec.ts` — "never as a JSON number" | Verified |
| FR-FIN-300 | §5.2 `currency char(3)` | `student_fees`, `payments`, `expenses`, `fee_plans` | `money.spec.ts`; `finance-arithmetic.integration.spec.ts` | Verified |
| CON-07 | §1.2 P5, §5.2 `payments` | migration grants + trigger, `payment.repository.ts` (no update/delete method) | `payment-immutability.integration.spec.ts` | Verified |
| NFR-PER-080 | §11.6 Report generation | `services/report-request.service.ts`, `report_jobs`, `jobs/finance.processor.ts` | `finance-reports.integration.spec.ts` — "dispatches a range longer than an academic year" | Verified |

### Open issues closed in this phase

| ID | Resolution |
|---|---|
| OI-01 | Manual payment recording only in V1, as the SRS default. `PAYMENT_METHODS` admits CASH, BANK_TRANSFER and CARD_OFFLINE; `ONLINE` exists in the database CHECK and in no code path. |
| OI-06 | Resolved to SDD §11.5's **day-weighted** apportionment, which refines the SRS default of "apportioned by month of assignment". A student moving on the 16th of a 30-day month attributes half that month's accrual to each vehicle. Implemented in `apportionment.ts` and proven by `finance-reports.integration.spec.ts`. |

### Decisions recorded during Phase 4 design

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §11.1 specifies `decimal.js`; CLAUDE.md permits *"integer minor units **or** Decimal"*. | **Integer minor units** (`packages/shared/src/money.ts`), with `Decimal` only at the Prisma boundary. Every operation in the module is exact in kuruş and every discount exact in basis points, so `bigint` arithmetic *is* the decimal result rather than an approximation of it — which makes FR-FIN-020's sum-exactness provable from integer division rather than merely observed, and removes the failure mode a decimal library still admits: a default precision set once, far from the call site. |
| 2 | SDD §11.3 writes the status transition as `… ELSE status`. | Replaced by a single derivation, `deriveInstalmentStatus`. `ELSE status` is correct for a payment and wrong for the reversal §11.3 introduces two paragraphs later: reversing the only payment leaves the row saying `PAID` with nothing paid against it, and the receivables report would omit a debt that is genuinely owed. The derivation is idempotent, which is also what makes the nightly sweep safe to re-run. |
| 3 | SDD §5.2's finance block does not express every requirement. | Seven approved extensions, each forced by a requirement: `payments.kind` (FR-FIN-060's refund is otherwise indistinguishable from FR-FIN-090's reversal), `student_fees.manual_adjustment` (FR-FIN-040 admits a surcharge), `student_fees.status`/`terminated_on`/`termination_reason` (FR-FIN-060), `instalments.waived_at`/`waived_by` (FR-FIN-130), the `recurring_expense_rules` table §5.2 references but never declares (FR-FIN-210), `report_jobs` (NFR-PER-080), and `currency` on three tables (FR-FIN-300). |
| 4 | SDD §11.5 depends on `route_template_students` change history, which Phase 2 does not keep — `removeStudent` hard-deletes the row, so FR-FIN-250 could not be computed at all. | Additive `route_template_student_history`, written by `RouteTemplateService` inside the same transaction as the membership change and backfilled from `created_at`. `vehicle_id` is denormalised deliberately: resolving it through the template would answer with *today's* vehicle and a re-pointed template would silently rewrite the past. |
| 5 | SDD §11.6 calls for *"Puppeteer against the same React templates rendered on screen"*. The API is CommonJS NestJS with no React; `apps/web` is ESM under Vite. | `packages/report-templates` — pure `(data) => html` functions, consumed by Puppeteer in the worker and by the web app on screen. One template, two consumers, which is the property §11.6 exists to guarantee, reached by sharing the template rather than by dragging React and the web app's dependency tree into a background process. Every string comes from `packages/i18n`, so the PDF and the screen say the same words as well as showing the same numbers; `eslint.config.mjs` extends `no-literal-turkish` to the package to keep it so. |
| 6 | Puppeteer is a ~300 MB dependency with a browser process per render. | Bound to `PDF_RENDERER` **in the worker module only**; `FinanceModule` binds the deterministic fake. No API replica can launch Chromium on a request path and no test launches one at all — SDD §19.2's rule for the Maps provider, applied to the other heavyweight dependency. `finance-wiring.integration.spec.ts` asserts both bindings, because both would fail silently. |
| 7 | SDD §11.2 orders siblings "by enrolment date"; `students` has no such column. | `students.created_at`, tie-broken by `id` (a UUIDv7, itself time-ordered). Adding an `enrolled_on` column would create two answers to one question with nothing keeping them in step; the tie-break matters for the case the ordering is weakest in — a bulk import entering a whole family in one transaction. |
| 8 | `civil-dates.ts` lived in `modules/company/`. | Moved to `src/common/`. Finance needs the same conversions and a module reaching into another module's folder is the wrong shape (SDD §3.2); these functions belong to no module — they describe how the application talks to a `date` column. |
| 9 | `student_fees.net_total` after an FR-FIN-050 adjustment, an FR-FIN-130 waiver or an FR-FIN-060 cancellation. | `net_total` is the **contracted** figure and is never updated. Those three deliberately break `Σ instalments = net_total` — that is what an adjustment *is* — so every downstream figure is summed from `instalments` and none is read from `net_total`. Overwriting it would erase the evidence that a departure happened. |
| 10 | SDD §13 puts two sweeps at fixed tenant-local times; a single daily cron fires at one instant, which is one *local* hour per timezone. | The queue schedule ticks **hourly** and each sweep skips tenants whose local hour does not match (`finance-sweep.ts`). Every tenant is swept once a day at its own local hour, and a tenant in a new timezone needs no schedule change. `generateRecurringExpenses` runs daily rather than on the 1st for a related reason: a monthly cron that fired during an outage would skip the month silently, whereas a daily tick generating the current month is self-healing and idempotent. |
| 11 | NFR-PER-080 requires *"notification on completion"*; the notification module is Phase 8. | The screen polls `GET /finance/reports/jobs/:id`. The artefact is produced, stored and served identically either way, and Phase 8 adds a push on top of the same completion rather than replacing it — a degraded path with defined behaviour (SDD §1.2 P5), not a gap. |
| 12 | `payments` is append-only, yet FR-FIN-140's receipt key is necessarily written after the row exists. | `REVOKE UPDATE` at table level plus `GRANT UPDATE (receipt_key)` at column level, with a trigger that additionally requires the key to have been NULL and every other column unchanged. Narrower than either control alone; both halves asserted in `payment-immutability.integration.spec.ts`. |

### Defects found by this phase's tests, in code outside it

| What | Where | Why it mattered |
|---|---|---|
| `redactObject` could not serialise a Prisma `Decimal` — walked field by field it decomposes into `{ s, e, d, constructor }`, and the function in `constructor` made the whole document unstorable. | `common/logging/redaction.ts` | `AuditService` deliberately swallows a failed audit write so a logging fault cannot roll back the operation it describes. The symptom was therefore **silently missing audit entries for every payment, fee and expense** — the records FR-KVK-080 exists to guarantee, and the one class of defect an append-only log cannot be repaired after. Fixed by honouring `toJSON`, which covers every future value object too. Regression test in `redaction.spec.ts`. |
| `Prisma.join([])` throws on an empty array, which is the commonest school list request — no filter, no cursor. Surfaced when a transitive `sql-template-tag` bump changed the behaviour. | `modules/company/repositories/school.repository.ts` | A 500 on the plainest possible list request. Fixed by spelling out `Prisma.empty` rather than relying on `join` tolerating an empty array. |
| BullMQ rejects a custom job id containing `:`; both finance producers used one. | `modules/finance/jobs/receipt.queue.ts`, `report.queue.ts` | The receipt enqueue is best-effort by design — a Redis fault must not roll back money already taken — so the rejection was caught and logged, and **no receipt was ever produced**. Found because `finance-reports.integration.spec.ts` asserted on the report path, which propagates. |

## Phase 5 — Route generation, optimisation and absence

### ABS — Absence declaration (SRS §4.6)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-ABS-010 | §5.2 `absence_declarations` | `modules/absence/services/absence.service.ts#declare` | `absence.integration.spec.ts` — "single-day declaration for both directions", "one direction when one is given" | Verified |
| FR-ABS-020 | §5.2 `declaration_group_id` | `absence-cutoff.ts#datesInRange`, `absence.service.ts#declare` | `absence-cutoff.spec.ts` — month, leap-day and inverted ranges; `absence.integration.spec.ts` — "one row per date, sharing a group", "cancels a whole range as one act" | Verified |
| FR-ABS-030 | §5.2, tenant `routing` settings | `absence-cutoff.ts#evaluateCutoff`, `absence.service.ts#assertOpen` | `absence-cutoff.spec.ts` — 17 cases, boundary-exhaustive: one minute before, exactly at, after, per direction, past and future dates, the tenant clock, and midnight not read as hour 24 | Verified |
| FR-ABS-040 | §17.4 audit write | `absence.service.ts#assertOpen` (the ADMIN exemption), `AuditService` | `absence.integration.spec.ts` — "records the declaring party on the row"; audit entry `absence.declared` | Verified |
| FR-ABS-050 | §8.4 Live route adaptation | `modules/routing/services/route-adaptation.service.ts#applyDeclaration` | `absence.integration.spec.ts` — "cancels a stop when the last child expected there declares absence", "restores the child when the declaration is cancelled before departure" | Verified |
| FR-ABS-060 | §6.3 `route:changed`, §12.2 | `route-adaptation.service.ts` emits `route.changed` after commit; `notification.service.ts` resolves the crew | `absence.integration.spec.ts` (the event is emitted on the same path); `notifications.integration.spec.ts` — "reaches the driver and host, and nobody's guardian" | Verified — the despatch closed in *Closing the open list*, step 2 |
| FR-ABS-070 | §5.2 `alternative_address_id`, `kind` | `absence.service.ts#assertNominableAddress`, `route-generation.service.ts#resolveAddress` | `absence.integration.spec.ts` — another student's address, an unlocated address, a contradictory body; `route-generation.integration.spec.ts` — "collects a student from the alternative address they nominated" | Verified |
| FR-ABS-080 | §6.2 `POST /absences` response | `absence.service.ts#confirmationFor` | `absence.integration.spec.ts` — "says no trip is affected yet when the route has not been generated"; the affected-trip payload is asserted in the FR-ABS-050 cases | Verified |
| OI-10 | §5.2 `att_state`, SRS §8 | `absence.service.ts#assertNotAboard` | `absence.integration.spec.ts` — "refuses a declaration for a child who has already boarded" | Verified — resolves SRS OI-10 |

### RTE — Route generation and optimisation (SRS §4.7)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-RTE-010 | §8.1 pipeline, §5.2 `trips` | `modules/routing/services/route-generation.service.ts` | `route-generation.integration.spec.ts` — "generates nothing on a non-service day", "is idempotent: a second run creates no second trip" | Verified |
| FR-RTE-020 | §13 `generateDailyTrips`, §8.1 step 2 | `jobs/generate-daily-trips.service.ts`, `jobs/routing-job.ts#isGenerationHour` | `route-generation.integration.spec.ts` — "excludes a student with an active absence declaration" | Verified |
| FR-RTE-030 | §8.1 step 3 | `route-generation.service.ts#resolveAddress` | `route-generation.integration.spec.ts` — the alternative address case, and "leaves a student with no located address off the route and warns" | Verified |
| FR-RTE-040 | §8.1 step 5, `ST_ClusterDBSCAN` | `services/stop-clustering.service.ts` | `route-generation.integration.spec.ts` — "merges two addresses 100 m apart into one stop", "keeps two addresses 101 m apart as separate stops" | Verified |
| FR-RTE-050 | §8.2 Routes API, `TRAFFIC_AWARE` | `adapters/google-routes.provider.ts`, `services/route-optimiser.service.ts` | `routing-wiring.integration.spec.ts`; `straight-line.spec.ts` for the ordering contract | Verified |
| FR-RTE-060 | §8.1, §8.2 pinned ends | `trip-schedule.ts#planEnds`, `#fullStopOrder` | `route-generation.integration.spec.ts` — "terminates the morning route at the school"; `trip-stop-order.integration.spec.ts` — "keeps the school at its pinned end after a reorder"; `straight-line.spec.ts` — 2-opt never moves either end | Verified |
| FR-RTE-070 | §8.1 step 4, `trips.blocked_reason` | `route-generation.service.ts`, `trip.service.ts#reoptimise` | `route-generation.integration.spec.ts` — "blocks a trip whose student count exceeds the vehicle capacity" (which also asserts that **no** provider call was made), "refuses to re-optimise a blocked trip" | Verified |
| FR-RTE-080 | §8.1 step 8, `trips.warnings` | `route-generation.service.ts` (`ARRIVAL_AFTER_BELL`) | `route-generation.integration.spec.ts` — the warning surface; it warns rather than blocks by construction, as the requirement states | Verified |
| FR-RTE-090 | §8.2 Fallback | `adapters/fallback-route.provider.ts`, `optimisation/straight-line.ts`, `route-optimiser.service.ts` | `straight-line.spec.ts` (17 cases); `route-generation.integration.spec.ts` — "falls back to the offline optimiser when the provider is unavailable", "returns the reservation when the provider answers nothing" | Verified |
| FR-RTE-100 | §8.3 Cache | `services/route-cache.service.ts`, `route-optimiser.service.ts` | `route-cache.spec.ts` (12 cases on the key); `route-generation.integration.spec.ts` — "makes no provider call when a route is viewed again", "reuses the cached order for an identical stop set on the same weekday" | Verified |
| FR-RTE-110 | §8.1 step 6, `trips.order_locked`, `route_templates.manual_stop_order` | `trip.service.ts#updateStopOrder`, `trip-schedule.ts#applyManualOrder` | `trip-stop-order.integration.spec.ts` — 6 cases, including "carries a locked order into the next generation" and "refuses a partial order rather than interpreting it" | Verified |
| FR-RTE-120 | §5.2 `trip_stops.is_adhoc` | Deferred to Phase 6 — see that section | as recorded there | Verified in Phase 6. It required an active trip and the Driver application, which this phase excludes; the re-optimisation engine it needed was built here (`route-adaptation.service.ts`) |
| FR-RTE-130 | §5.2 `trip_stops.skip_reason`, `stop_state.SKIPPED` | Deferred to Phase 6 — see that section | as recorded there | Verified in Phase 6, for the same reason |
| FR-RTE-140 | §6.2 `GET /trips/:id` | `trip.service.ts#get`, `apps/web/src/features/trips/TripDetailPage.tsx` | `route-generation.integration.spec.ts` — numbered stops, per-stop ETA and a monotonic schedule; `trip-stop-order.integration.spec.ts` — the totals after a reorder | Verified — the stop list, the ETAs and the totals. The **map layer** is deferred to Phase 7; see decision 9 |
| FR-RTE-150 | §11.6 Puppeteer, §16 signed URL | `services/route-sheet.service.ts`, `packages/report-templates/src/route-sheet.ts`, `jobs/route-sheets.module.ts` | `finance-wiring.integration.spec.ts` and `routing-wiring.integration.spec.ts` — the renderer is bound in the worker only; `html.spec.ts`; `route-sheet.spec.ts` — 15 cases over the four things the requirement says the sheet must contain | Verified — closed in *Closing the open list*, step 5. The endpoint, the template and the worker binding were asserted from this phase; what was missing was the **contents**, and those live in the HTML rather than in Puppeteer's output |
| FR-RTE-160 | — | — | — | Not started — **[V2]** (per-student time windows, multi-vehicle load balancing) |

### Cross-cutting requirements discharged in this phase

| Requirement ID | Design element | Implementing module | Test case | Status |
|---|---|---|---|---|
| NFR-PER-050 | §8.1, §13 | the whole pipeline | `route-generation.benchmark.integration.spec.ts` — 100 vehicles × 18 stops with a 200 ms provider latency: **34.6 s** against a 600 s budget | Verified |
| SDD §18.3 Maps indicator | §8.3 quota alarm | `health/indicators/maps.health.ts` | `health.integration.spec.ts` — four dependencies reported separately | Verified |
| SDD §4.2 (five new tables) | RLS ENABLE + FORCE + policy, in the migration that creates each table | `20260810000000_routing_absence` | `tenant-isolation.spec.ts` — 20 cases, discovered from the live catalogue | Verified |
| SDD §19.2 *"no test calls the Google Maps API"* | the provider behind a port | `ports/route-provider.port.ts` | `routing-wiring.integration.spec.ts` — the token resolves to the fake **and** `GoogleRoutesProvider` refuses to construct under `NODE_ENV=test` | Verified — two independent controls |

### Open issues closed in this phase

| ID | Resolution |
|---|---|
| OI-02 | Route composition resolved to the SRS default: **automatic generation from student addresses**, with driver-added ad-hoc stops permitted during an active trip (FR-RTE-120, Phase 6). Generation is `RouteGenerationService`, and nothing in the system lets a Guardian or a Driver choose a vehicle. |
| OI-10 | A declaration against a child already `BOARDED` is **rejected** (`STUDENT_ALREADY_BOARDED`) and the Admin notified through the audit entry `absence.rejected.alreadyBoarded`, which carries the vehicle plate. Accepting it would tell a parent "recorded" while their child sat on the vehicle — the one outcome an absence feature must never produce. |

### Decisions recorded during Phase 5

| # | Point | Resolution |
|---|---|---|
| 1 | `PROJECT_PLAN.md` places ABS in Phase 6. | **Moved to Phase 5**, recorded in the plan's Amendments table. FR-RTE-020 defines generation as including *"only Students without an active absence declaration"*, so the routing phase cannot be completed without it — and a pipeline that ignored absences would be rewritten rather than retrofitted. |
| 2 | FR-RTE-120 and FR-RTE-130 fall inside the FR-RTE-* range this phase claims. | **Left in Phase 6.** Both need an active trip and the Driver application, which this phase explicitly excludes, and SDD §6.2 lists them under *Trip execution*. The §8.4 re-optimisation engine they depend on is built here, so Phase 6 adds only the trigger. |
| 3 | **SDD §8.1's clustering SQL does not do what it says.** `ST_ClusterDBSCAN(geo::geometry, eps := 100)` expresses `eps` in the spatial reference system's own units, and casting a `geography` yields SRID 4326 — whose units are **degrees**. A hundred degrees is wider than any continent: every address in the tenant would collapse into a single stop in a field. | Clustering happens in a metric projection (EPSG:3857) with the radius divided by `cos(latitude)`, taken at the stop set's own mean latitude. The residual error across a city is under 0.2 % — about 20 cm on a 100 m radius. A national grid would be more accurate and would need a zone chosen per tenant, which is a configuration item bought for a fifth of a percent. `StopClusteringService` carries the full note. |
| 4 | DBSCAN with `minpoints := 1` **chains**: A–B 90 m and B–C 90 m merges all three even where A and C lie 180 m apart, so a cluster centroid can sit further from a member than the tenant configured. | The SDD behaviour is kept — it is what §8.1 asks for and usually what an operator wants, since a terrace of houses is one stop. The *consequence* is not left implicit: `ClusteredStop.spreadM` carries the distance and generation raises `STOP_SPREAD_EXCEEDED`. A child walking further than agreed is a safety matter discovered at a kerb, not in a log. |
| 5 | **SDD §8.3's cache key** is `route:{templateId}:{sortedStudentIdHash}:{dayOfWeek}`. | Replaced by `route:v1:{tenantId}:{schoolId}:{direction}:{stopSetHash}:{dow}:{depBucket}`, for four reasons: (a) the optimiser's input is a *stop set*, so a sibling joining at an address already on the route would be a billable call for an answer already held; (b) the result is `TRAFFIC_AWARE` and therefore a function of departure time, and §8.3's key would serve a 07:00 route to an 08:30 run; (c) a Redis key is visible to anything that can `--scan`, and §8.3's key would put a hash of a family's children in it (NFR-SEC-070); (d) Redis has no row-level security, so the tenant is in the key by construction. Proven by `route-cache.spec.ts`. |
| 6 | SDD §8.1 step 6 reads `template.order_locked` and reuses *"the previous manual order"*; §5.2's `route_templates` declares neither. | Both added: `route_templates.order_locked` and `manual_stop_order`, the latter an ordered array of **anchor keys** rather than of stop ids, because tomorrow's stops are new rows. `trips.order_locked` alone would satisfy FR-RTE-110 for a single day and lose the Admin's work overnight, which is not what "lock against re-optimisation" means to the person who did the reordering. |
| 7 | `trips.driver_id` is NOT NULL, but a route template carries no driver — the crew comes from `vehicle_assignments` on the service date, and there may be none. | No trip is created, and the run records a `NO_ASSIGNMENT` issue the Admin can read. Inventing a driver would put a name against a vehicle nobody agreed to drive, and making the column nullable to allow a driverless trip would make it nullable for every trip for ever. |
| 8 | Phase 2 deliberately left `route_templates` without uniqueness on `(vehicle_id, direction)`, deferring to this phase how two active templates colliding against `trips`' unique key should be reconciled. | The **earliest-created template wins** and the rest are reported as `DUPLICATE_TEMPLATE`. Refusing both would be tidier and would leave the children of both routes uncollected; `findActiveForGeneration` orders by `created_at`, so "earliest" is a rule rather than whichever row the planner happened to return first. |
| 9 | FR-RTE-140 asks for *"the planned route on a map"*. | The numbered stop list, the per-stop ETA and the totals ship now; the **map layer is deferred to Phase 7**. `MapPicker` renders one point rather than a path, and a polyline with no vehicle on it is a picture — Phase 7's live tracking brings the marker that makes the map worth opening. What an Admin reads before releasing a route is the timed stop list, and that is complete. |
| 10 | FR-RTE-070, FR-RTE-080, FR-RTE-090 and FR-ABS-050 each end *"…and notify the Admin"*; the notification module is Phase 8. | `route_generation_runs`, plus `trips.blocked_reason` and `trips.warnings`, surfaced on the trips screen. The same degraded path Phase 4 took for NFR-PER-080's completion notice (decision 11 there): Phase 8 adds a push *on top of* the same record rather than replacing it (SDD §1.2 P6). No new `DomainEvent` member was added — `route.changed` already exists in the union. |
| 11 | SDD §8.2 specifies `ST_Distance` for the fallback optimiser. | Haversine in process. The points are already loaded by clustering, a stop set is bounded by vehicle capacity (a 27×27 matrix is roughly 700 evaluations), and generation for a hundred vehicles would otherwise make a hundred database round trips to save nothing. The properties §8.2 cares about are untouched — no network, straight-line distance, bounded work — and a pure function is what lets 2-opt's ordering invariant be asserted directly. |
| 12 | The route cache is shared by two callers that name their stops differently: generation clusters points that have no rows yet (`stop-0`, `stop-1`, …) while re-optimisation reorders rows (`trip_stops.id`). | The cached order stores **anchors** — the same rounded coordinates `stopSetHash` is built from — and each caller translates back into its own namespace. Found by `trip-stop-order.integration.spec.ts`: an entry written by generation and read by re-optimisation produced `22P02 invalid input syntax for type uuid: "stop-2"`, and only against a warm cache. |
| 13 | `MAPS_MODE` versus `ROUTE_PROVIDER`. | Two settings, deliberately. The provider is a deployment choice; the mode is the lever somebody pulls at two in the morning after reading a bill, without a redeploy (SDD §1.2 P6). `fallback` is also a legitimate *production* provider — it is free, it is what FR-RTE-090 falls back to anyway, and a tenant that would rather pay nothing is making a supported trade. Only the deterministic fake is refused in production. |
| 14 | The budget guard's cost unit. | Integer **micro-USD**, for the reason FR-FIN-290 forbids float for money: a counter incremented in floating point drifts over thousands of calls, and a budget guard that has drifted stops working at the moment it matters. The reservation is taken *before* the call and refunded when the call produces nothing, so a sustained outage cannot exhaust a budget it never spent and then refuse the calls made after it recovered. |

### Defects found by this phase's tests, in code outside it

| What | Where | Why it mattered |
|---|---|---|
| `RouteSheetService` is re-provided in the worker so the Puppeteer binding applies to it, and a re-provided class resolves in *that* injector — so `ObjectStorageService` and `TenantService` had to be reachable from there too, not merely from `RoutingModule`. | `modules/routing/jobs/route-sheets.module.ts` | The worker would not boot at all. Caught by `finance-wiring.integration.spec.ts`, which compiles `WorkerModule` — the only suite that does. |

### Test-infrastructure changes

| Change | Why |
|---|---|
| `createLocatedAddress`, `createRoutedStudent`, `createNonServiceDay`, `cleanupRoutingData` | `createAddress` leaves the point NULL, which is what FR-CMP-110's import produces and what the company suites want. Route generation needs the opposite: an unlocated address is deliberately excluded from the stop set, so a routing suite using the plain fixture would produce empty routes and prove nothing. |
| `ObjectStorageService.exists` | FR-RTE-150 keys a sheet by the route's own version, so *"has this version been rendered"* is a question with no database column behind it — the answer lives in the bucket. `HeadObject`, so asking about a 200-page PDF costs one round trip and no bytes. |
| `route-generation.benchmark.integration.spec.ts`, behind `RUN_BENCHMARKS=1` | Seeding 100 × 18 students takes longer than the generation it measures. `describe.skipIf` keeps it out of an ordinary run without making it a file somebody has to remember exists. |

## Phase 6 — Trip lifecycle, attendance, sweep check and offline intake

*SRS Appendix B phase 5, backend only. Modules `trips` (TRP, ATT) and `sync` (OFF).*

**Status.** The suites have now been run against a live database (2026-08-15) and are green:

> **Amended by Phase 7.** The two rows this section left `Implemented` are now `Verified`, and the
> first run of their tests found that *neither detector had ever returned a row*: both scanned on a
> platform-scope transaction, which RLS answers with nothing. See Phase 7's decision 6. The passage
> below is left as written, because it is the record of what was known at the time.

| Command | Result |
|---|---|
| `pnpm test:tenant-isolation` | 20 passed |
| `pnpm test:integration` | 520 passed, 2 skipped — the opt-in route-generation benchmark |
| `pnpm test:trip-invariants` | 66 passed (`trip-invariants.spec.ts` 59, `offline-sync.spec.ts` 7) |

Every row below with a test case behind it is therefore `Verified`. **Two rows stay `Implemented`
on purpose**, both for the reason decision 6 records: FR-TRP-090 has no test at all, and FR-ATT-100's
overdue *detector* has none although its invariant is proven. Raising either would close a
requirement without a passing test, which this document does not permit.

The first execution of these suites found **five defects in Phase 6 production code** — none of which
static checking could have caught, since every one of them is a disagreement with the database or the
DI graph — plus a set of test-harness faults. They are recorded as decisions 14 to 19 below.

### TRP — Trip lifecycle

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-TRP-010 | §9.1 state machine | `trips_transition_guard()` in `20260811000000_trip_execution`, `services/trip-lifecycle.service.ts` | `trip-invariants.spec.ts` — "the trip state machine admits exactly the edges of SDD §9.1" | Verified |
| FR-TRP-020 | §9.1 stop machine | `trip_stops_transition_guard()`, `services/stop-execution.service.ts` | `trip-invariants.spec.ts` — "the stop state machine admits exactly the edges of FR-TRP-020" | Verified |
| FR-TRP-030 | §9.1 invariant table | `services/geofence.ts`, `services/trip-actor.ts#assertMayStart` | `trip-execution.integration.spec.ts` — "only the assigned driver, and only from near the first stop" | Verified |
| FR-TRP-040 | §5.2 `trips` | `started_at`/`finished_at`/`started_by`/`finished_by` and their CHECK constraints | `trip-execution.integration.spec.ts` — "starts from inside the 500 m radius" | Verified |
| FR-TRP-050 | §9.1 | `stop-execution.service.ts#arrive`, `trip-execution.repository.ts#findStopWithinRadius` | `trip-execution.integration.spec.ts` — "arrival, automatic and manual" | Verified |
| FR-TRP-060 | §9.1 invariant table | `trips_transition_guard()` (`TRP02`), `trip-lifecycle.service.ts#assertStopsTerminal` | `trip-invariants.spec.ts` — "SWEEP_PENDING is unreachable while a stop is PENDING or ARRIVED" | Verified |
| FR-TRP-070 | §6.2 `/trips/:id/cancel` | `trip-lifecycle.service.ts#cancel`, `trips_cancel_reason_present` | `trip-execution.integration.spec.ts` — "cancels with a reason" | Verified |
| FR-TRP-080 | §6.2 (abridged) | `PATCH /trips/:id/assignment`, `trips_transition_guard()` (`TRP05`) | `trip-execution.integration.spec.ts` — "refuses to reassign one that has started" | Verified |
| FR-TRP-090 | §13 `detectOverdueTrip` | `jobs/overdue-detection.service.ts`, `jobs/trips.processor.ts` | `overdue-detection.integration.spec.ts` — "detectOverdueTrip"; `job-schedules.integration.spec.ts` — the ten-minute cadence | **Verified** — closed in Phase 7 (see its decisions 6 and 7) |
| FR-TRP-100 | §6.2 (abridged) | `services/retrospective-trip.service.ts` | `trip-execution.integration.spec.ts` — "an Admin records a day the applications were not in use" | Verified |
| FR-TRP-110 | §5.2 `trip_events` | `services/trip-history.service.ts`, `GET /trips/:id/events` | `offline-sync.spec.ts` — the conflict review surface | Verified |

### ATT — Attendance and sweep check

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-ATT-010 | §9.1 | `services/attendance.service.ts`, `trip_stop_students_transition_guard()` | `trip-invariants.spec.ts` — the attendance edge matrix | Verified |
| FR-ATT-020 | §9.1 | as above (`BOARDED → DROPPED_OFF`) | as above | Verified |
| FR-ATT-030 | — | Mobile UI — not this phase; the backend serves the batch endpoint | — | Not started (out of scope) |
| FR-ATT-040 | — | No guardian confirmation exists; there is nothing to build | — | Verified by absence |
| FR-ATT-050 | §5.2 | `trip_stop_students_recorded_complete` CHECK, `applyAttendance` | `trip-execution.integration.spec.ts` | Verified |
| FR-ATT-060 | §9.1 invariant table | `trip_stops_transition_guard()` (`STP03`), `findUnmarkedAtStop` | `trip-invariants.spec.ts` — "COMPLETED is unreachable with an unmarked student" | Verified |
| FR-ATT-070 | §12.2 | `student.noShow` emitted after commit; despatch is Phase 8 | `trip-execution.integration.spec.ts` | Verified (event; despatch Phase 8) |
| FR-ATT-080 | §5.2 `sweep_checks` | `services/sweep.service.ts` | `trip-execution.integration.spec.ts` | Verified |
| FR-ATT-090 | §5.2 | `recordSweepSchema`'s `z.literal(true)`, `CHECK (confirmed)` | `trip-invariants.spec.ts` — "a sweep row cannot record the absence of a confirmation" | Verified |
| FR-ATT-100 | §9.1 invariant table, §13 | `trips_transition_guard()` (`TRP03`), `detectOverdueSweep` | `trip-invariants.spec.ts` — "FINISHED is unreachable without a sweep check"; `overdue-detection.integration.spec.ts` — "detectOverdueSweep" | **Verified**, both halves — the detector was closed in Phase 7 |
| FR-ATT-110 | §9.1 — *"the system's most important safety invariant"* | `trips_transition_guard()` (`TRP04`), `findStillAboard` | `trip-invariants.spec.ts` — "FINISHED is unreachable while a student is BOARDED" | Verified |
| FR-ATT-120 | §6.2 (abridged) | `services/attendance-correction.service.ts`, `app.attendance_correction` | `trip-execution.integration.spec.ts` — "writes an edge the crew machine does not have" | Verified |
| FR-ATT-130 | — | `sweep_checks.photo_key` created, never written | — | Not started — **[V2]**, deliberately not implemented |

### OFF — Offline operation, server side

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-OFF-030 | §10.3 | `trip_events_client_event_id_key` partial unique index, `TripEventRepository#claim` | `offline-sync.spec.ts` — "applies the same batch three times and writes one record" | Verified |
| FR-OFF-060 | §10.5 | `recorded_offline` on `trip_events` and on the projection, exposed in `TripStopStudentDto` | `offline-sync.spec.ts` | Verified |
| FR-OFF-070 | §10.4 | `AttendanceService#serverValuePrevails`, the `trips.attendance.conflict` audit entry | `offline-sync.spec.ts` — "rejects an offline mark that disagrees with an Admin correction" | Verified |
| FR-OFF-010/020/040/050 | §10.1, §10.2 | Device-side — mobile, not this phase | — | Not started (out of scope) |

### RTE — the driver's own stop actions

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-RTE-120 | §8.4, §6.2 | `stop-execution.service.ts#addAdhoc`, `services/reoptimise.queue.ts` | `trip-execution.integration.spec.ts` — "the driver adds an ad-hoc stop" | Verified |
| FR-RTE-130 | §6.2 | `stop-execution.service.ts#skip`, `trip_stops_skip_reason_valid` | `trip-execution.integration.spec.ts` — "skipping a stop" | Verified |

### Decisions recorded during Phase 6

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §3.1 gives the trip tables to `trips`, but Phase 5 built their repositories inside `routing`, and SDD §3.2 forbids a service from reaching another module's repository. | **`TripRepository` and `TripStopRepository` moved to `modules/trips`**, with the read surface. `routing` keeps generation, optimisation and the Admin's reorder, and persists through an exported `TripPlanService` seam. The split is by *decision*, not by table: `routing` decides the order of the stops, `trips` decides what may legally happen once a driver has the trip. One mechanical commit with no behaviour change; Phase 5's suites are the regression net. |
| 2 | **CLAUDE.md P5 makes attendance append-only; SDD §5.2 models it as a mutable `status` column,** which Phase 5 already updates. | Reconciled rather than chosen between. An append-only **`trip_events`** table records every assertion, and `trip_stop_students.status` remains as the *projection of the latest applied event* — nothing in §5.2 changes shape. Three other requirements needed the table anyway and had nowhere to live: FR-OFF-030's idempotency across every event kind, §10.4's per-event *client* timestamp, and FR-ATT-120's retention of the original value. |
| 3 | Neither document says how many `trip_stop_students` rows a child has, and generation writes exactly one, at their **home** stop. | Confirmed as **one row per child per trip**; `status` is the child's state *on the trip*, which is how SDD §9.3 already reads it. FR-ATT-060 then has four cases rather than one — a *boarding* stop refuses a `PENDING` child, an *alighting* stop refuses a `BOARDED` one, and a school stop's scope is the whole trip because it carries no rows of its own. Written once as a SQL `CASE`, used by both the trigger and the error message. |
| 4 | **FR-TRP-090 requires an Admin alert; SDD §3.3's `DomainEvent` union has no member for it,** and §12.2's `trip.delayed` is guardian-facing and equally absent from the union. | A gap inside the SDD rather than an SRS/SDD disagreement, since FR-TRP-090 is unambiguous. Added `trip.overdue` to `packages/shared/src/events.ts`. **SDD §3.3 and §12.2 still need the matching amendment** — recorded here as outstanding. `trip.delayed` remains unimplemented (Phase 8). |
| 5 | SDD §9.1's diagram appears to draw a second arrow `STARTED → FINISHED`. | Read as an artefact of the box drawing. FR-TRP-010, FR-TRP-060 and §9.1's own invariant table all describe the linear path, so no such edge exists and a trip cannot finish without passing through the sweep. Not raised as a conflict, because the SRS and the SDD's *text* agree. |
| 6 | FR-TRP-090's and FR-ATT-100's detectors have no test. | The jobs are implemented and made idempotent by a column stamp, but a suite would have to manipulate the clock across a BullMQ scheduler. Deferred to Phase 7, which brings `detectSignalLoss` and the same shape of problem — one clock harness for three jobs rather than two. **This is why FR-TRP-090 cannot be marked Verified.** <br><br> **Settled in Phase 7, and the deferral was expensive.** The harness landed as `test/clock-harness.ts` and its first assertion found that both detectors had been returning nothing on every tick since they shipped — a platform-scope scan against an RLS-forced table. A safety alert whose failure mode is silence is the one that most needs a test, which is the reading this row got backwards. |
| 7 | FR-ATT-120 lets an Admin write an edge the state machine does not have, and the database cannot see roles. | `SET LOCAL app.attendance_correction = 'on'`, issued by `AttendanceCorrectionService` inside its own transaction and honoured by the attendance trigger — the same mechanism `TenantPrismaService` already uses for `app.tenant_id`, and it dies with the transaction so it cannot leak across a pooled connection. One sanctioned bypass, one entry point, behind `@Roles('ADMIN')`. |
| 8 | A correction must not put a child back aboard a **finished** trip: FR-ATT-110 fires on the transition to `FINISHED`, and a correction touches no trip row, so there would be no transition left to catch it. | Refused by `AttendanceCorrectionService`. The **only** invariant in this phase whose sole enforcement is application code, and it is so because of *when* the guard fires rather than what it checks. |
| 9 | `ARRIVED → SKIPPED` is arguably legal under FR-TRP-020's wording. | **Excluded.** A stop the vehicle reached where nobody boarded is `COMPLETED` with `NO_SHOW` marks; `SKIPPED` asserts the vehicle never went. Permitting the edge would let a driver erase an arrival a guardian watched happen. Children at a skipped stop stay `PENDING` for the same reason — nobody observed their absence. |
| 10 | FR-TRP-030's radius, FR-TRP-050's radius and the two alert thresholds needed a home. | Added to the existing `routing` settings section rather than a new one. That section is the tenant's *operations* configuration and always was; the name is a Phase 5 misnomer that renaming would cost a migration to fix, for no behaviour. |
| 11 | Every guard could **fail open**: under RLS a `NOT EXISTS` sub-query run without `app.tenant_id` sees zero rows and passes, silently answering *"no child is aboard"* because it could see no children. | Every guard function opens with `assert_trip_tenant_context(NEW.tenant_id)`, raising `TRP00` when the session tenant does not match the row's. Asserted directly by `trip-invariants.spec.ts`. This is the single most important line in the migration. |
| 12 | A trigger refusal would otherwise surface as a 500 with a generic message, breaking FR-INT-040. | `common/errors/sqlstate-to-code.ts` maps the custom SQLSTATEs back to `ErrorCode`s in the global exception filter. The service raises the same codes with fuller detail on the ordinary path; reaching the trigger means something bypassed it, so the code is right and the detail is thinner. |
| 13 | SRS **OI-03** — the procedure when nobody is present to receive a child at drop-off — is still `None specified`, and is due *"before the first live trip"*. | **Not built, and blocking go-live.** Phase 6 records `DROPPED_OFF` and nothing else; there is no escalation, because no procedure exists to encode. A safety and liability decision for the business, not a coding decision. <br><br>**Superseded by Phase 8, decision 1 — closed.** |
| 14 | **FR-ATT-120's audit entry was never written.** `AttendanceCorrectionService` passed a composite `` `${tripId}:${studentId}` `` as `entityId`, but `audit_log.entity_id` is a `uuid` column — and `AuditService` swallows its own failures by design (a lost log line must not roll back the correction it describes). So every correction succeeded, answered 200, and silently lost the record FR-ATT-120 exists to keep. | Entity is now the `trip_stop_students` row's own id, which is what `entityType: 'tripStopStudent'` already claimed. Caught by `trip-execution.integration.spec.ts` — *"writes an edge the crew machine does not have, and audits both values"*. The lesson is decision 12's in reverse: the one call that tolerates failure is the one that must be tested for success. |
| 15 | **The append-only event log disagreed with the answer the caller got.** `AttendanceService.mark` claimed every event with `outcome: 'APPLIED'` *before* judging it, then returned `SUPERSEDED`, `CONFLICT` or `REJECTED`. `trip_events` grants the application no `UPDATE`, so the row could never be corrected: two crew members tapping the same child left two `APPLIED` events for a projection only one of them moved. The illegal-edge path was worse — it called `refuse`, whose second claim on the same `client_event_id` hit `ON CONFLICT DO NOTHING`, so the `REJECTED` event vanished and the log kept the `APPLIED` one. | Split into `judge` (decide) and `claim` (record), in that order. Safe because `lockStudentOnTrip` already holds the row `FOR UPDATE` before either runs; the claim still settles the *duplicate `client_event_id`* atomically, and still precedes any effect. The class doc always specified this — *"the event is kept with `outcome = CONFLICT`"* — the code simply did not do it. |
| 16 | **A stale offline mark against a finished trip returned 500.** `refuse` ran before the child was located, so it wrote an `ATTENDANCE` event with no `trip_stop_id`, which `trip_events_subject_present` refuses. SDD §10.4's `TRIP_CLOSED` answer was therefore unreachable — exactly the path a device syncing a stale queue takes. | The child is located before the trip's state is judged. A refusal is also an event, and the constraint requires an attendance event to name its subject; a rejection that had not looked the child up yet could not be written at all. Caught by `offline-sync.spec.ts` — *"rejects events queued against a trip that has since finished"*. |
| 17 | **An adopted trip was not marked `retrospective`.** `RetrospectiveTripService` set the flag in `createPlanned` but not in `adopt`, so whether a reconstructed day was identifiable as such depended on whether generation happened to have run that morning — and adoption is the *ordinary* case, not the exception, as that method's own note says. | `TripRepository#markRetrospective`, called on adoption. FR-OFF-060's principle is that a record made differently must be identifiable as such, and it cannot be conditional on unrelated history. |
| 18 | **`RouteSheetsModule` could not resolve `RouteSheetService`.** Phase 6 moved the read surface to `TripReadService` in `modules/trips`; the worker module re-provides `RouteSheetService` so the Puppeteer binding applies to it, and a re-provided class resolves in *its own* injector — where `TripReadService` was not reachable, since `RoutingModule` does not export it. The worker process would have failed to boot. | `TripsModule` added to that module's imports, alongside `StorageModule` and `PlatformModule`, which are there for precisely the same reason. Caught by `finance-wiring.integration.spec.ts`, which resolves the whole worker graph — the value of a wiring suite is that it fails at build time rather than at 6 a.m. |
| 19 | The suites' own faults, found in the same run. | Four, all in test code: the isolation seed and `createGeneratedTrip` wrote trip rows without `app.tenant_id` (decision 11's guard doing its job — bypassing RLS is not the same as having a tenant context); `baseline-migration`'s phase-scope list had not been advanced to admit `sweep_checks` and `trip_events`, which is the guard working as designed and is advanced once, here; `trip-execution`'s per-test service date was `(n % 27) + 1`, so the 28th trip silently collided with the first on `UNIQUE (vehicle_id, direction, service_date)` — now a real date walked forward; and the append-only teardowns disabled and deleted as separate statements, so parallel suites interleaved their `ENABLE TRIGGER` and failed at random — now one transaction, whose `ACCESS EXCLUSIVE` lock serialises them. |

### Test-infrastructure changes

| Change | Why |
|---|---|
| `vitest.trip-invariants.config.ts`, `pnpm test:trip-invariants`, and its own CI step | SDD §19.2 names the files `trip-invariants.spec.ts` and `offline-sync.spec.ts`, which the `*.integration.spec.ts` pattern would not match. Its own project for the reason `tenant-isolation` has one: a red run here means a child could be left on a vehicle, and it must be impossible to skim past that in a list of forty other results. |
| `createGeneratedTrip`, `advanceTripTo`, `withTenantContext` | A trip as generation would have left it, without running generation — so the invariant suite is independent of the optimiser, the cache and the map provider, and fails for state-transition reasons only. `withTenantContext` runs fixtures inside one transaction with `app.tenant_id` set, because the guards refuse to run without it. |
| `cleanupRoutingData` disables the append-only triggers for its own teardown | `trip_events.trip_id` is `RESTRICT`, so leaving the rows would make every trips suite start with the previous suite's data. The same bargain `payments` already strikes in `tenant-seed.registry.ts`. |

## Phase 7 — Tracking, the guardian visibility window and background location

*SRS Appendix B phase 6. Module `tracking` (TRK), plus FR-RTE-140's deferred map layer,
FR-INT-020's fallback, FR-KVK-030's retention and the Phase 6 detector debt.
Schema: migration `20260812000000_tracking`.*

**Status.** Every suite has been run against a live database and Redis (2026-08-15):

| Command | Result |
|---|---|
| `pnpm test:unit` | 826 passed (40 files, including the new `unit-mobile` project) |
| `pnpm test:integration` | 635 passed, 2 skipped — the opt-in route-generation benchmark |
| `pnpm test:tenant-isolation` | 20 passed — now including the partitioned `location_pings` |
| `pnpm test:trip-invariants` | 66 passed |
| `pnpm lint` | clean, zero warnings |
| `pnpm typecheck` | clean across all seven workspaces |

The phase closes the two rows Phase 6 left `Implemented`, and the first run of the new detector
suite found the reason they could not have been closed any other way — see decision 6.

### TRK — Position ingestion, live state, ETA and replay

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-TRK-010 | §9.2 ingestion pipeline, §5.2 `location_pings` | `modules/tracking/services/ping-ingest.service.ts`, `services/ping-buffer.service.ts`, `repositories/location-ping.repository.ts` | `tracking.integration.spec.ts` — "accepts a batch from the assigned driver", "writes the readings into the daily partition" | Verified |
| FR-TRK-010 (device half) | §14.3 | `apps/mobile/src/location/`, `src/db/outbox.ts`, `src/sync/ping-sync.ts` | `outbox.spec.ts`, `tracking-controller.spec.ts`, `ping-sync.spec.ts` | Verified |
| FR-TRK-020 | §14.3 | `location/expo-location-platform.ts`; `app.json` — `UIBackgroundModes`, `ACCESS_BACKGROUND_LOCATION`, the foreground service | `tracking-controller.spec.ts` — permission ordering and the visible refusal | Verified (the platform manifest itself is asserted by review — decision 10) |
| FR-TRK-030 | §14.3, §9.2 | `ping-ingest.service.ts#withinTripWindow`, `db/tracking-state.ts`, `location/tracking-controller.ts` | `tracking.integration.spec.ts` — "no position data outside an active trip" (5 cases); `tracking-controller.spec.ts` — "discards everything when no trip is being tracked" | Verified |
| FR-TRK-040 | §9.3, §6.2 `/tracking/my-children` | `services/guardian-visibility.service.ts`, `tracking-read.service.ts#myChildren`, `controllers/tracking.controller.ts` | `guardian-visibility.integration.spec.ts` — clause 1; `tracking.integration.spec.ts` — "shows the vehicle and this child's own stop" | Verified |
| FR-TRK-050 | §8.3 (local ETA), §9.2 | `services/eta.ts`, `tracking-read.service.ts` | `eta.spec.ts` (20 cases); `tracking.integration.spec.ts` — "with a live estimate" | Verified |
| FR-TRK-060 | §9.3 | `guardian-visibility.service.ts#judge`, `gateway/tracking-subscriptions.ts#evictIfWindowClosed`, `gateway/tracking.gateway.ts` | `guardian-visibility.integration.spec.ts` — clauses 3 and 4 and the sibling cases; `tracking-gateway.integration.spec.ts` — "stops the positions the moment the child is set down" | Verified |
| FR-TRK-070 | §6.3, §9.3 | `trip-audience.service.ts#findPlacementsForStudents` (no other child is selected), per-trip rooms, `student:status` addressed to user rooms | `tracking.integration.spec.ts` — "names only this guardian's own children"; `tracking-gateway.integration.spec.ts` — "does not reach a guardian who never subscribed" | Verified |
| FR-TRK-080 | §8.3 — traffic from the persisted leg durations and the observed speed | `services/eta.ts#effectiveSpeed` | `eta.spec.ts` — "the speed it divides by" (5 cases) | Verified — **approximated**, see decision 4 |
| FR-TRK-090 | §9.2 (one `MGET`), §6.2 `/tracking/live` | `services/live-position.store.ts`, `tracking-read.service.ts#fleet`, `apps/web/src/features/tracking/FleetMapPage.tsx` | `tracking.integration.spec.ts` — "GET /tracking/live" (4 cases); `FleetMapPage.spec.tsx` (7 cases) | Verified |
| FR-TRK-100 | §6.2 `/trips/:id/path`, §5.4 | `location-ping.repository.ts#findPath`, `tracking-read.service.ts#path`, `features/trips/TripMapPanel.tsx` | `tracking.integration.spec.ts` — "GET /trips/:id/path" (4 cases); `TripMapPanel.spec.tsx` | Verified |
| FR-TRK-110 | §9.2, §13 `detectSignalLoss` | `services/signal-loss.service.ts`, `trips.signal_lost_alerted_at`, `jobs/tracking.processor.ts` | `signal-loss.integration.spec.ts` (11 cases); `job-schedules.integration.spec.ts` — "every 60 seconds" | Verified |

### INT — The realtime transport

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-INT-020 | §6.3 WebSocket protocol and its polling fallback | `gateway/tracking.gateway.ts`, `gateway/redis-io.adapter.ts`, `GET /trips/:id/live`; `apps/web/src/api/tracking-hooks.ts`; `apps/mobile/src/tracking/live-source.ts` | `tracking-gateway.integration.spec.ts` (14 cases); `live-source.spec.ts` (18 cases); `TripMapPanel.spec.tsx` — "says it is polling rather than claiming to be live" | Verified |

### RTE — the map layer Phase 5 deferred

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-RTE-140 | §15.1, and Phase 5's own deferral note | `apps/web/src/components/RouteMap.tsx`, `lib/polyline.ts`, `features/trips/TripMapPanel.tsx` | `polyline.spec.ts` (10 cases); `TripMapPanel.spec.tsx` — "draws the planned route and every stop" | Verified — the numbered stop list, per-stop ETA and totals were already Verified in Phase 5 |

### KVK — retention of raw location

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-KVK-030 | §5.4 daily partitions, §13 `dropLocationPartitions` | `drop_location_ping_partitions()` and `ensure_location_ping_partition()` in `20260812000000_tracking`, `jobs/location-partition.service.ts` | `location-retention.integration.spec.ts` (8 cases) — including "removes the relation from the catalogue rather than emptying it" | Verified |

### Phase 6 rows closed by this phase

| Requirement ID | Was | Now | Why |
|---|---|---|---|
| FR-TRP-090 | Implemented — *"no test at all"* | **Verified** | `overdue-detection.integration.spec.ts` — "detectOverdueTrip" (6 cases), driven by `test/clock-harness.ts`; `job-schedules.integration.spec.ts` proves the ten-minute cadence against a real BullMQ queue. |
| FR-ATT-100 | Verified (invariant); detector untested | **Verified**, both halves | `overdue-detection.integration.spec.ts` — "detectOverdueSweep" (6 cases), including the tenant-configurable threshold and the idempotency stamp held across six ticks. |

### Decisions recorded during Phase 7

| # | Point | Resolution |
|---|---|---|
| 1 | SDD §5.2 declares `location_pings` with `id bigserial PRIMARY KEY`, and PostgreSQL requires the partition key in every unique constraint on a partitioned table. | Key is `(recorded_at, id)`. `id` is a sequence and remains unique in practice; the database cannot be asked to enforce that across partitions, and declaring an index it would refuse is not an option. `accuracy_m` is added for a second reason §5.2 gives nowhere to live: a 2 km cell-tower fix plotted between two 5 m GPS fixes draws the vehicle through a neighbouring district, which is worse than a gap because it looks like evidence. |
| 2 | Retention needs a partition to drop *and* a partition to insert into, and there is deliberately no `DEFAULT` partition. | A default keeps an INSERT from failing when a partition is missing, at the price of making the missing partition **impossible to create later** — PostgreSQL refuses to attach a range that a row in the default already occupies. Trading a loud, recoverable failure for a quiet, permanent one is the wrong way round. So: the flush ensures the day's partition before writing (memoised, one extra statement per day per process), the daily job creates a week ahead, and `insertMany` retries once on `23514`. |
| 3 | SDD §9.2 says *"live position reads never touch PostgreSQL"*, and a fleet marker needs a plate, a driver's name and a school — none of which is in Redis. | The **positions** come from one `MGET`; the roster comes from an indexed query. What §9.2 protects is the position read path, and a database outage takes the whole console down long before it reaches this endpoint. One deliberate exception the other way: a Redis that has just restarted holds no keys, so the fleet view falls back to the last row in `location_pings` for the trips Redis could not answer for — which in the steady state is none of them, and after a restart is all of them once. |
| 4 | FR-TRK-080 requires the ETA to *"incorporate current traffic conditions"*, and SDD §8.3 forbids a provider call on the position-update path. | Both are honoured, and the reading is stated rather than assumed. Traffic enters from two directions, neither billable: `trip_stops.leg_duration_s` came from the traffic-aware optimisation at generation (§8.1 step 7), and the vehicle's own observed speed is what the traffic ahead is doing to it now. What is **not** claimed is a live re-route around an incident — that needs a provider call per update, and FR-RTE-100's explicit re-optimisation is where an Admin buys one. A hundred vehicles reporting every fifteen seconds would otherwise be ~48,000 route requests a day, which SDD §18.5 puts above the entire hosting bill. |
| 5 | SDD §3.3's `DomainEvent` union has no member for a stop transition or for signal loss, and SDD §6.3 requires `stop:state` to be pushed. | Added `stop.arrived`, `stop.completed` and `trip.signalLost`; `tripId` added to `stop.approaching` and `stop.skipped`, because rooms are per trip and a subscriber cannot be found from a stop identifier without a query the emitter has already paid for. The alternative was for `trips` to hold a reference to the gateway, which would put a WebSocket in the middle of the transaction that decides whether a child may board. **SDD §3.3 still needs the matching amendment**, alongside Phase 6's decision 4. |
| 6 | **Both Phase 6 detectors returned nothing, on every tick, for a whole phase.** `OverdueDetectionService` scanned its candidates on a *platform-scope* transaction. `trips` has RLS `ENABLE`d and `FORCE`d, so with no `app.tenant_id` set the policy compares `tenant_id = NULL`, matches no rows, and the sweep alerted nobody — silently, with no error and no log line. | Rewritten to the shape every other scheduled sweep already uses (`OverdueInstalmentsService`, `VehicleDocumentService`): list the tenants at platform scope, where `tenants` is not tenant-scoped, then read each one's rows in its own context. `TripSignalService` was first written the same wrong way and fixed in the same commit, before it shipped. **This is precisely the cost Phase 6's decision 6 predicted** — a safety alert with no test, whose failure mode is silence. Found by the first assertion of `overdue-detection.integration.spec.ts`. |
| 7 | Asserting *"this fires fifteen minutes later"* needs either a test that sleeps for fifteen minutes or a test that proves nothing. | `test/clock-harness.ts`, in two halves, because *"time passed"* means two different things. `TestClock` moves the instant a service is **given** — every detector already takes `now: Date` — without touching Prisma's clock, PostgreSQL's `now()` or BullMQ's, which a global `vi.setSystemTime` would. `registeredSchedulers` + `fireTimes` register a scheduler against a **real** BullMQ queue, read the expression back from Redis, parse it and ask when it would next fire: a valid cron meaning the wrong thing fails, and so does one BullMQ would reject at boot. |
| 8 | The gateway needs the visibility rule; the services that decide it would then need the gateway. | `REALTIME_PORT`, implemented by `TrackingGateway` on an API replica and by `NoopRealtimeAdapter` on the worker — which has no Socket.IO server and no business having one (SDD §2.2). The same posture SDD §1.2 P5 takes with the map and push providers; here the degraded path is silence. |
| 9 | `DomainEventBus` is in-process by design (SDD §3.3), so an event emitted on the **worker** reaches no socket. | Accepted, bounded and written down rather than papered over. Everything the visibility window turns on — trip transitions, stop transitions, attendance — is emitted by an HTTP handler on an API replica and does reach a gateway; broadcasts and evictions then cross replicas through the Socket.IO Redis adapter. The one gap is `route.changed` raised by the `recomputeRoute` job, and FR-INT-020's polling fallback covers it. A second fan-out mechanism for one event would be two things to keep in step. |
| 10 | Nothing in the mobile application could be tested: `expo-location`, `expo-task-manager` and `expo-sqlite` are native modules that throw when imported in Node. | Every decision moved behind a port. `expo-location` appears in exactly one file, `expo-sqlite` in one, and neither is imported by anything under test; the queue is exercised against a **real** SQLite (`node:sqlite`) through the same three-method interface the device uses, so the unique index, the ordering and the resumable drain are proven rather than assumed. What remains uncovered is the platform manifest — the Info.plist keys, the Android permissions, the foreground-service declaration — asserted by review and, per SDD TI-01, by App Store review. |
| 11 | CLAUDE.md's stack says *"expo-sqlite + Drizzle"*, and Drizzle's query builder reaches SQLite through a driver whose device implementation imports the native module. | Drizzle **declares the schema** and types every row; the statements are written out as parameterised SQL through the port. `outbox.spec.ts` holds the two together by applying the migration to a real SQLite and asserting that the columns the schema declares are the columns that exist. The alternative — Drizzle's `sqlite-proxy` driver — would have kept the builder at the price of a row-shape adapter per environment and failures reported in terms of the proxy, for three tables and a dozen statements. A stated deviation rather than a silent one. |
| 12 | `socket.io` resolved to two installed copies: `@nestjs/platform-socket.io@10` pins `4.8.1` and the new direct dependency floated to `4.8.3`. | Pinned exactly in `pnpm.overrides` and recorded in `docs/dependency-exceptions.md` as the one override that is not about a vulnerability. The runtime tolerates two copies; TypeScript does not, and the error is four hundred lines about a private property. **Bump it in step with `@nestjs/platform-socket.io`.** |
| 13 | FR-TRK-110 requires the signal loss to be *"indicated to viewing Guardians"*, and SDD §6.3 defines no event for it. | No push is needed, and adding one would be worse. Every position a client holds carries the instant it was taken, and `SIGNAL_LOSS_SECONDS` is exported from `packages/shared` so the client greys the marker on the same threshold the server alerts on. That works when the socket itself has dropped — the failure most likely to be *correlated* with a vehicle going quiet, and precisely when a pushed notice would not arrive either. |
| 14 | **A single unreadable tenant ended the whole sweep.** Both detectors list the tenants and then visit them one at a time; a tenant removed between the two throws mid-loop, and an unguarded loop abandons every tenant that sorted *after* it. Found by running the full integration suite rather than the detector file alone — another suite's teardown deleted its tenant mid-sweep. | Each tenant's pass is its own error boundary: the failure is logged with the tenant id and the sweep continues. The production consequence is worse than the test failure that revealed it — an alert about a child possibly still on a vehicle that stops silently, for a different set of customers on each tick depending on sort order. Asserted by *"carries on after a tenant that cannot be read"* in both detector suites. The two Phase 2 and Phase 4 sweeps have the same shape and are **not** changed here; recorded as outstanding rather than fixed outside this phase's scope. |
| 15 | **The global audit interceptor would have written one row per position batch.** `POST /trips/:id/pings` is a mutating route, so SDD §17.4's interceptor audited it — awaiting an insert on the highest-frequency endpoint in the system, ~36,000 rows a day at first-year scale. | `@NoAudit()`, applied to that one route, with the argument on the decorator. Throughput is what makes the point unavoidable, not what makes it true: an interceptor entry could only record that *something* was written (the response is three counters, the coordinates are in the request body), `location_pings` is already append-only at the privilege level and carries every field FR-KVK-080 names, and — decisively — `audit_log` is immutable with no retention while FR-KVK-030 requires raw location to be *permanently* erased after thirty days. A row per batch would leave a permanent record that a vehicle was tracked at a given minute, outliving the erasure of the tracking itself. Asserted by *"writes no audit entry for a batch of positions"* and, so the exemption cannot widen unnoticed, *"still audits the trip actions around it"*. |
| 16 | SRS **OI-03** — the procedure when nobody is present to receive a child at drop-off — remains `None specified`. | **Still not built, still blocking go-live.** Carried forward from Phase 6's decision 13, unchanged. Phase 7 adds nothing to it: tracking makes a guardian's absence visible sooner, and there is still no encoded escalation because no procedure exists to encode. <br><br>**Superseded by Phase 8, decision 1 — closed.** |

### Test-infrastructure changes

| Change | Why |
|---|---|
| `test/clock-harness.ts`, `test/job-schedules.integration.spec.ts` | Decision 7. Pays the Phase 6 debt for two jobs and covers Phase 7's two in the same shape, so there is one answer to *"how do you test a schedule"* rather than four. |
| `test/ws-harness.ts` | A listening application with the **real** `RedisIoAdapter`, on an ephemeral port. FR-TRK-060's eviction is `socketsLeave`, an adapter operation — asserting it against the in-memory adapter would prove it for the one topology SDD §2.2 does not deploy. |
| `unit-mobile` vitest project, `apps/mobile/src/db/test-database.ts` | Decision 10. `node:sqlite` behind the device's own port, so the queue's guarantees are properties of the SQL that actually runs on the device. |
| `tenant-isolation.spec.ts` now discovers `relkind IN ('r','p')` and excludes `relispartition` | `location_pings` is the only partitioned table in the schema and it carries `tenant_id`; a discovery restricted to ordinary tables would silently have exempted the highest-volume table in the system. Its partitions are excluded because a partition is not a separate subject — the parent's policy governs every statement the application issues, and each partition carries the identical policy of its own, asserted in `baseline-migration.integration.spec.ts`. |

### Carried into Phase 8

**Every row below was closed in Phase 8.** They are left as written, because the record of what
was outstanding at the end of Phase 7 is worth more than a table of ticks.

| Item | Why it is not here |
|---|---|
| The Driver, Host and Parent **screens** | Phase 6 built the trip-execution server side and left the mobile screens; Phase 7 adds the location and tracking *layers* they will sit on (SDD §14.2's `db/`, `sync/`, `location/`) and no navigation. Folding the screens in would be Phase 6 scope arriving in a Phase 7 diff. |
| `POST /sync/events` on the device | The `outbox` table and its repository are declared and tested; only positions drain through it in this phase, because the crew actions that fill it are the screens above. |
| SDD §10.1's `trips_cache`, `stops_cache`, `students_cache` and the prefetch | Same reason. Their shape is decided by the screens that read them, and declaring the tables now would be a schema nobody has exercised. |
| `stop.approaching` → a notification | The event is emitted on the position path (FR-NOT-020); despatch, templating and deduplication are Phase 8's, per SDD §12. |

## Phase 8 — Notifications, KVKK, the crew screens, and SRS OI-03 resolved

*SRS Appendix B phase 7. Module `notifications` (NOT), plus the `compliance` module's second
half and the mobile screens carried from Phase 6.*

**Status.** All four suites run against a live database on 2026-08-16 and are green. The
`test:unit` figure is the one taken **after** the carried `AuthStack` was closed out at the
start of Phase 9 (decisions 18–21); the other three are unchanged by it, because the auth
stack adds no table, no endpoint and no trip edge:

| Command | Result |
|---|---|
| `pnpm test:unit` | 978 passed (45 → 47 files; `unit-mobile` 128 → 174) |
| `pnpm test:integration` | 712 passed, 2 skipped — the opt-in route-generation benchmark |
| `pnpm test:tenant-isolation` | 20 passed, now over 40 discovered tables |
| `pnpm test:trip-invariants` | 100 passed (`trip-invariants.spec.ts` 93, `offline-sync.spec.ts` 7) |

`pnpm lint` and `pnpm typecheck` are clean across all seven workspaces.

**The defining work of this phase is the first section below.** SRS OI-03 has been carried as
*blocking go-live* since Phase 6, in the same words, twice. It is closed here — in the SRS, in
the SDD, in the database, in the service layer, in the notification catalogue and on the
driver's screen — and the reason it took a whole phase is that resolving it *badly* would have
been worse than leaving it open.

### OI-03 — the child nobody met at the drop-off

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-ATT-140 (new) | §9.1 attendance machine, §12.2 | `att_state` in `20260813000000_attendance_escalation_enum`; `trip_stop_students_transition_guard` and `trips_transition_guard` in `20260813000100_attendance_escalation`; `services/attendance.service.ts` | `trip-invariants.spec.ts` — "a child aboard may be recorded GUARDIAN_NO_SHOW, and stays aboard"; `trip-execution.integration.spec.ts` — "the crew may record it, and the child is still counted aboard" | Verified |
| FR-ATT-150 (new) | §9.1 | same migration; `isLegalCrewEdge` | `trip-invariants.spec.ts` — "RETURNED_TO_SCHOOL releases it", "DROPPED_OFF releases it too"; `geofence.spec.ts` — "RETURNED_TO_SCHOOL is terminal and only follows the escalation" | Verified |
| FR-ATT-110 (widened) | §9.1 `→ FINISHED` invariant | `trips_transition_guard`, `ABOARD_ATTENDANCE_STATES` in `packages/shared` | `trip-invariants.spec.ts` — "the database blocks FINISHED for exactly ABOARD_ATTENDANCE_STATES", parameterised over all seven states | Verified |
| FR-ATT-140 → notification | §12.2 `student.undelivered` | `notification-catalogue.ts`, `notification.service.ts` | `notifications.integration.spec.ts` — "notifies the linked guardians and the tenant Admins, non-disableably" | Verified |
| FR-ATT-150 → notification | §12.2 `student.returnedToSchool` | same | `notifications.integration.spec.ts` — "the resolution is notified too" | Verified |
| FR-ATT-140 on the device | §10.2, §14.4 | `crew/crew-action.service.ts`, `features/crew/AttendanceScreen.tsx` | `crew-action.spec.ts` — "queues GUARDIAN_NO_SHOW and leaves the child aboard", "offers the escalation beside the drop-off"; `event-sync.spec.ts` — "replays the whole escalation after a tunnel" | Verified |

### NOT — Notifications (SRS §4.11)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-NOT-010 | §12.1 pipeline, §12.2 catalogue | `services/notification.service.ts`, `notification-catalogue.ts`, `notification-recipients.service.ts` | `notifications.integration.spec.ts` — "trip.started reaches the guardians of the children expected on it", "SDD §12.4 — carries a deep-link payload" | Verified |
| FR-NOT-020 | §12.3 deduplication | `notification-dedupe.service.ts`, `notification_messages.dedup_key` partial unique index | `notifications.integration.spec.ts` — "is sent once and suppressed on every subsequent position update", "is still refused by the database when the Redis claim is lost" | Verified |
| FR-NOT-030 | §12.2 crew rows | catalogue `trip.cancelled`, `trip.crewAssigned`, `route.changed`; `TripRepository.findCrewUserIds` | `notifications.integration.spec.ts` — "a cancellation reaches the crew as well as the guardians" | Verified |
| FR-NOT-040 | §12.2 *"safety-critical … shall not be disableable"* | `notification_preferences`, `notification-read.service.ts`, `isDisableable` | `notifications.integration.spec.ts` — four cases including "refuses the whole request when one category in it is safety-critical" and "sends a safety-critical notification even to a guardian who has a stale suppression row"; `notification-catalogue.spec.ts` — "marks exactly the safety-critical categories non-disableable" | Verified |
| FR-NOT-050 | §12.1 *"persist to messages"*, §17.2 90 days | `notification_messages`, `notification-retention.service.ts`, `JOB_ENFORCE_NOTIFICATION_RETENTION` | `notification-dispatch.integration.spec.ts` — "deletes what is older than the retention window and keeps the rest", "keeps a message that is inside the window by a day", "is idempotent"; `job-schedules.integration.spec.ts` — "runs the ninety-day sweep weekly" | Verified |
| FR-NOT-060 | §12.1 failure branch | `notification_messages.status` / `failure_code`, `NotificationReadService.failureSummary`, `GET /notifications/failures` | `notification-dispatch.integration.spec.ts` — "records NO_DEVICE rather than FAILED", "settles a permanent refusal", "throws on a retryable failure"; `notifications.integration.spec.ts` — "the failure summary is refused to an Admin" | Verified |
| FR-NOT-070 `[V2]` | §12.5 SMS channel | `adapters/sms.channel.ts` bound to `SMS_CHANNEL`, `SMS_CHANNEL_ENABLED` | `notification-dispatch.integration.spec.ts` — "the SMS channel is registered, implements the interface, and is off" | Verified (as the interface FR-NOT-070 asks for; see decision 6) |
| FR-NOT-080 | — (no SDD §12 entry) | `notification-broadcast.service.ts`, `POST /notifications/broadcast` | `notifications.integration.spec.ts` — "reaches every guardian of the tenant, once each", "refuses a vehicle that carries nobody", "refuses a broadcast from a driver" | Verified |
| FR-ATT-070 | §12.2, non-disableable | catalogue `student.noShow` | `notification-catalogue.spec.ts`, `notifications.integration.spec.ts` | Verified |
| SDD §12.4 | Templating in `packages/i18n` | `packages/i18n/src/locales/{tr,en}.json` `notification.*` | `notification-catalogue.spec.ts` — every category renders both templates in Turkish; `notifications.integration.spec.ts` — "renders from packages/i18n, with no Turkish string in the backend" | Verified |
| SDD §1.2 P6 | The degraded push path | `adapters/degraded-push.channel.ts`, `PUSH_PROVIDER=none` | `notifications.integration.spec.ts` — "still records the message when there is nothing to deliver to" | Verified |
| SDD §13 `sendPush` | The queue and its retry policy | `QUEUE_NOTIFICATIONS`, `notifications.processor.ts`, `notification-dispatch.service.ts` | `notification-dispatch.integration.spec.ts` — seven cases including "re-running the job settles rather than sending twice" | Verified |

### KVK — Consent and subject rights (SRS §4.14), carried from Phase 7

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-KVK-010 | §17.1 `consent_documents`, `consent_acceptances` | `20260815000000_consent_and_subject_rights`, `services/consent.service.ts`, `ConsentController` | `consent.integration.spec.ts` — "records the version, the timestamp and the IP address", "treats a repeated acceptance as the same one" | Verified |
| FR-KVK-020 | §17.1 *"the API returns `CONSENT_REQUIRED`"* | `common/guards/consent.guard.ts`, registered as the fourth `APP_GUARD` | `consent.integration.spec.ts` — six gate cases, plus "a new version supersedes the old one, on its effective date" and "exempts exactly the routes that are argued for, and no others" | Verified |
| FR-KVK-060 | §17.3 export | `services/data-export.service.ts`, `data_subject_requests`, `JOB_EXPORT_SUBJECT_DATA` | `subject-rights.integration.spec.ts` — "assembles a machine-readable archive", "carries no other family's data", "hands over a signed link, and only to its owner", "deletes the archive when its 48 hours are up" | Verified |
| FR-KVK-070 | §17.3 pseudonymisation | `services/data-erasure.service.ts`, `JOB_ERASE_SUBJECT_DATA` | `subject-rights.integration.spec.ts` — six cases including "pseudonymises the subject and their exclusive child, and keeps the rest" and "ends every session" | Verified |
| FR-KVK-050 | §17.3 *"financial records … excluded from erasure"* | `DataErasureService.pseudonymise` counts and retains | `subject-rights.integration.spec.ts` — "keeps the attendance and financial records, and says how many" | Verified |
| FR-KVK-080 | §17.4 | `AuditService` entries on consent, export and erasure | `subject-rights.integration.spec.ts` — "audits the erasure by counts and never by the values removed" | Verified |
| FR-KVK-090 | §17.1 append-only | `consent_reject_mutation()` trigger, `REVOKE` on both consent tables | `consent.integration.spec.ts` — "refuses to update or delete an acceptance, from any role", "refuses to edit a document somebody has already accepted" | Verified |

### Mobile — the Driver, Host and Parent screens, carried from Phase 6

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-OFF-010 | §10.1 local store | `db/schema.ts` (`trips_cache`, `stops_cache`, `students_cache`), `db/trip-cache.ts`, `sync/prefetch.ts` | `trip-cache.spec.ts` — "caches a whole day and reads it back", "drops a stop the re-optimisation removed", "drops a trip that was cancelled" | Verified |
| FR-OFF-020 | §10.2 outbox-first | `crew/crew-action.service.ts` | `crew-action.spec.ts` — "queues the event and moves the cache, in that order" | Verified |
| FR-OFF-030 | §10.3 idempotency | `outbox` primary key, `INSERT OR IGNORE` | `crew-action.spec.ts` — "the same client event id twice writes one row" | Verified |
| FR-OFF-050 | §10.5 sync status | `components/SyncBanner.tsx`, `students_cache.pending_since` | `trip-cache.spec.ts` — "moves a child optimistically and marks the row unsent"; `event-sync.spec.ts` — "leaves the queue untouched when the network fails, and counts the attempt" | Verified |
| FR-OFF-060 | §10.2 offline flag | `recordedOffline: true` on every queued action | `crew-action.spec.ts` — "queues the event and moves the cache, in that order" | Verified |
| FR-OFF-070 | §10.4 *"the server value shall prevail"* | `sync/event-sync.ts`, `TripCacheRepository.reconcileStudent` | `event-sync.spec.ts` — "adopts the server's value on a conflict", "settles a rejection too", "matches answers by client event id, not by position" | Verified |
| FR-ATT-010/020/030 | §14.4 driver constraints | `features/crew/AttendanceScreen.tsx`, `availableMarks` | `crew-action.spec.ts` — six `availableMarks` cases | Verified |
| FR-ATT-080/090 | §14.1 sweep screen | `features/crew/TripScreen.tsx`, `CrewActionService.recordSweep` | `crew-action.spec.ts` — "sends the sweep as an explicit affirmative" | Verified |
| FR-TRP-040 | §14.1 today screen | `features/crew/TodayScreen.tsx` | `trip-cache.spec.ts` — "orders the day morning before afternoon"; `TodayScreen.spec.tsx` — 6 cases | Verified — closed in *Closing the open list*, step 4 |
| FR-TRK-040 | §9.3 guardian view | `features/parent/ChildrenScreen.tsx`, `features/parent/VehicleMap.tsx` (`react-native-maps`) | `ChildrenScreen.spec.tsx` — 10 cases, three of them the requirement's *"only where"* clauses | Verified — closed in *Closing the open list*, step 4 |
| FR-FLG-030 | §14.1 *"renders an explanatory screen"* | `navigation/RoleNavigator.tsx` | `RoleNavigator` renders the explanation before either stack is constructed — closed in *Closing the open list*, step 4 | Verified |
| NFR-USA-030 | §14.4 | `components/primitives.tsx` `SIZES`, `ConfirmDialog` | — (see decision 12) | Implemented |
| SDD §16 | *"only the current day; cleared on logout"* | `TripCacheRepository.prune` / `clear`, `AppRuntime.signOut` | `trip-cache.spec.ts` — five lifetime cases including "keeps a day whose attendance is still unsent" | Verified |

### Mobile — the `AuthStack`, closed out during Phase 9

*The one Phase 8 row that was still open. It is recorded here, in Phase 8, because it is
Phase 8 scope; the work was done at the start of Phase 9 and the phase is closed by it.*

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-AUTH-080 | §14.1 `AuthStack`; §6.2 `POST /auth/login` | `auth/auth.service.ts` `signIn`, `features/auth/LoginScreen.tsx` | `auth.service.spec.ts` — "signs a driver with one membership straight in", "logs in by phone, never by email — FR-AUTH-080", "shows the wrong-password sentence the server wrote, in Turkish" | Verified |
| FR-AUTH-010 | §7.1; §14.1 *"register"* | `AuthService.register`, `features/auth/RegisterScreen.tsx`, `authResource.register` in `packages/contracts` | `auth.service.spec.ts` — "takes an applicant to the code screen with the challenge to answer", "never receives the code itself" | Verified |
| FR-AUTH-020 | §7.1 OTP; §14.1 *"OTP"* | `AuthService.verifyPhone`, `features/auth/OtpScreen.tsx`, `authResource.verifyPhone` | `auth.service.spec.ts` — "a correct code leads to the waiting screen, not into the application", "a wrong code keeps the code screen and its challenge", "ignores a code typed when no challenge is outstanding" | Verified |
| FR-AUTH-030 | §7.1 *"still no data access"*; §14.1 *"pending-approval"* | `AuthService.settle`, `features/auth/PendingApprovalScreen.tsx` | `auth.service.spec.ts` — "lands a still-unapproved applicant on the waiting screen", "holds no token at all while approval is pending" | Verified |
| FR-AUTH-110 | §7.2 rotation with reuse detection | `AuthService.refresh` (single-flight), `adopt` proactive timer | `auth.service.spec.ts` — "presents the refresh token once when four requests fail at once", "rotates again after the first rotation has settled", "presents the rotated token, not the one it replaced", "arms a proactive rotation at three quarters of the token lifetime", "floors the rotation interval", "revokes this device only", "forgets the credential even when the revocation could not be sent" | Verified |
| FR-AUTH-090 | §6.2 `/auth/password-reset/request` | `AuthService.requestPasswordReset`, `LoginScreen` | `auth.service.spec.ts` — covered through the transport port; `LoginScreen.spec.tsx` — 7 cases, including *"never says the code was sent"* | Verified — closed in *Closing the open list*, step 4 |
| FR-FLG-030 | §14.1 *"renders an explanatory screen"*, at **login** | `AuthService.stateWithoutTokens`, `features/auth/RoleUnavailableScreen.tsx` | `auth.service.spec.ts` — "renders FR-FLG-030 as a notice rather than an error" | Verified |
| FR-TEN-030 / SDD §4.3 | The tenant a token is scoped to | `AuthService.selectTenant`, `features/auth/TenantPickerScreen.tsx` | `auth.service.spec.ts` — "asks which company when the identity holds two usable memberships", "does not offer a suspended tenant as a choice", "scopes the session to the chosen company", "restores the tenant the token was scoped to rather than asking again" | Verified |
| FR-KVK-020 on the device | §17.1 *"the client renders the consent screen before any other"* | `AuthService.outstandingConsent` / `acceptConsent`, `features/auth/ConsentScreen.tsx` | `auth.service.spec.ts` — "shows the notice before any screen when it is outstanding", "continues into the application once it is accepted", "stays on the notice when only part of it was accepted", "does not lock the application out when the consent endpoint is unreachable" | Verified |
| NFR-SEC-090 | §16 *"mobile refresh 30 d"* | `session` table, `SessionStore`; the access token is never written | `auth.service.spec.ts` — "never persists the access token", "signs out silently when the stored token has expired"; `session-store.spec.ts` — "clears the credential and keeps the device id" | Verified |
| SDD §16 | *"cleared on logout"*, the credential half | `SessionStore.clear`, `AuthService.discard` → `AppRuntime.cache.clear` | `auth.service.spec.ts` — "clears the student caches through the runtime", "keeps the device id, so the next sign-in is the same installation" | Verified |
| SDD §14.1 | The root branch: `AuthStack` ⇄ `RoleNavigator` | `App.tsx`, `features/auth/AuthStack.tsx`, `bootstrap.ts` | `auth.service.spec.ts` — the state the branch reads, exhaustively; `routes.spec.ts` — the stacks it selects between | Verified — closed in *Closing the open list*, step 4 |

### Cross-cutting requirements discharged in this phase

| Requirement ID | Where | Test case | Status |
|---|---|---|---|
| NFR-MNT-060 | Three notification tables and `data_subject_requests` discovered, seeded and policied | `tenant-isolation.spec.ts`, `tenant-seed.registry.ts` | Verified |
| FR-INT-040 | Seven new error codes with Turkish and English messages | `error-messages.spec.ts` | Verified |
| NFR-USA-050/060/070 | Every mobile string in `packages/i18n`; no Turkish inline in a component or in the backend | `index.spec.ts` parity, `notification-catalogue.spec.ts` | Verified |
| NFR-SEC-070 | Registration tokens never logged and never returned whole | `notifications.integration.spec.ts` — "registers a device and never returns the token" | Verified |
| NFR-SEC-080 | Export archives by signed, short-lived URL | `subject-rights.integration.spec.ts` — "hands over a signed link, and only to its owner" | Verified |

### Open issues closed in this phase

| ID | Resolution |
|---|---|
| **OI-03** | **Closed.** See *Decisions recorded during Phase 8*, decision 1, for the whole of it — the SRS requirements added, the SDD sections amended, the enum values, the widened invariant, the notification catalogue entries and the button. Carried as *blocking go-live* since Phase 6 decision 13 and Phase 7 decision 16; those rows are superseded by this one. |

### Decisions recorded during Phase 8

| # | Point | Resolution |
|---|---|---|
| 1 | **SRS OI-03 was `None specified` and blocking go-live.** *"A defined procedure is a safety and liability matter and should be added before live operation."* The obvious implementation — a terminal `UNDELIVERED` status the crew can record and move on from — is worse than leaving it open. | Resolved structurally, in five places at once. **SRS:** FR-ATT-140 and FR-ATT-150 added to §4.9, and the OI-03 row changed from `None specified` to the resolution. **SDD §9.1:** the attendance machine drawn out with `GUARDIAN_NO_SHOW` as an **intermediate** state and `RETURNED_TO_SCHOOL` as a second terminal one; §5.2's `att_state` and §12.2's catalogue amended alongside. **Database:** two migrations (an enum cannot be extended and used in one transaction), and `trips_transition_guard`'s FR-ATT-110 check widened to `IN ('BOARDED','GUARDIAN_NO_SHOW')`. **Services:** three new crew edges, `student.undelivered` and `student.returnedToSchool` emitted after commit. **Device:** the button, beside the drop-off, at the same size. The reason for every one of those is the same single sentence: *an escalation that let the trip finish would be worse than having no escalation at all* — a driver who taps it would have made the vehicle finishable when it was not before. |
| 2 | The blocking set *"is this child on the vehicle"* is now two statuses and is written in six places — a trigger, a repository query, a fleet count, the visibility window, a correction refusal and a screen. | `ABOARD_ATTENDANCE_STATES` and `isAboard()` in `packages/shared`, and a parameterised invariant test that parks **every one of the seven `att_state` values** on a real trip and asserts `→ FINISHED` is blocked exactly when `isAboard` says so. A state added to the enum without being classified fails there rather than in a vehicle. The SQL copies are named in comments as *the same list*; the test is what keeps them honest. |
| 3 | FR-ATT-060 blocks a stop from completing over an unmarked child. Widening it to `GUARDIAN_NO_SHOW` looks consistent. | **Deliberately not widened**, and the migration says so at length. `GUARDIAN_NO_SHOW` *is* a mark — the crew looked and recorded what they saw. Blocking the stop on it would strand the vehicle at a kerb it has finished with, holding every other child aboard while the office is telephoned. FR-ATT-110 holds the **trip**, which is the right place: the vehicle may drive on, and it may not go home. |
| 4 | SDD §12.2 lists `trip.delayed` for guardians, and FR-TRP-090's `trip.overdue` alerts the Admin. Nothing in the system measures the two separately. | One event, two audiences. `detectOverdueTrip` computes the one number both refer to, and the catalogue routes `trip.overdue` to `TENANT_ADMINS` **and** `TRIP_GUARDIANS`. A second detector raising a second event about the same minute would be two answers to one question, and the first Admin to see them disagree would stop trusting both. Recorded because §12.2's row is now implemented under a different key than it names. |
| 5 | SDD §12.1's diagram persists the message on the **success** branch of despatch. | Reversed: the row is written `QUEUED` when the pipeline decides to send, and the job moves it to `SENT`, `FAILED` or `NO_DEVICE`. Taken literally, §12.1 would give a tenant whose push provider is down an *empty* message history — and FR-NOT-050's in-app history is precisely what a guardian falls back on when the push did not arrive. It is also what FR-NOT-060 has to count: a failure that was never written cannot be surfaced in aggregate. |
| 6 | FR-NOT-070 is `[V2]`, and CLAUDE.md says *"never implement a requirement marked `[V2]`"* — while the requirement's own text says *"the integration shall be built and disabled by default"*. | The narrow reading, and the only one that satisfies both. The **seam** exists and is registered: `SmsChannel` implements the same `NotificationChannel` interface the push channel does, is bound to `SMS_CHANNEL`, and answers `false` to `isEnabled()`. The **provider integration** does not exist — no Turkish SMS gateway client, no credential, no message-part accounting — because writing one against a provider nobody has chosen would be guessing at an API and shipping code no test can exercise. An environment flag rather than a tenant feature flag: whether this *installation* has an SMS contract is not a tenant capability. |
| 7 | SDD §12.3 puts the `stop.approaching` suppression in Redis, which SDD TI-06 accepts as a single point of failure. FR-NOT-020 says *"at most once per Stop per Trip"*, which is a guarantee. | Two mechanisms, deliberately. Redis is the cheap path — one `SET NX`, before any work — and it **fails open**, because a suppression service that refused to send when it could not reach a cache would turn a cache outage into a notification outage. The `dedup_key` partial unique index is the guarantee. The failure mode being guarded is loud and public: an emptied dedup set means four notifications a minute per family at FR-TRK-010's interval, which is the kind of defect that gets an application uninstalled. Asserted by "is still refused by the database when the Redis claim is lost", which deletes the Redis key mid-test. |
| 8 | `consent_documents` is **platform-scoped** — one KVKK notice for the whole installation — so a version published with a past `effective_from` shuts the gate for every user in the database. The first draft of `consent.integration.spec.ts` did exactly that and locked seven concurrent suites out. | The FR-KVK-020 assertion is now **future-dated**, which tests strictly more: that a published-but-not-yet-effective version binds nobody (a KVKK change-notification period *is* that), and that the comparison supersedes the old acceptance the moment it takes effect — asserted through `ConsentService.outstandingFor(userId, at)` rather than through the guard. Recorded because the failure was invisible in the file alone and appeared only in the full run, which is the same shape as Phase 7's decision 14. |
| 9 | `ConsentGuard` refuses *every* authenticated request, and the exempt set is a hole in a legal control. | The set is enumerated from Nest's own route metadata and compared against a written list, so a route that acquires `@ConsentExempt()` in a later phase fails by name. Six routes: the three consent routes (otherwise the refusal names a screen the client cannot fetch — a lockout, not a policy), `GET /auth/me`, `POST /auth/logout` (a user who would rather leave than consent must be able to) and `POST /auth/select-tenant`. `POST /me/data-export` and `POST /me/erasure` are **not** exempt: exempting the routes that read and destroy the most data in the system would be exactly backwards. |
| 10 | SDD §17.3 writes the erasure as `addresses.text_address → NULL` and says nothing about sessions. Both are wrong in a way that only shows up against the schema. | `text_address` is `NOT NULL` and has been since Phase 2 — an address with no text is a row a route sheet cannot print — so the pseudonymised value is a placeholder, which achieves what the requirement asks without loosening a constraint four modules rely on. And `user_tenant_roles.status → SUSPENDED` was **missing**: `AuthGuard` re-resolves the role from that table on every request and never reads `users.status`, so suspending the user alone left a window the length of an access token in which an erased subject's outstanding token still reached their data. Found by the assertion *"ends every session, so an erased account stops working now rather than at expiry"*. SDD §17.3 amended with both. |
| 11 | FR-KVK-070's erasure meets a child with two guardians, only one of whom has asked. | Only children **exclusively** linked to the requesting guardian are pseudonymised; a shared child's record survives and only that guardian's own link is removed. The other parent's data is theirs as much as the requester's, and blanking the name would erase a record they are entitled to. Asserted directly, with a co-guardian in the fixture. |
| 12 | The mobile screens cannot be tested: there is no React Native renderer in this repository and adding one (`@testing-library/react-native` plus a preset plus a transformer) is a build-time dependency for a suite that would assert on markup. | The **logic** is all outside the components and is covered: `CrewActionService` (what a tap queues), `availableMarks` (which buttons exist for a status), `TripCacheRepository` (what the screens read), `EventSyncWorker` (what happens to a tap afterwards). The components are thin by construction — they call one of those and render its answer. What is therefore **not** covered is rendering, layout and navigation, and the four rows above are `Implemented` rather than `Verified` for exactly that reason. This is a stated gap, not a claim. |
| 13 | SDD §14.1 describes a *"root navigator"* and SDD §2.3 names no navigation library; none is installed. | A four-state machine in `RoleRouter`, and the cost written down rather than hidden: no back gesture, no deep linking, and SDD §12.4's *"tapping a push deep-links to the relevant screen"* has nowhere to land. The notification already carries the `data` payload a navigator would need, so the outstanding work is a navigator and not a protocol change. Adding one to move between four screens would be a dependency, a bundle and a set of typed route params for a stack whose whole depth is *today → trip → stop*. |
| 14 | `FakePdfRenderer` is provided by **both** `FinanceModule` and `RoutingModule`, each binding its own `PDF_RENDERER`. `finance-expenses.integration.spec.ts` resolved it with a flat `app.get()`, which returns whichever the container happens to answer with. | Adding an unrelated `@Global` module in this phase changed the answer, and two assertions went green-to-red against an instance nothing had rendered to. Fixed by binding the suite's **own** renderer through a new `HarnessOptions.overrides` seam — the supported mechanism, and the same one `notification-dispatch.integration.spec.ts` uses for the push channel. Recorded because the test was relying on a property of the container rather than of the code, and the failure said nothing about the cause. |
| 15 | **`pnpm test` exited non-zero with every one of its 1,764 assertions passing.** Two unhandled rejections — *"Connection is closed"* from ioredis's own close handler — under the full parallel run, and not reproducible in any single file. | `RedisService.onModuleDestroy` now takes the three steps `RedisIoAdapter.close` already took for its duplicated connections, which is where the argument was already written down: stop reconnecting (a `closing` flag the retry strategy reads, so ioredis takes the deterministic close path instead of racing a half-established reconnect), yield one macrotask so pending commands reach the socket and resolve normally, then `quit()` with `disconnect()` as the fallback. ioredis's close handler flushes the command queue by *rejecting* every pending promise, and a fire-and-forget command in flight at shutdown therefore has no owner. It appears only under load because that is when a command is still in flight at all — and it would have appeared in production as a spurious shutdown error on every rolling restart. |
| 17 | **A green run went red at random, in whichever suite lost.** `cleanupConsentAcceptances` disabled the append-only trigger, deleted, and re-enabled it as three loose statements. `ALTER TABLE … DISABLE TRIGGER` is global DDL, not a session setting, and vitest runs the integration files in parallel against one database. | Routed through `deleteAppendOnly`, the helper Phase 6 already wrote for `payments` and `trip_events` — one transaction, so the `ACCESS EXCLUSIVE` lock is held until commit and a second teardown queues instead of landing its `ENABLE` between this one's `DISABLE` and its `DELETE`. `consent.integration.spec.ts`'s own v2 cleanup was wrapped the same way. The symptom named the *wrong* file every time, which is what made it worth writing down: the suite that failed was never the suite that caused it. |
| 16 | Every existing integration suite's user would have been locked out by `ConsentGuard`. | `createUser` accepts the documents in force by default, driven off `consent_documents` rather than a hard-coded list — so publishing a version 2 in a later migration does not silently turn every suite red for a reason unrelated to what it tests. `consent.integration.spec.ts` passes `acceptsConsent: false` to get the other kind, which is the only place the distinction is under test. `cleanupConsentAcceptances` disables the append-only trigger for the delete, the same deliberate and visible exception `cleanupFinanceData` makes for `payments`. |
| 18 | **Decision 12 said the mobile screens cannot be tested. The auth stack is where that would have been an excuse rather than a constraint** — a login screen is the one component whose bugs sign the wrong person in. | The same answer, applied harder: **every decision is outside the components**. `AuthService` holds the state machine, the rotation, the persistence and the derivation of a screen from a `MeResponse`, and is exercised against a real SQLite and a transport the test dictates — 39 cases. What the screens then contain is a `switch` and some `<Field>`s. The uncovered surface is genuinely rendering and layout, which is what decision 12 claimed and, until this file existed, was less true of the auth stack than of anywhere else. FR-AUTH-090 is `Implemented` rather than `Verified` for exactly this reason and no other: its logic is one pass-through to the transport, and asserting a pass-through asserts the test. |
| 19 | **A refresh loop that rotates naively is worse than one that does not exist.** SDD §7.2 rotates refresh tokens *with reuse detection* — presenting one twice revokes the whole family. A device leaving a tunnel with four queued requests gets four 401s in the same tick. | Single-flight. `AuthService.refresh` memoises the in-flight promise and every caller awaits the same one, asserted by *"presents the refresh token once when four requests fail at once"*. Two consequences follow and are both deliberate. **First**, the transport `AuthService` uses is built on a client with **no** `onUnauthorised`: the runtime's client wires that hook to `refresh()`, and a refresh whose own 401 re-entered a single-flight refresh would await a promise it is itself resolving — a deadlock that appears only when a session has genuinely expired, which is precisely when it must not. Hence two clients in `bootstrap.ts`. **Second**, the rotation is *proactive*, at three quarters of the token lifetime, so the 401 path is a fallback rather than the mechanism; waiting for a 401 costs one failed request per rotation and the one it costs is whichever request the driver was waiting on. |
| 20 | A refused rotation ends the session. A **network failure** looks identical to a refused one at the call site, and treating them the same would sign a driver out of a moving vehicle because a tunnel ate one request. | Branched on `ApiError.status === 0`, which is what `HttpClient.send` reports for an unreachable server, a DNS failure or a CORS rejection. Status 0 keeps the session and the day's cached route and answers `false`; anything else discards. Asserted both ways — *"signs out silently when the stored token has expired"* and *"keeps the session when the server is merely unreachable"*. The asymmetry is the point: the cost of holding a dead session too long is one refused request, and the cost of discarding a live one is a driver at a kerb with no route sheet. |
| 21 | **The refresh token is a bearer credential and `expo-secure-store` is not a dependency of this workspace** (SDD §2.3 does not name it). | Held in the `session` table, and the trade recorded rather than glossed. The database file is in the application's private container, which iOS Data Protection and Android FBE cover **while the device is locked** — so what this does not defend against, and the Keychain would, is an unlocked, rooted or jailbroken handset. Against that stand SDD §7.2's reuse detection, which makes a stolen copy detectable and self-revoking, and SDD §16's *"cleared on logout"*, which bounds how long there is anything to steal. `SessionStore` is the **only** reader and writer of that table, so binding it to the Keychain instead is a change to one class. This is a mitigation, not an equivalence, and it is carried below as outstanding. Two smaller things fall out of the same table: the **access** token is never persisted (asserted, because it is the kind of thing a later convenience commit adds), and `device_id` deliberately **survives** sign-out — it is not a credential, it is what FR-AUTH-110's per-device revocation addresses, and minting a fresh one per sign-in would leave refresh-token families nobody can name to revoke. |

### Test-infrastructure changes

| Change | Why |
|---|---|
| `HarnessOptions.overrides` in `test/app-harness.ts` | Decision 14. `token` and `value` applied through Nest's own `overrideProvider`, which is the supported way to stand in for an external service and the only one that survives a version bump. Used by the push channel and by the PDF renderer. |
| `app-harness.ts` replaces `FcmPushChannel` with one that throws | The structural guarantee the Google geocoding provider already had, for the same reason and one more: a test run that reached FCM would send **real push notifications to real devices** in whatever project the service account belongs to. Nothing binds the token in a passing run; that is the point. |
| `createUser({ acceptsConsent })` and `acceptCurrentConsents` | Decision 16. |
| `cleanupNotificationData`, `cleanupConsentAcceptances`, `dataSubjectRequest` teardown | Suites count rows; a suite that inherited the previous one's messages would assert on somebody else's notifications. |
| `notification-dispatch.integration.spec.ts` binds a `StubPushChannel` | `retryable` and `addressInvalid` are the two decisions the whole retry policy hangs off, and neither is reachable without a channel whose answers the test dictates. |
| `apps/mobile/src/auth/auth.service.spec.ts` — `FakeTransport` and `RecordingTimers` | Decision 18. The transport mints tokens **in sequence** rather than returning a constant, so *"presents the rotated token, not the one it replaced"* is an assertion rather than a tautology; the timers record instead of waiting, so the proactive rotation is asserted in microseconds rather than in eleven minutes. |

### Carried into Phase 9 and beyond

| Item | Why it is not here |
|---|---|
| ~~The mobile **auth stack** (`AuthStack` — login, OTP, pending approval)~~ | **Closed at the start of Phase 9** — see *Mobile — the `AuthStack`* above, and decisions 18–21. The reason it was carried stands as written: it needed a token store, a refresh loop and an OTP flow, none of which the crew screens depended on to be built or reviewed, and `App.tsx` rendered the *"not signed in"* state rather than a fake login so the gap was visible rather than papered over. |
| `react-native-maps` on the Parent screen | SDD §2.3 names it; it is not a dependency of this workspace. The guardian screen answers *"is my child on the bus, and has the bus left"* from live data and shows no map. Adding one is a decision for whoever builds the tracking view properly. |
| `expo-secure-store` for the refresh token | Decision 21. The trade is written down there rather than hidden, and `SessionStore` is the single seam that changes. |
| A Markdown renderer for `ConsentScreen` | `consent_documents.body_md` is Markdown and is shown as text. The V1 notice is headings, paragraphs and bullets, so it is legible; a hand-rolled parser that swallowed a line of a legal notice would be a worse failure than a visible `##`. |
| A navigator, and SDD §12.4's push deep-link | Decision 13. The `data` payload is already on every notification. |
| `NOTIFICATION_PORT` still bound to `LoggingNotificationAdapter` | Phase 1's port for FR-AUTH-050/100 and FR-SYS-110 says *"Phase 7 binds a real adapter"*. Binding it to the new pipeline needs a `forwardRef` between `IdentityModule` and `NotificationsModule` — the pattern this codebase already uses elsewhere, but scope this phase did not claim. The three notifications are recorded, not delivered. |
| `instalment.due` / `instalment.overdue` recipients | The catalogue entries and templates exist; `NotificationService.resolve` returns no recipients for them, because the student and the amount behind an instalment belong to `finance` and the seam does not exist yet. Named in the code rather than left as a silent gap. |
| FR-NOT-030's *"assignment to a trip"* on daily generation | `trip.crewAssigned` is emitted by FR-TRP-080's reassignment only. Scheduled generation assigns from the standing `vehicle_assignments` a crew member already works to, and a push every morning saying *"you are driving your own vehicle"* is the kind of noise that teaches people to dismiss the notification that matters. |
| The two Phase 2 and Phase 4 tenant sweeps still lack Phase 7 decision 14's error boundary | Recorded there, unchanged here, and still outside this phase's scope. |

## Phase 9 — CRM, the aggregate dashboard and the remaining reports

*SRS Appendix B phase 8. Modules `crm` (MKT) and `reporting` (RPT).*

The phase opened by closing the one Phase 8 item still outstanding — the mobile `AuthStack`,
recorded above in Phase 8 where its scope belongs (decisions 18–21).

**Status.** All four suites run against a live database on 2026-08-16 and are green:

| Command | Result |
|---|---|
| `pnpm test:unit` | 992 passed (45 → 48 files; `unit-mobile` 128 → 174, `unit-web` gains `QuoteRequestPage.spec.tsx`) |
| `pnpm test:integration` | 814 passed, 2 skipped — the opt-in route-generation benchmark |
| `pnpm test:tenant-isolation` | 20 passed, now over 42 discovered tables |
| `pnpm test:trip-invariants` | 100 passed, unchanged — this phase adds no trip edge |

`pnpm lint` and `pnpm typecheck` are clean across all seven workspaces.

Two migrations landed: `20260816000000_crm` (`leads`, `lead_notes`, `students.lead_id`) and no
schema change at all for RPT — every report is a `SELECT` over tables earlier phases built, which
is what a reporting module should cost.

### MKT — Leads and the public quote page (SRS §4.13)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-MKT-010 | §6.2 *"Public — no auth"*; §5.2 `tenants.public_slug` | `20260816000000_crm` `leads`; `controllers/public-quote.controller.ts`, `services/public-quote.service.ts`; `features/quote/QuoteRequestPage.tsx` | `crm.integration.spec.ts` — "renders the form with the tenant name, its schools and the KVKK notice", "creates a lead in the right tenant", "serves the form with no token at all", "keeps an enquiry for a school this company does not serve"; `QuoteRequestPage.spec.tsx` — six cases | Verified |
| FR-MKT-020 | §12.2 catalogue, `lead.created` | `notification-catalogue.ts`, `NotificationService.resolve`, `LeadService.summary` | `crm.integration.spec.ts` — "writes a message to every Admin of the tenant", "sends one notice per enquiry however often the event is re-raised", "says nothing when the lead has gone" | Verified |
| FR-MKT-030 | §3.1 module `crm` | `isLegalLeadTransition` in `packages/shared`; `LeadService.update` / `addNote`; `lead_notes`; `features/crm/LeadDetailPage.tsx` | `crm.integration.spec.ts` — "progresses NEW → CONTACTED → QUOTED → WON", "refuses a move backwards", "refuses a move out of WON", "refuses a move out of LOST", "permits LOST from anywhere before it", "records every state change in the timeline, with its reason", "records a free-text note against the lead, with its author", "reads the timeline oldest first", "sets and clears a follow-up date as a civil date", "lists the leads due for a follow-up" | Verified |
| FR-MKT-040 | — | `LeadService.create`, `manualLeadSourceSchema`, `features/crm/LeadsPage.tsx` | `crm.integration.spec.ts` — "creates a lead by hand for a telephone enquiry", "refuses PUBLIC_FORM as a source an Admin may choose" | Verified |
| FR-MKT-050 | §3.2 layering — `crm` calls `identity` and `company` **services** | `services/lead-conversion.service.ts`; `RegistrationService.ensureGuardian`; `students.lead_id` | `crm.integration.spec.ts` — ten cases including "creates a guardian and a student, carrying the captured details across", "gives the guardian an active PARENT membership of this tenant", "refuses to convert twice", "refuses a student list that does not match the enquiry", "joins an existing family rather than duplicating it" | Verified |
| FR-MKT-060 | — | `LeadRepository.funnel` (`date_trunc … AT TIME ZONE`), `services/lead-funnel.service.ts`, `features/crm/LeadFunnelPage.tsx` | `crm.integration.spec.ts` — "reports the settled leads as the denominator, and the open ones beside them", "splits by source", "reports an unknown rate rather than zero when nothing has settled", "refuses a range that ends before it begins" | Verified |
| FR-MKT-070 | §17.1 `consent_documents` | `leads.consent_document_id` / `consent_accepted_at` / `consent_ip` / `consent_user_agent`; the `leads_public_requires_consent` CHECK; `quoteRequestSchema.kvkkConsent` as `z.literal(true)` | `crm.integration.spec.ts` — "records the document version, the timestamp and the address", "refuses a submission with the tick box unticked", "refuses consent to a version that is not the one in force", "the database refuses a public lead with no consent, whatever the application does", "permits a manually-entered lead with no consent record"; `QuoteRequestPage.spec.tsx` — "sends nothing when the consent box is not ticked", "submits with the document version that was on screen once it is ticked" | Verified |
| FR-MKT-080 `[V2]` | — | **Not implemented**, per CLAUDE.md. Outbound campaign messaging and referral tracking are `[V2]`; `LEAD_SOURCES` carries `REFERRAL` so FR-MKT-060 can already report one, which is a column and not a feature | — | Not started (correctly) |
| FR-FLG-010 / FR-FLG-040 | §7.3 guard chain | `@RequiresFeature('crm')` on `LeadsController`; the same flag checked inside `PublicQuoteService.resolve` for the two unauthenticated routes, which no guard can cover | `crm.integration.spec.ts` — "refuses an Admin whose tenant has the crm module switched off", "answers the same 404 when the tenant has the crm module switched off", "closes the submission endpoint too, not only the form" | Verified |
| NFR-SEC-040 | §7.3 role guard | `@Roles('ADMIN')` on the whole pipeline | `crm.integration.spec.ts` — "refuses a driver", "refuses a parent", "refuses an unauthenticated caller"; `authorisation-matrix.integration.spec.ts` — the public set is exactly seven handlers and names both new ones | Verified |
| NFR-SEC-050 | §16 rate limiting | `@RateLimit('registration')` on both public routes — 5/hour per IP, the strictest bucket the system has | `authorisation-matrix.integration.spec.ts` enumerates them as public; the bucket itself is covered by `rate-limit.integration.spec.ts` | Implemented |
| NFR-MNT-060 | §4.2 layer 3 | `leads` and `lead_notes` discovered, seeded and policied | `tenant-isolation.spec.ts`, `tenant-seed.registry.ts`; `baseline-migration.integration.spec.ts` — "declares exactly the Phase 0 to 9 tables and nothing else" | Verified |
| FR-INT-040 | Five new error codes with Turkish and English messages | `error-messages.spec.ts` — every code resolves in both locales and carries no technical code in its text | Verified |
| NFR-USA-050/060/070 | Every string in `packages/i18n` | `index.spec.ts` parity; the `no-literal-turkish` ESLint rule over the new screens | Verified |

### Decisions recorded during Phase 9 — MKT

| # | Point | Resolution |
|---|---|---|
| 1 | **`POST /public/:slug/quote` is the only unauthenticated *write* in the system.** There is no token, so there is no `RequestContext` from the middleware, and the tenant it writes under comes from a URL segment a stranger typed. | The slug is resolved at platform scope and everything after it runs under `publicQuoteContext(tenantId)` — an ordinary tenant context, so SDD §4.2's layer 1 (RLS through `runInTenantContext`) and layer 2 (`TenantScopedRepository`'s injected `tenant_id`) are both **load-bearing** here rather than merely agreeing with a guard that already ran. If the slug resolution were ever wrong the insert would be refused by the database rather than landing in another company's pipeline, and `tenant-isolation.spec.ts` is what proves it. The other half is the row shape: every free-text column is length-bounded at the boundary, `child_count` is bounded by a CHECK, and the route sits behind SDD §16's strictest bucket (`registration`, 5/hour per IP) — because the alternative to a rate limit on a public form is an Admin queue full of rubbish, and the human response to that is to stop reading the queue. |
| 2 | **FR-MKT-070's consent cannot go in `consent_acceptances`.** That table's `user_id` references `users(id)`, and a prospect filling in a web form has no account. | The evidence is recorded **on the lead** — document version, instant, address, user agent: the same four facts, against a subject that exists — and `leads_public_requires_consent` makes a `PUBLIC_FORM` row without the first two impossible to write, whatever the application later does. The alternative considered and rejected was minting a `users` row per enquiry, which would give an unauthenticated endpoint the power to create identities: an account-enumeration and spam surface, and a stranger's name in the platform identity table on the strength of a web form. A manually-entered lead (FR-MKT-040) carries **no** consent record and the CHECK permits that deliberately — a person who telephoned consented by telephoning, and an Admin ticking a box on their behalf would be manufacturing evidence rather than recording it. |
| 3 | The page is closed for three different reasons: an unknown slug, a tenant with `crm` off, and a suspended tenant. | **One answer for all three** — 404 `QUOTE_PAGE_UNAVAILABLE` — and the web page renders one message. Distinguishing them would let a stranger enumerate which companies are on the platform and which have bought the CRM module, which is SDD §16's *"enumeration … via the registration flow"* threat one door along. Asserted three times over precisely because the temptation to be more helpful is what would undo it. |
| 4 | FR-MKT-030 says *"progress a Lead through the states NEW, CONTACTED, QUOTED, WON and LOST"*. What that permits is not obvious. | The **order of the array is the rule**: `leadStatusRank` reads the index, so a status may never move backwards, and `WON`/`LOST` are terminal. `WON` because a conversion has created a Student and a Guardian and un-winning it would leave those rows with nothing pointing at them; `LOST` because FR-MKT-060 measures a *rate*, and a denominator whose members can be recycled is not one. A prospect who comes back is a new enquiry, which is also how the business thinks about it. `isLegalLeadTransition` lives in `packages/shared` so the console can grey out the buttons it would be refused for — a convenience; the service is the authority (SDD §1.2 P2), and both read the one function. |
| 5 | **FR-MKT-050 is two writes and cannot be one transaction.** The guardian is platform-scoped (`users`, `user_tenant_roles` — SDD §4.3); the students, the links and the lead are tenant-scoped. Two clients, two contexts, no transaction spanning both. | Not pretended otherwise. The guardian goes first, through `RegistrationService.ensureGuardian`, which is **idempotent**; everything tenant-scoped then commits in **one** transaction — every student, every link, the `converted_at` stamp and the timeline entry. A crash between the two leaves exactly one artefact: a PARENT account with no children, indistinguishable from an FR-AUTH-060 invitation nobody has acted on yet, which the retry then reuses. `converted_at` is written **last** and checked **first**, which is what makes *"press it again"* the right instruction rather than a way to enrol the children twice. Threading that transaction meant adding an optional `tx` to `StudentService.create` and `GuardianLinkService.link`; every repository beneath them already took one. |
| 6 | `RegistrationService.invite` refuses when the person already holds the role. That is right for FR-AUTH-060 and wrong here, twice over. | `ensureGuardian` added beside it, sharing the same private `provision` so both produce identically-shaped accounts. The **ordinary** case is a repeat: the second child of an existing customer arrives as a fresh enquiry with a number the system already knows, and must be linked to the account the family signs in with rather than a second one they never use. The **recovery** case is decision 5's retry. The name and the email are deliberately *not* overwritten on an existing account: it belongs to the person, not to the enquiry, and a parent registered as "Ayşe Yılmaz" must not be renamed because a spouse typed "A. Yılmaz" into a form. |
| 7 | FR-MKT-050 needs an email; FR-MKT-010 makes it optional; `users.email` is `UNIQUE` and required. | A placeholder at `@lead.servisapp.invalid`. `.invalid` is reserved by RFC 2606 and can never be delivered to, which is the property that matters — nothing will ever send a real message there and believe it arrived, and the Admin corrects it from the guardian screen when the family gives one. The alternative was refusing to convert exactly the leads the form was designed to capture: a parent at a school gate has a telephone and may not have an address they remember. |
| 8 | FR-MKT-060's *"conversion rate"* has an ambiguous denominator. | **Settled leads**, not all of them: `won / (won + lost)`. A month whose enquiries are mostly still open would otherwise report a rate that climbs for weeks after the fact, which makes the figure useless for the one comparison it exists for — this September against last September. `open` is reported beside it so the reader can see how much is undecided, which is the honest way to present a partial answer rather than folding it into a number that looks final. A month with nothing settled reports `null` rather than `0.0`: a rate over no decisions is unknown, and zero reads as a catastrophe. The rate is formatted **once**, at the source, as a string — the same argument SDD §11.1 makes for money, and the reason the screen and any export cannot disagree. |
| 9 | `lead_notes` is a record of what somebody said. CLAUDE.md makes history append-only. | Insert-only **by construction** rather than by privilege: `LeadTimelineRepository` has `append` and `list` and nothing else. The trigger-and-`REVOKE` machinery `payments` carries is deliberately *not* bought — CLAUDE.md's rule is about financial and attendance history, a sales note is neither, and that machinery has a real recurring cost (`deleteAppendOnly`, and the global-DDL race Phase 8 decision 17 records). Notes and status changes share one table because what an Admin reads is one ordered story; two tables merged by timestamp in application code would order a note and a state change made in the same second by whichever list happened to sort first. |
| 10 | **An optional text field a user cleared submits `""`, not `undefined`,** and `emailSchema.optional()` refuses it — so a blank optional e-mail box failed with *"Invalid email"*. Found by `QuoteRequestPage.spec.tsx`, on the one form filled in by strangers. | `optionalText()` in `packages/shared/src/schemas/primitives.ts`: a `z.preprocess` that treats a blank string as absent, applied to every optional field in the CRM schemas. In the schema rather than at each call site, because *"blank means absent"* is the kind of rule applied on four forms and forgotten on the fifth — and the fifth here is a public page where the failure is a lost enquiry rather than a support ticket. It only ever wraps something already optional; a required field still refuses `""`. Recorded because the same latent shape exists on older forms and is now fixable in one place. |
| 11 | `crm` defaults to **off** in `DEFAULT_FEATURE_FLAGS`, so every CRM route is closed for a new tenant. | Kept, and it is the requirement rather than an accident of defaults. FR-FLG-010 names `crm` among the per-tenant modules: a company that has not bought it should not have a half-populated pipeline screen, and one that later disables it should stop serving its public quote page in the same moment. The consequence for tests is that `crm.integration.spec.ts` switches it on explicitly — and has to drop the Redis cache when it does, because `FeatureFlagService` invalidates on **its own** writes (FR-FLG-020) and a fixture writing the row directly bypasses that. Without the invalidation every assertion in that suite would have been measuring a stale cache rather than the guard. |

### Test-infrastructure changes — Phase 9 MKT

| Change | Why |
|---|---|
| `cleanupCrmData` in `test/fixtures.ts`, called from `cleanupCompanyData` | `leads.converted_guardian_user_id` is `ON DELETE RESTRICT`, so a converted lead left behind makes the final `user.deleteMany` throw and takes the whole teardown with it — in whichever suite happened to run last, which is exactly the failure shape Phase 8 decision 17 was about. |
| `ResizeObserver`, `scrollIntoView` and pointer-capture stubs in `apps/web/src/test/setup.ts` | jsdom implements none of them and every Radix `Select` and `Dialog` calls all three on mount, so a screen carrying a dropdown threw on render rather than failing an assertion — which reads as a broken test rather than a missing environment. Stubbed once rather than per suite. They are stubs and not implementations: nothing in this console reads a measured size, and a test that did would need a real browser. |
| `crm.integration.spec.ts` seeds leads directly for the FR-MKT-020 cases | Every route that creates a lead emits `lead.created` on the bus and the pipeline is already subscribed, so a lead created through the API has **already** been notified — and an explicit `handle()` would then be correctly suppressed by its own deduplication claim. Seeding the row makes the despatch the thing under test rather than the emission. |

### RPT — The aggregate dashboard and the operational reports (SRS §4.14)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-RPT-010 | §15.3 *"a single aggregate endpoint `GET /dashboard?date=`"* | `services/dashboard.service.ts`, `repositories/reporting.repository.ts` (`tripCounts`, `attendanceCounts`, `sweepCounts`); `features/dashboard/DashboardPage.tsx` | `reporting.integration.spec.ts` — "counts trips planned, in progress and completed", "counts a trip awaiting its sweep as in progress, not complete", "counts students expected, boarded and absent", "counts a delivered child as boarded", "leaves a cancelled trip out of the expected count", "counts outstanding sweep checks", "marks a sweep overdue once the threshold has passed" | Verified |
| FR-RPT-010 — alerts | §15.3; §12.2 for the conditions | `DashboardService.alerts`; `overdueSweeps`, `overdueTrips`, `undeliveredStudents`, `blockedTrips` | `reporting.integration.spec.ts` — "raises a critical alert for a child nobody received", "carries data rather than a sentence", "orders the critical alerts above the merely urgent ones", "says nothing when there is nothing to say" | Verified |
| FR-RPT-020 | §15.3, §11.1 money | `ReportingRepository.financeTotals` (`numeric` sums in the database) | `reporting.integration.spec.ts` — "reports collected, outstanding, overdue and expenses as decimal strings" | Verified |
| SDD §15.3 | *"computed server-side and cached in Redis for 60 seconds"* | `DashboardService` cache, keyed by tenant **and** date; `computedAt` on the response | `reporting.integration.spec.ts` — "answers the whole first screen from one endpoint", "serves the second request from the cache", "says when it was computed, so a stale figure is not a lie", "caches per date, so looking at yesterday does not evict today", "recomputes once the entry is dropped" | Verified |
| FR-RPT-030 | — | `ReportingRepository.attendanceByStudent`, `OperationalReportService.attendance` | `reporting.integration.spec.ts` — "counts each child over the range", "leaves a declared absence out of the denominator", "counts a no-show against the child", "reports a trip that finished with a child unmarked as unrecorded", "narrows to one school", "refuses a range that ends before it begins" | Verified |
| FR-RPT-040 | — | `ReportingRepository.punctuality`, `OperationalReportService.punctuality` | `reporting.integration.spec.ts` — "compares planned against actual, in signed minutes", "treats a two-minute difference as on time", "does not count a stop nobody reached as punctual" | Verified |
| FR-RPT-050 | — | `ReportingRepository.crewActivity` (`UNION ALL` over driver and host) | `reporting.integration.spec.ts` — "counts the trips a driver operated and the hours in service", "reports a driver and a host separately, on the same trip", "gives a trip that was started and never finished no hours" | Verified |
| FR-RPT-060 | — | `ReportingRepository.exceptions` (six `SELECT`s, one `UNION ALL`) | `reporting.integration.spec.ts` — "reports every kind with a zero rather than omitting it", "lists a no-show with the child and the vehicle", "lists a child nobody received", "lists a skipped stop with its reason", "lists an ad-hoc stop", "lists a geofence override", "reads newest first" | Verified |
| FR-RPT-070 | §11.6 *"a report never diverges between display and export"* | `services/operational-export.service.ts`, `packages/report-templates/src/operational.ts` | `reporting.integration.spec.ts` — "exports {attendance, punctuality, crew-activity, exceptions} to Excel" ×4 and "… to PDF" ×4, plus "returns the DTO rather than a file when no format is asked for" | Verified |
| NFR-SEC-040 | §7.3 role guard | `@Roles('ADMIN')` on both controllers | `reporting.integration.spec.ts` — "refuses a driver the dashboard", "refuses a parent the exception report", "refuses an unauthenticated caller"; `authorisation-matrix.integration.spec.ts` | Verified |
| NFR-USA-050/060/070 | Every label from `packages/i18n`; alerts carry `kind` + `context`, never a sentence | `dashboardAlert.*`, `exceptionKind.*`, `document.{attendance,punctuality,crewActivity,exceptions}.*` | `index.spec.ts` parity; `reporting.integration.spec.ts` — "carries data rather than a sentence" | Verified |
| Phase 3 carry-over | *"the dashboard is a placeholder until the aggregate endpoint lands in Phase 9 (SDD §15.3) — it does not issue a dozen parallel requests in the meantime"* | `features/dashboard/DashboardPage.tsx` rewritten against `GET /dashboard` | `reporting.integration.spec.ts` — "answers the whole first screen from one endpoint" | Verified — the placeholder never became load-bearing, which is what Phase 3 was protecting |

### Decisions recorded during Phase 9 — RPT

| # | Point | Resolution |
|---|---|---|
| 12 | **The reporting module reads `trips`, `trip_stops`, `trip_stop_students`, `sweep_checks`, `students`, `staff`, `vehicles`, `instalments`, `payments` and `expenses` — every one of them another module's table.** CLAUDE.md forbids a service from touching another module's *repository*. | `ReportingRepository` owns those reads and **writes nothing**: no `create`, no `update`, no `delete`, no transaction that could hold a lock. Every method is a `SELECT` with a `GROUP BY`, so it cannot violate an invariant it does not participate in — which is what the layering rule protects. The alternative was calling seven services and aggregating in Node: a dozen round trips and a page of rows in memory to produce eight integers, on the one screen SDD §15.3 singles out for *not* fanning out. Both defences are still armed on every query — the `WHERE tenant_id =` predicate **and** the RLS policy `runInTenantContext` arms (CLAUDE.md rule 1) — and on a read-only class the second is what turns a forgotten predicate into a query that returns nothing rather than a cross-tenant disclosure. |
| 13 | **Found while building FR-RPT-070: `/finance/reports?format=PDF` returns a *stub* PDF in production.** Phase 4 decision 6 bound `PDF_RENDERER` to the deterministic fake in the API *"so no API replica can launch Chromium on a request path"*, which is right — and `ReportsController` renders synchronously in the API anyway. The test passed against the fake; the customer would have received a blank page. FR-FIN-280 has been marked `Verified` on that basis since Phase 4. | `PDF_RENDERER` is now an environment variable (`fake` \| `puppeteer`) and `FinanceModule` binds through a factory, exactly the shape `PUSH_PROVIDER` established in Phase 8. **`fake` remains the default**, so every test and every deployment that has not opted in keeps Chromium out of its API image, and `PuppeteerPdfRenderer` loads `puppeteer` through a dynamic `import()` inside its lazy launch — providing the class costs nothing until something renders. The worker still overrides the token unconditionally, so a *job* renders for real whatever the API is configured to do. The reporting module imports the token rather than binding a third one (Phase 8 decision 14 records what two already cost). The proper long-term answer is to route every synchronous PDF through the existing `report_jobs` queue as NFR-PER-080 does for long ranges; that is Phase 4's surface to change and is named below as outstanding. |
| 14 | FR-RPT-010 says *"trips planned, in progress and completed"* and the schema has five states. | `SWEEP_PENDING` counts as **in progress**. FR-ATT-110 will not let such a trip finish while a child is unaccounted for, and the Admin has something to do about it — which is what "in progress" means on a screen somebody is watching. Counting it as completed would hide exactly the trips the sweep alert exists to surface. `CANCELLED` is reported as its own figure rather than folded into either, and its children are **not** *"expected"*: a child on a trip that never ran was not expected, and counting them would make the morning figure jump whenever a vehicle was cancelled. |
| 15 | An alert has to reach the Admin as a Turkish sentence, and CLAUDE.md forbids Turkish in the backend. | Each alert carries its `kind` and a `context` map of the values its sentence interpolates — a plate, a child's name, a reason — and the client renders it from `packages/i18n`. That is also what makes the dashboard and the push notification about the *same* condition say the same words. Asserted directly: *"carries data rather than a sentence"* checks that the payload for an undelivered child is exactly `{ studentName }` and nothing more. |
| 16 | *"Active alerts"* with no severity is a list nobody triages. | Two levels, and the classification is fixed rather than computed: `CRITICAL` is exactly the two that are about a child's whereabouts — `STUDENT_UNDELIVERED` (FR-ATT-140, SRS OI-03) and `SWEEP_OVERDUE` (FR-ATT-100). Everything else is an operational problem for today. A dashboard where every alert is red is a dashboard nobody reads the red on, and these two must never be scrolled past. Within a severity the **oldest** is first: an unresolved alert gets louder by sitting there. |
| 17 | FR-RPT-030's attendance rate has an ambiguous denominator, and so does FR-MKT-060's conversion rate. | The same answer in both, for the same reason. A **declared absence leaves the denominator**: the family told the company in advance, which is exactly what FR-ABS-010 exists for, and counting it against the child would punish them for using the feature. `unrecorded` is reported as its own column rather than as an absence — a trip that finished with a child unmarked is an operational gap, and reporting it as an absence would tell an Admin the family failed to notify them when in fact the crew failed to record it. A rate over a zero denominator is `null`, never `0.0`. |
| 18 | FR-RPT-040 compares an optimiser's ETA against a driver's geofence crossing. Demanding equality would classify every stop as late. | A **two-minute window** either side, stated in the service rather than made configurable — a tenant tuning it would be tuning the answer, and a punctuality figure two companies compute differently is not a figure. The delta is signed and `null` where either end is missing: a stop with no arrival is **unmeasured**, not punctual, and folding it into zero would make the one number the report exists to produce a lie. `worstDeltaMinutes` is the signed maximum, so a period whose worst case is *early* says so rather than reporting the largest absolute number as a delay. |
| 19 | FR-RPT-050's *"hours in service"* on a trip that was started and never finished. | Contributes **nothing** — neither a trip nor an hour. An open-ended duration would read as eleven hours of overtime for what is a data problem, and the exception report already names it. A person who drove on Monday and hosted on Tuesday is **two rows** (`UNION ALL` over the two columns), because FR-RPT-050 asks for *"Driver **and** Host activity"* and one row summing both would hide which capacity the hours were worked in — while `totals.staff` counts distinct people, so a payroll conversation about *"how many worked"* does not double-count them. |
| 20 | FR-RPT-060 names five kinds of exception. Five endpoints, or one? | **One**, because the question an Admin asks is *"what went wrong yesterday"* and not *"show me the skipped stops"* — five screens would be four unread ones. Assembled as a six-way `UNION ALL` in the database rather than six round trips merged in Node, where the merge would be a second implementation of *"newest first"*. Every kind is reported **with a zero** rather than omitted: a report whose *"skipped stops"* line vanished on a good week would read as a missing measurement rather than as a clean week. SRS OI-03's `UNDELIVERED` is the sixth, because a child nobody received is the most serious exception the system can record and FR-RPT-060 predates it. |
| 21 | These four reports could have reused NFR-PER-080's job pipeline, as the finance five do beyond an academic year. | They do not, and the reason is proportion. The financial reports touch every instalment of every student; these aggregate in the database and return counts, and the widest — punctuality — is one row per stop, a few thousand for a forty-vehicle fleet over a month. `report_jobs` and `QUEUE_REPORTS` are there to be reused the day a tenant proves otherwise; building the pipeline first would be machinery in advance of a problem. Recorded so the absence reads as a decision rather than an omission. |

### Defects found by this phase, in code outside it

| Defect | Where | Resolution |
|---|---|---|
| `/finance/reports?format=PDF` rendered through the **fake** renderer in the API, so a synchronous PDF export returned a structurally-valid stub in production. FR-FIN-280 was `Verified` against a test that used the same fake. | `apps/api/src/modules/finance/finance.module.ts`, Phase 4 decision 6 | Decision 13. The binding is now configuration-driven with `fake` as the default; the complete fix — routing every synchronous PDF through `report_jobs` — is Phase 4's surface and is carried below. |
| `trip_stop_students_recorded_complete` demands `recorded_by` as well as `recorded_at` for every status but `PENDING` and `ABSENT_DECLARED`, and the attendance machine refuses `PENDING → DROPPED_OFF` and `PENDING → GUARDIAN_NO_SHOW`. | Not a defect in the code — a defect in this suite's first draft, which wrote terminal states directly | Recorded because it is the constraint working: a report fixture cannot fabricate an attendance history the crew could not have produced, so the numbers under test are numbers the system could actually reach. |

### Test-infrastructure changes — Phase 9 RPT

| Change | Why |
|---|---|
| `reporting.integration.spec.ts` clears the dashboard cache key in `beforeEach` | SDD §15.3's sixty seconds is longer than the whole suite. Without the eviction every case after the first would assert on figures that were correct for a world that no longer exists — and the cache test would be the only one that noticed. |
| Its `mark()` helper walks the legal attendance path | `BOARDED` before `DROPPED_OFF` or `GUARDIAN_NO_SHOW`, with `recorded_by` set. See the defect table above: the fixture is constrained to histories a crew could actually have produced. |
| `binaryParser`, copied from `finance-reports.integration.spec.ts` | superagent parses by content type and has none for `application/pdf` or for a spreadsheet, so `response.body` arrives as an empty object and an assertion on the magic bytes would silently pass over nothing. |

### Carried into Phase 10 and beyond

| Item | Why it is not here |
|---|---|
| Routing every synchronous PDF export through `report_jobs` | Decision 13. The configuration switch makes FR-FIN-280 and FR-RPT-070 correct for an operator who opts in; the architecturally right answer is that a request path never renders, which means the PDF branch of both controllers becomes a dispatch and a poll. That is Phase 4's surface — `ReportRequestService`, `report_jobs.kind`'s CHECK and `ReportProcessor` — and changing it here would be a finance diff inside a reporting phase. |
| FR-MKT-080's campaign messaging and referral tracking | `[V2]` in the SRS, and CLAUDE.md forbids implementing one. `LEAD_SOURCES` carries `REFERRAL` so FR-MKT-060 can already report referrals that were entered by hand; that is a column, not the feature. |
| FR-RPT-010's `VEHICLE_DOCUMENT` alert | The kind is declared and the catalogue renders it, and nothing raises it: FR-CMP-030's expiry sweep emits `vehicle.docExpiring` as a notification (Phase 2) and stamps no per-tenant state the dashboard could read for *today*. Surfacing it needs either a query over `vehicles` expiry columns or a durable alert row, and both are decisions about how long an alert lives — which is the sysadmin console's question (FR-SYS-090) and Phase 10's. |
| A chart on the dashboard | SRS §6.1 asks for figures, and every figure here is one an Admin acts on within the hour. A trend line over a period is what the operational reports are for, and adding a charting dependency for four numbers would be the largest thing in `apps/web`'s bundle. |

## Phase 10 — the sysadmin console, and the debt Phase 9 carried

*SRS Appendix B phase 9. Modules `platform` (SYS, FLG) and the two items carried above.*

The phase opens by discharging both rows of *"Carried into Phase 10 and beyond"*, because
each is a defect wearing a deferral's clothes: one route returned a blank file in
production, and one alert kind was declared, translated and never raised.

### Step 1 — the two carried items

#### Every PDF export is a job (FR-FIN-280, FR-RPT-070, NFR-PER-080)

Phase 9 decision 13 half-fixed the stub PDF with an environment variable and named the
whole fix as Phase 10's: *"the architecturally right answer is that a request path never
renders, which means the PDF branch of both controllers becomes a dispatch and a poll."*
It does now.

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-FIN-280 | §2.2 *"job workers run as a separate replica set"*; §11.6; NFR-PER-080 | `controllers/reports.controller.ts` — `dispatches()`; `services/report-request.service.ts`; `services/finance-report.renderer.ts` | `finance-reports.integration.spec.ts` — "streams Excel inline", "dispatches a PDF export rather than rendering it", "dispatches a PDF from every financial report", "dispatches a PDF statement, carrying the student it is about" | Verified |
| FR-RPT-070 | §2.2, §11.6; `report_jobs` reused rather than duplicated | `controllers/operational-reports.controller.ts`; `services/operational-report.renderer.ts`; `20260817000000_report_jobs_operational_kinds` | `reporting.integration.spec.ts` — "dispatches %s to a report job rather than rendering it" (×4), "lists only the operational jobs on /reports/jobs", "renders a dispatched operational report to storage", "fails the job rather than hanging when a report cannot be built" | Verified |
| NFR-PER-080 | §13 `generateReport`; the `report_jobs` lifecycle | `ReportRequestService` now owns the row and nothing else | `finance-reports.integration.spec.ts` — "dispatches a range longer than an academic year to a job" (now 202) | Verified — unchanged behaviour, second trigger added |

#### The dashboard's `VEHICLE_DOCUMENT` alert (FR-RPT-010, FR-CMP-030)

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-RPT-010 (`VEHICLE_DOCUMENT`) | §15.3; FR-CMP-030's *"30 days before, and daily after"* | `services/dashboard.service.ts` reads `VehicleService.alerts` — the same query `GET /vehicles/alerts` answers | `reporting.integration.spec.ts` — "raises VEHICLE_DOCUMENT for an expiry inside the window (FR-CMP-030)" | Verified |

### Decisions recorded during Phase 10 — step 1

| # | Point | Resolution |
|---|---|---|
| 1 | **A PDF renders in the worker, so the API cannot serve one synchronously — but `reporting` may not call `finance` and `finance` may not call `reporting`.** `report_jobs`, its queue, its object key and its signed URL all live in `finance`; the queries behind the four operational reports live in `reporting`, which imports `finance`. A `switch` on `kind` inside `ReportRequestService` would have to reach the other way. | A **registry**, `ReportRendererRegistry`, owned by `finance`. Each module implements `ReportRenderer` for its own kinds and registers in `onModuleInit`; the lifecycle service asks the registry which one to call. The dependency still points one way and nothing in `finance` knows `reporting` exists. A kind nobody registered **throws** rather than returning `undefined`, so the failure surfaces as a `FAILED` job with a reason on the row — the alternative is a job that sits `RUNNING` for ever, which is the state NFR-PER-080's status column exists to make impossible. `ReportRequestService.build` moved out to `FinanceReportRenderer` in the same change: that service now owns the row and nothing else. |
| 2 | Excel was dispatched too, or not? | **Not.** The rule is *"a PDF is always a job"*, not *"an export is always a job"*, and the reason is specific: ExcelJS is a library and Chromium is a subprocess. Making XLSX asynchronous would have cost every Admin a poll for a file that is ready in forty milliseconds. NFR-PER-080's range rule still applies to both — a three-year receivables run is a job whatever the format. |
| 3 | A dispatched export and a rendered report came back from the same route with the same status. | **202 Accepted** for the dispatch, 200 for the report. The web client already discriminated by inspecting the body (`isJob`), which works and is a shape nobody should have to know; the status code says the same thing at the protocol level and costs one line. |
| 4 | `GET /finance/reports/jobs` returned every job of every kind, and `reporting` needed a list too. | `recent(ctx, kinds)` takes the caller's own kinds, and each controller passes its module's five or four. Two screens, two lists. A finance screen listing a punctuality export would be offering a download it has no button for. `GET /reports/jobs/:id` will happily return a *finance* job by id, which is harmless — it is the same tenant's own export, read through the same tenant-scoped repository — and refusing it would mean teaching the reporting module which kinds finance owns. |
| 5 | **Defect found while doing this: the worker was rendering with the fake too.** `FinanceJobsModule` re-provided `PDF_RENDERER` as `useExisting: PuppeteerPdfRenderer` and documented it as *"the services `FinanceModule` exports are re-instantiated here with the real renderer"*. Nest does not work that way: a provider's dependencies resolve in the module that **declares** it, so `ReportExportService` and `ReceiptService` — declared in `FinanceModule` — kept resolving that module's binding. Every report and every receipt the worker produced was a stub unless `PDF_RENDERER=puppeteer` already happened to be set. `RouteSheetsModule` is the case that works, and the difference is that it re-provides `RouteSheetService` itself. | The dead override is removed and the selection is configuration, where the binding is declared: `worker.ts` sets `process.env.PDF_RENDERER ??= 'puppeteer'` before the container is built. `??=` rather than `=`, so an operator who has deliberately chosen `fake` — a smoke deployment with no Chromium in the image — keeps their choice. The API keeps `fake`, which after this phase is belt and braces: no API route renders a PDF at all. |
| 6 | Where does `VEHICLE_DOCUMENT`'s `at` come from? Phase 9 left the choice open — *"a query over `vehicles` expiry columns or a durable alert row, and both are decisions about how long an alert lives"*. | **The query**, and specifically `VehicleService.alerts` — the one FR-CMP-030 already answers `GET /vehicles/alerts` with, asked through the service rather than re-implemented (SDD §3.2). A durable row would need a job to keep it current and would go stale overnight every night; an alert that is a function of two dates and today has no state to drift. `at` is the **due date**, not the moment of computation: the list is ordered oldest-first, so stamping it "now" would sort a lapsed inspection below a sweep that went overdue five minutes ago and would reset its age on every refresh. Severity is `WARNING` — an expired inspection is a serious problem about *tomorrow*, and `CRITICAL` is reserved for the two kinds that are about a child today (Phase 9 decision 16). |

### Test-infrastructure changes — Phase 10 step 1

| Change | Why |
|---|---|
| `reporting.integration.spec.ts` calls `ReportRequestService.run` directly, with `financeJobContext` | It is exactly what `ReportProcessor` calls, so the test exercises the worker's path without a Redis worker loop. This is the assertion the whole registry exists for: had `OperationalReportRenderer` not registered, the job would end `FAILED` instead of `READY`. |
| A `STUDENT_STATEMENT` job written with empty `parameters`, by raw SQL | The controller cannot produce one, and the failure path — a stable `REPORT_FAILED` code on the row rather than a stack trace or a job stuck `RUNNING` — is worth an assertion of its own (NFR-SEC-070). |
| The `%PDF-` assertions are gone from both suites | They asserted that the *fake* had run. Phase 9 decision 13 records what that concealed. What replaces them is that nothing rendered on the request path at all. |

### Step 2 — SYS: the console's backend and the two lifecycle jobs

Two migrations. `20260817000100_sysadmin_console` adds `tenants.plan_id`,
`tenants.read_only_since`, `tenants.suspended_at`, `subscription_plans.archived_at`, a
CHECK on `subscriptions.status`, the unique index on `(tenant_id, period_start)` that
makes the charge sweep idempotent, and the `announcements` table.

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-SYS-020 | §5.2 `subscription_plans.tiers`; §6.2 `/platform` | `services/subscription-plan.service.ts`; `createSubscriptionPlanSchema` (already in `packages/shared`); `PUT /platform/tenants/:id/plan` | `subscription-pricing.spec.ts` — "prices a fleet of %i", "places every boundary in exactly one tier", "refuses a gap", "refuses an overlap", "refuses an open-ended tier that is not the last"; `sysadmin-console.integration.spec.ts` — "stores the volume tiers as written", "refuses to withdraw a plan a tenant is still billed on", "hides archived plans", "refuses to assign a plan that does not exist" | Verified |
| FR-SYS-040 | §13 `computeSubscriptionCharges`; §11.1 money | `services/subscription-charge.service.ts`; `VehicleService.countActiveDuring`; `jobs/platform.processor.ts` | `subscription-pricing.spec.ts` — "multiplies in integer minor units, exactly", "never produces a third decimal place", the period cases; `sysadmin-console.integration.spec.ts` — "charges the active vehicle count at its tier", "overwrites the period rather than billing it twice", "charges nothing for a fleet of none", "counts a vehicle that was removed inside the period", "sweeps every operating tenant" | Verified |
| FR-SYS-050 | §13 `advanceTenantStatus`; the state machine in `tenant.service.ts` | `services/tenant-lifecycle.service.ts#nextStatusFor`; `TenantService.setStatus` now stamps `readOnlySince` | `tenant-lifecycle.spec.ts` — 13 cases over the ladder and its boundaries; `sysadmin-console.integration.spec.ts` — "walks a lapsed trial down the ladder, one rung per due date", "stamps read_only_since on arrival and clears it on the way out", "refuses an illegal jump", "leaves a paying customer alone" | Verified — was "Implemented" since Phase 1 |
| FR-SYS-070 | §17.2 *"manual sysadmin action only"* | `services/tenant-lifecycle.service.ts#retention`, `#purge`; `RETENTION_DAYS = 90` | `sysadmin-console.integration.spec.ts` — "starts the window on suspension and reports when it lifts", "restores everything on reactivation and clears the clock", "refuses a purge inside the window, and says when it lifts", "refuses a purge of a tenant that was never suspended", "refuses a purge whose typed name does not match", "purges once the floor has lifted" | Verified |
| FR-SYS-080 | §6.2 `POST /platform/announcements` | `20260817000100_sysadmin_console` `announcements`; `services/announcement.service.ts`; `controllers/announcements.controller.ts` (`GET /announcements`) | `sysadmin-console.integration.spec.ts` — "shows a global announcement to every tenant", "shows a per-tenant announcement only to that tenant", "hides one that has not been published yet", "hides one that has expired", "withdraws without deleting, and can republish", "refuses an announcement addressed to a tenant that does not exist", "refuses an Admin the publishing surface" | Verified |
| FR-SYS-090 | §18.3 *"endpoint exposing request rate, p95/p99 latency, queue depth, failed jobs, push failures, Maps API spend"*; §8.3's quota alarm | `infra/metrics/`; `modules/platform/health/` | `sysadmin-console.integration.spec.ts` — "reports every indicator the requirement names", "counts a 5xx as an error and a 4xx as traffic", "refuses an Admin the health view" | Verified |
| FR-SYS-030 | §6.2 `trialDays`, default 30 | `tenant.service.ts#create`, unchanged — what Phase 10 adds is what happens when the trial *ends* | `tenant-lifecycle.spec.ts` — "moves TRIAL to GRACE once the trial has ended", "leaves a trial with no end date alone" | Verified — was "Implemented" since Phase 1 |
| FR-TEN-050 | *"cross-tenant queries … exclusively to Sysadmin and only in aggregate, anonymised form"* | `PlatformHealthService` returns counts and rates and no identifier of any kind | `sysadmin-console.integration.spec.ts` — the health response's shape | Verified |

### Decisions recorded during Phase 10 — step 2

| # | Point | Resolution |
|---|---|---|
| 7 | **SDD §13 writes the job as `TRIAL→ACTIVE→GRACE→READ_ONLY→SUSPENDED`, and FR-SYS-050 begins *"on non-payment"* and never mentions trials.** Do they disagree? | **No, and the conflict rule is not triggered.** §13's arrow list is the ladder, not a claim that a *job* performs each arrow: `ACTIVE` means somebody paid, which is a commercial fact a clock cannot know, and a job that made every expired trial `ACTIVE` would hand out indefinite free service. FR-SYS-050 is simply silent about trial expiry. So the job performs the three transitions that are unambiguously time-driven and adverse — `TRIAL→GRACE`, `GRACE→READ_ONLY`, `READ_ONLY→SUSPENDED` — and an expired trial enters the *same* fourteen-day ladder a lapsed payer gets rather than being cut off on the morning it runs out. `TRIAL → GRACE` was added to `LEGAL_TRANSITIONS`, which is an addition to the table rather than a departure from it; `TRIAL → ACTIVE` stays legal and stays a person's decision. Recorded rather than resolved silently (CLAUDE.md rule). |
| 8 | FR-SYS-050 makes the *grace* window configurable and says nothing about how long `READ_ONLY` lasts. | `READ_ONLY_DAYS`, same default of 14, with the same argument: a company unable to enter data for a fortnight has had a fortnight's notice. Floor of one day — zero would suspend on the same tick that made the tenant read-only, and `READ_ONLY` would be a state nobody ever observed. **FR-SYS-070's ninety days is deliberately not configurable** and is a constant in the service: an operator-widenable — or narrowable — compliance floor is not a floor. |
| 9 | **`subscriptions.plan_id` says what a tenant *was* billed on in March. Nothing said what April should be computed from.** | `tenants.plan_id`, nullable. Null is a company still in trial or on a bespoke arrangement, and the sweep **skips** it rather than guessing — `computeForTenant` returns null and `computeAll` counts it as unbilled instead of failed. A tenant that *is* on a plan whose tiers do not cover its fleet is a genuine misconfiguration and does throw (`PLAN_TIER_NOT_FOUND`), because somebody has to fix the plan. A fleet of **zero** is the one exception: tiers start at one vehicle by schema, so `tierFor` finds nothing, and the honest charge for a company that has not entered its vehicles is `0.00` rather than an error. |
| 10 | *"the count of vehicles active during that period"* — which vehicles? | Those that **overlapped** the period: registered on or before its last day, and not removed before its first. Not *"active on the last day"* — a company that ran twelve vehicles all March and sold two on the 30th operated twelve, and billing ten would make the end of a month the cheapest time to off-hire. `status` is deliberately **not** in the predicate: it carries no history, so a vehicle marked `INACTIVE` today would read as having been inactive all period and a tenant could zero its month on the last day. Removal is `deleted_at`, and that one is timestamped. The predicate lives in `VehicleRepository` and is reached through `VehicleService` — what *"active during"* means is the fleet's own definition to state, not a predicate for a billing job to invent (SDD §3.2). |
| 11 | A charge is `count × price`. Where does the arithmetic happen? | `bigint` minor units throughout, `fromMinor` once at the end (SDD §11.1, FR-FIN-290). The stored row keeps `active_vehicle_count`, `amount` and `currency` **as computed**: editing a plan's tiers afterwards does not rewrite a charge it already priced (SDD §1.2 P5), it applies from the next period. Re-running the *same* period does overwrite, and `subscriptions_tenant_id_period_start_key` is what makes that a correction rather than a second bill — idempotence at the database, not merely in the code. |
| 12 | FR-SYS-070 says *"retained for a minimum of 90 days after suspension before any deletion, and … restorable in full upon reactivation"*. What does the code do? | Suspension **deletes nothing**, so *"restorable in full"* is a property of doing nothing and is asserted as one: a vehicle seeded before suspension is still there after reactivation. `suspended_at` starts the clock and is **cleared on reactivation** — a tenant that came back was never within the window, and leaving the stamp would make a purge eligible ninety days after a suspension lifted the next morning. `POST /platform/tenants/:id/purge` is SDD §17.2's *"manual sysadmin action only"*, refused three ways: not suspended, inside the floor (`TENANT_RETENTION_ACTIVE`, carrying `retainedUntil` so the console can say *when* rather than only *no*), or the legal name typed back wrongly. |
| 13 | What the purge actually does, and what it deliberately does not. | It stamps `tenants.deleted_at`. Every lookup in the system already filters that column, so the company leaves the registry, login, every job's sweep and the sysadmin's own list — which is what deletion means to this application, and the endpoint asserts the 404. It does **not** issue `DELETE` against forty operational tables from an HTTP request. Physical erasure of personal data has its own audited pipeline in `compliance` (FR-KVK-070), which is the requirement that actually governs what must go; a cascade with no undo, triggered by a click, is a different and far more dangerous thing. Recorded here so the boundary reads as a decision rather than an omission. |
| 14 | **`announcements` carries `tenant_id` and cannot be policied.** A global announcement is `tenant_id NULL` and every tenant must read it; a `tenant_id = app.tenant_id` policy hides exactly those rows, and its `WITH CHECK` makes them impossible to insert — the sysadmin who publishes one holds no tenant context. | Registered as a platform-scoped exemption, with the same argument `audit_log` already carries and the same requirement that `test/tenant-isolation.spec.ts` imposes: a table carrying `tenant_id` is either policied or justified in the registry, never neither. The compensating control is that the **only** tenant-facing read is `AnnouncementService.forTenant`, whose predicate takes the tenant from the verified request context and has no parameter to substitute; the Sysadmin's filtered list is a separate method on a SYSADMIN-only route. `GET /announcements` is its own controller rather than a per-method role override inside `PlatformController` — the arrangement `MeTenantController` established in Phase 3. |
| 15 | The announcement text is the one user-facing string in the system that is not in `packages/i18n`. | It cannot be. A sysadmin types it at the moment they need it, and a translation catalogue cannot hold a sentence nobody has written yet. CLAUDE.md's rule is about the *product's own* strings; an operator's message is content, exactly as a student's name is — the same argument `NotificationBroadcastService` already makes for FR-NOT-070. The console labels the field in Turkish and the body is stored verbatim. |
| 16 | FR-SYS-090 names five indicators and the system had **none** of the first three. | `infra/metrics` — per-minute Redis buckets with a TTL for counts, a bounded 1 000-sample reservoir for latency, fed by a global `MetricsInterceptor` and by `NotificationDispatchService`. Redis rather than a process counter because the API is a replica set (SDD §2.2); buckets rather than a running total because a lifetime error rate on a replica that has been up a fortnight cannot show an incident that began ten minutes ago. **Unknown is `null`, never `0`** — a zero error rate displayed because the metrics store is down is the most dangerous number the screen could show (SDD §1.2 P6). The other two indicators are read from where they already exist: BullMQ's own `getJobCounts`, and `MapsBudgetService.usage()` — which `MapsHealthIndicator` has said since Phase 5 that Phase 10 would reuse *"rather than growing a second source"*. Only 5xx counts as an error; a 404 or a 422 is the API working. |
| 17 | `/platform/health` needs `MapsBudgetService`, and `RoutingModule` imports `PlatformModule`. | A separate `PlatformHealthModule` importing both, which is the arrangement `RouteSheetsModule` already uses for the same shape of problem. A third `forwardRef` for one read-only figure would knot the module map (SDD §3.1) for every reader afterwards. The queues come from `ALL_QUEUES` through one factory token rather than twelve `@InjectQueue` parameters, so a queue added to SDD §13's catalogue appears on the screen without anyone editing a constructor. |
| 18 | `platform` now needs one number from `company`, which already imports `platform`. | `forwardRef`, as the identity cycle already is — and it is one call to `VehicleService`, never to a repository. The alternative was a `SELECT count(*) FROM vehicles` inside the platform module, which is the drift SDD §3.2 exists to prevent, on the one query whose answer is a customer's invoice. |
| 19 | Both new jobs are timed in the platform's timezone rather than each tenant's, which is not what SDD §13 says. | §13's rule is about jobs whose subject is a **service day** — a route for tomorrow morning, an absence cut-off, a nine-o'clock reminder. Neither of these is one. A subscription period is a calendar month by agreement, and a fourteen-day grace window measured to the tenant's local hour would end at a different instant for two customers on the same plan. `computeSubscriptionCharges` also runs **daily**, recomputing *last* month, for the reason `generateRecurringExpenses` records: a monthly cron that fired during an outage would skip the month in silence, whereas a daily tick is self-healing and the unique index makes the twenty-nine repeats a no-op. |

### Defects found by this phase, in code outside it

| Defect | Where | Resolution |
|---|---|---|
| **`TenantPrismaService.platform` typed as the `$extends` result made every platform-scoped repository uncompilable the moment the Prisma client was regenerated.** Each is written `(tx ?? this.db.platform).model…`, so the receiver is a union of `Prisma.TransactionClient` and the extension's client; TypeScript refuses to call across a union of two differently-generic signatures, and reported it in eight repositories at once — none of which had changed. | `common/tenancy/tenant-prisma.service.ts`, since Phase 1 | `PlatformClient` is now `TenantTx`, with one assertion at the binding. The extension adds a `query` hook and no fields, so the guarded client *is* structurally the client it wraps; `Prisma.TransactionClient` is also the narrower of the two — it omits `$transaction`, `$connect` and `$on`, which is exactly right for a handle documented as never opening a transaction of its own, and nothing in the codebase asked it for one. |
| `POST /platform/plans/:id/archive` and `/restore` answered 201 | This phase's own controller, found by its own test | `@HttpCode(HttpStatus.OK)`. Neither creates anything. |

### Test-infrastructure changes — Phase 10 step 2

| Change | Why |
|---|---|
| `MetricsService.reset()` | The counters are shared Redis keys with a two-hour TTL, so one suite's traffic is the next suite's baseline. `reset` is called by the two health cases and by nothing in production — the alternative was asserting on figures that included whatever the rest of the run happened to have done. |
| `cleanupTenants` deletes `announcements` | `announcements.tenant_id` cascades, which covers the per-tenant rows. **Global** rows cascade from nothing, and one left behind is shown to every later suite's tenants — a cross-suite failure that would appear only when the suites ran in a particular order. |
| `sysadmin-console.integration.spec.ts` charges the **current** month | The sweep bills *last* month, and `previousMonth` is asserted directly in the unit suite. Here the period is passed explicitly so the fixtures can be ordinary rows created now, rather than rows with a backdated `created_at` that no code path would ever produce. |
| `baseline-migration.integration.spec.ts` moves `announcements` into the inventory | The guard working. It happens once, in the diff that lands the phase. `quote_requests` is joined by `tenant_invoices` as the entry that would catch a billing module nobody asked for (SRS OI-01 keeps payment recording manual in V1). |

### Step 3 — the Sysadmin web console

`apps/web/src/features/platform/`, the `SysadminLayout` shell Phase 0 left empty, and the
`platform` resource in `packages/contracts` that had never existed.

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-SYS-010 | §15.1 the sysadmin shell | `features/platform/TenantsPage.tsx`, `TenantDetailPage.tsx` | `TenantsPage.spec.tsx` — "renders each company with its lifecycle status", "names the plan a company is billed on", "says so when a company is on no plan", "shows the empty state" | Verified |
| FR-SYS-020 (UI) | §15.2 the component kit | `features/platform/PlansPage.tsx` — the tier editor | `sysadmin-console.integration.spec.ts` (the rules it submits against); `subscription-pricing.spec.ts` (the rules themselves) | Verified |
| FR-SYS-040 (UI) | §11.1 — rendered, never recomputed | `TenantDetailPage.tsx` `ChargesPanel` | `sysadmin-console.integration.spec.ts` — the charge cases | Verified |
| FR-SYS-050 (UI) | §17.4 — the reason is what the entry is read for | `TenantDetailPage.tsx` `LifecyclePanel` | `sysadmin-console.integration.spec.ts` — "refuses an illegal jump" | Verified |
| FR-SYS-070 (UI) | §17.2 *"manual sysadmin action only"* | `TenantDetailPage.tsx` `RetentionPanel` | `sysadmin-console.integration.spec.ts` — the four purge refusals | Verified |
| FR-SYS-080 | *"displayed on login"* | `features/platform/AnnouncementsPage.tsx` (publisher); `AnnouncementBanner.tsx` in `AdminLayout` (audience) | `AnnouncementBanner.spec.tsx` — five cases; `sysadmin-console.integration.spec.ts` — the seven announcement cases | Verified |
| FR-SYS-090 | §18.3, §8.3 | `features/platform/health/HealthPage.tsx` | `HealthPage.spec.tsx` — "reports every indicator the requirement names", "renders an unmeasurable figure as unknown rather than as zero", "says so when the maps budget is spent", the three dependency cases | Verified |
| FR-SYS-100 (console side) | §7.2, §4.4 | `TenantDetailPage.tsx` `ImpersonateButton` and `AuditPanel` | `impersonation.integration.spec.ts` (Phase 1, the server side this drives); `sysadmin-console.integration.spec.ts` — the platform-role routing fact | Verified — *"the server side landed in Phase 1, the console that starts a session lands here"* (PROJECT_PLAN Phase 10) |
| FR-FLG-010 / FR-FLG-020 (UI) | §7.3 — evaluated server-side, rendered here | `TenantDetailPage.tsx` `FlagsPanel` | `feature-flags.integration.spec.ts` (Phase 1, the behaviour this toggles) | Verified |
| FR-KVK-080 (console view) | §17.4 | `GET /platform/tenants/:id/audit`; `AuditPanel` | `sysadmin-console.integration.spec.ts` — the authorisation matrix | Verified |
| NFR-USA-050/060/070 | Every label from `packages/i18n` | `sysadmin.*` and `announcementBanner.*`, 186 keys in each locale | `index.spec.ts` parity and no-empty-string checks | Verified |

### Decisions recorded during Phase 10 — step 3

| # | Point | Resolution |
|---|---|---|
| 20 | **Defect: the sysadmin console was unreachable.** `RequireRole` derives the role from `me.memberships` matched against the token's tenant, and a Sysadmin holds **no membership** — granting one would be precisely what FR-SYS-120 forbids. So `membership` was null, the guard rendered `TenantSwitcher` over an empty list, and `LoginPage` navigated unconditionally to `/admin`, which bounced straight back. Invisible until Phase 10, because until Phase 10 the shell behind it held one placeholder screen. | `MeResponse.platformRole`, populated from the row in both places that build it. `AuthProvider` prefers it over the membership role, exactly as `effectiveRole` does on the server; `RequireRole` skips the switcher for it; `LoginPage` routes on it. It is a **routing** fact and not an authorisation one — `AuthGuard` re-derives the platform role from the database on every request, so a client that lied about it would reach a login screen it cannot use rather than any data. |
| 21 | `SysadminLayout` could have been `AdminLayout` with a different menu. | It is not, and the reason is that everything the Admin shell wraps itself in is meaningless here: `ReadOnlyProvider` reads a tenant status a Sysadmin does not have, and the impersonation banner belongs to the shell a Sysadmin *lands in* rather than the one they leave from. Sharing a layout would mean a provider that is load-bearing in one shell and inert in the other. There is no tenant switcher either — the console reaches a company's *data* only through an audited session, and a switcher would suggest a third way FR-SYS-120 does not permit. |
| 22 | One company, five screens or one? | One, with tabs. The questions an operator arrives with — *"why can this customer not work"*, *"what are they paying"*, *"who has been in their account"* — are about the same company on the same afternoon, and five routes would mean re-finding the tenant four times. Each tab's query is `enabled` on its own panel, so nothing loads until it is asked for. |
| 23 | The tier editor could have validated the tier list. | It does not. `createSubscriptionPlanSchema` refuses a gap or an overlap, in `packages/shared`, and the server applies the same schema — a second set of rules in the form would be a second thing to keep in step. What the editor does is *shape* the input: a new tier starts where the previous one ended, and the last is open-ended, so the common case is right without thinking. Prices are typed and sent as **strings** and never parsed to a number on the way through (FR-FIN-290). |
| 24 | FR-SYS-080 says *"displayed on login"*. A field on `LoginResponse`? | No — a banner in the shell, fed by `GET /announcements`. Both reasons are about the second minute rather than the first: a notice attached to the login response vanishes on the first page reload, and one published while somebody is already working never reaches them at all. Dismissal is per session and per announcement, held in component state: persisting it would let a maintenance warning be dismissed once and never seen again by the person who needed to act on it. The banner renders **nothing** on failure and its query does not retry — a decoration must never take down what it decorates. |
| 25 | The audit view needed a read endpoint that did not exist. | `GET /platform/tenants/:id/audit` and `/impersonations`, both SYSADMIN-only. `AuditEntrySummary` deliberately **omits `before` and `after`**: they are whole tenant rows, and a console rendering them would show a Sysadmin tenant data outside an impersonation session — which is exactly FR-SYS-120. What the view is for is *who did what, when and why*. The `action` is rendered as its raw key rather than translated: it is an operator's trail, and a Turkish sentence per action would put the catalogue permanently one action behind the code. |
| 26 | Every figure on the health screen can be `null`. | `Figure` has no fallback parameter. A component that could be *told* to show `0` for a missing number is a component somebody will eventually tell to, and a zero error rate displayed because Redis is down is the most dangerous number the console could show. `null` renders *"unknown"* with the reason under it. |
| 27 | A third status colour. | `--warning` joined the palette. `GRACE` and `READ_ONLY` mean a customer can still work — partly — so colouring them `destructive` alongside `SUSPENDED` would make the console's most-read column say that three different situations are the same one. |

### Test-infrastructure changes — Phase 10 step 3

| Change | Why |
|---|---|
| `HealthPage.spec.tsx` routes its `fetch` stub by URL | The screen now reads **two** endpoints — Phase 10's aggregate and Phase 0's liveness probe. Answering both from one body, which the previous stub did, would have handed the aggregate a payload with no `requests` object and failed somewhere unrelated to whatever the case was about. |
| `auth.service.spec.ts` (mobile) gains `platformRole: null` | `MeResponse` grew a required field. Null in every case that suite exercises, and the comment says why: `loginSchema`'s `surface` discriminator keeps a Sysadmin off the mobile application entirely. |

### Step 4 — verification, and the V1 inventory audited

**Status.** All five suites run against a live database on 2026-08-16 and are green:

| Command | Result |
|---|---|
| `pnpm lint` | clean across all eight workspaces |
| `pnpm typecheck` | clean across all seven that have one |
| `pnpm test:unit` | 1 049 passed (52 files; 992 → 1 049, and 48 → 52 files) |
| `pnpm test:integration` | 864 passed, 2 skipped — the opt-in route-generation benchmark |
| `pnpm test:tenant-isolation` | 20 passed, over the discovered table set including `announcements` |
| `pnpm test:trip-invariants` | 100 passed, unchanged — this phase adds no trip edge |

Three migrations landed: `20260817000000_report_jobs_operational_kinds`,
`20260817000100_sysadmin_console`, and no third — the console needed one table and five
columns.

#### The V1 inventory, requirement by requirement

The SRS declares **174 V1** requirements and **9 V2**. Every V1 identifier was matched
against the rows in this file, and every V2 identifier was grepped for across `apps/` and
`packages/`.

| | Count |
|---|---|
| V1, `Verified` | **166** |
| V1, `Implemented` — a stated gap, not a claim | 6 |
| V1, verified outside this repository | 1 |
| V1, **not implemented** | 1 |
| | **174** |
| V2 found in shipped code | **0** |

> **This count is Phase 10's and is left as the record of that audit.** The eight rows it
> reports as short of `Verified` were the subject of *Closing the open list* below; the
> current figure is in *The V1 inventory, closed* at the end of this file.

The six `Implemented` rows, each with the reason already written where it was recorded:

| Requirement ID | Recorded in | Why it is not `Verified` |
|---|---|---|
| FR-AUTH-090 | Phase 8, decision 18 | Its logic is one pass-through to the transport, and asserting a pass-through asserts the test. The *server* half is `Verified` from Phase 1 |
| FR-ABS-060 | Phase 5 | The `route.changed` event is emitted and asserted; the guardian-facing push it should raise has no recipient resolver (Phase 8's carried list, `instalment.due` and this one) |
| FR-RTE-150 | Phase 5 | The endpoint, the template and the worker binding are asserted; the *rendered* PDF is not, because no test may launch Chromium (SDD §19.2). Phase 10 did not change this — it made the finance and reporting PDFs jobs on the same principle |
| FR-FIN-150 | Phase 4 | `GET /me/fees` is asserted as a registered route; the Parent screen that renders it is a mobile component |
| FR-TRP-040, FR-TRK-040 | Phase 8, decision 12 | No React Native renderer in this repository. The logic behind each screen is covered and the rendering is not |

Three further surfaces are built, reachable and untested, recorded in Phase 3's *Not
closed*: `AssignmentsPanel` (FR-CMP-060/070), the `ImpersonationBanner` countdown
(FR-SYS-100) and `parse-preview.ts` (FR-CMP-110). Each requirement's *server* behaviour is
`Verified`; what is missing is a component test, and Phase 10 adds one of the three —
Phase 3 asked for *"a component test with a fixed clock"* for the impersonation banner and
this phase did not write it either.

All nine V2 identifiers appear only in comments explaining why the feature is *absent* —
`sweep_checks.photo_key` created and never written (FR-ATT-130), `PaymentMethod` without
`ONLINE` (FR-FIN-160), the SMS channel built against the interface and disabled
(FR-NOT-070), payroll as an ordinary expense category (FR-FIN-220). The schema
accommodates them; the code does not contain them, which is CLAUDE.md rule 2 exactly.

#### Rows this phase closed that no earlier phase had opened

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-OFF-040 | §10.2 outbox; §9.2 *"retaining their original timestamps"* | `apps/mobile/src/sync/ping-sync.ts`, `location/tracking-controller.ts`; `POST /trips/:id/pings` | `ping-sync.spec.ts` — 15 cases, including "sends the queue and empties it", "leaves every reading queued" (offline), "sends the same batch again on the next attempt", "stops after the batch limit"; the queued `recordedAt` is the capture instant and never the send instant | Verified — **the work landed in Phase 7 and the row was never written.** Found by this phase's audit, which is what the audit is for |
| FR-KVK-110 | §2 *"Managed platform, EU or TR region. Constraint: FR-KVK-110"*; §18.1 | Not code. `packages/shared`'s coordinate schema is bounded to the globe rather than to Türkiye, deliberately — a *data* restriction would be a different requirement — and the geocoding provider biases to TR for accuracy rather than for residency | — | **Verified at provisioning, not by a test.** No assertion in this repository can prove where a managed Postgres instance runs. Recorded so the absence of a row reads as a boundary rather than an oversight; it belongs with the quarterly restore test (NFR-AVA-060) on the first-production-deploy list |
| FR-ATT-030 | §14.4 driver constraints | `features/crew/AttendanceScreen.tsx`, `availableMarks` | `crew-action.spec.ts` — six `availableMarks` cases | Verified — the Phase 6 row read *"Not started (out of scope)"* and was superseded by Phase 8's grouped `FR-ATT-010/020/030` row. Restated here because a grouped identifier is invisible to a search for the single one |

### Outstanding at the close of Phase 10 — **cleared**

The plan ended at Phase 10, so this table was the project's open list rather than the next
phase's inbox. Every row on it is now closed, and the section below says by what. It is
kept rather than deleted: a list that disappears when it empties leaves no evidence that
the items were worked rather than dropped.

| Item | Requirement | Closed by |
|---|---|---|
| **`enforceRetention` for attendance** — the one V1 requirement in the SRS with no implementation | FR-KVK-040 | **Step 1.** Weekly job on `QUEUE_COMPLIANCE`; archives each expired trip's attendance to object storage and then destroys it through the one SQL function permitted to. 8 unit cases on the academic-year boundary, 10 integration cases against a live database |
| Six `Implemented` rows | FR-AUTH-090, FR-ABS-060, FR-RTE-150, FR-FIN-150, FR-TRP-040, FR-TRK-040 | **Steps 2, 4 and 5.** FR-ABS-060 by the crew resolver and its despatch test; FR-AUTH-090, FR-TRP-040 and FR-TRK-040 by the React Native stand-in — plus a map that did not exist; FR-FIN-150 by a Guardian fee screen that did not exist; FR-RTE-150 by asserting the four things the requirement says the sheet must *contain*, which live in the HTML and not in Puppeteer's output |
| Three untested component surfaces | FR-CMP-060/070, FR-CMP-110, FR-SYS-100's banner countdown | **Step 3.** 6, 20 and 8 cases, written against the sentences Phase 3 used when it recorded them under *Not closed* |
| SDD §3.3 and §12.2 still lack `trip.overdue` | FR-TRP-090 | **Step 5.** Both amended — and the audit turned up six further events and four further catalogue entries that had drifted out of the documents in the same way |
| `NOTIFICATION_PORT` bound to `LoggingNotificationAdapter` | FR-AUTH-050/060/100, FR-SYS-110 | **Step 2.** `EmailNotificationAdapter` over `infra/mail`'s `EMAIL_CHANNEL`; asserted against an in-process SMTP server on a real socket, because a stub proves *who* is notified and nothing about whether the message survives the wire |
| A navigator, and SDD §12.4's push deep-link | — | **Step 4.** React Navigation, identifier-only route parameters, `resolveDeepLink`, and the device registration without which nothing would ever have arrived to deep-link |
| Staging environment, quarterly restore test | NFR-AVA-060 | **Not closed here, and it cannot be.** Moved to the list below, which is where it always belonged: it is a provisioning obligation, not an engineering task, and no assertion in this repository can discharge it |

### What remains, and why no amount of code closes it

Two items, both of the same kind: an obligation discharged by **provisioning a deployment**
rather than by writing anything. They are listed here rather than left in the table above,
because a list of open engineering work that contains items no engineer can close is a
list people stop reading.

| Requirement | Obligation | Where it is discharged |
|---|---|---|
| NFR-AVA-060 | *"Backups shall be taken daily and restorable within four hours; a restore shall be tested quarterly."* | The daily backup is a managed-database setting; the restore test is a calendar commitment with a written result. `docs/PROJECT_PLAN.md`'s cross-cutting table already places it at *"first production deploy"* and quarterly thereafter |
| FR-KVK-110 | *"Personal data shall be stored within the European Union or Türkiye."* | The region chosen when the managed Postgres, Redis and object storage are provisioned. Recorded at the close of Phase 10 in the same terms: no assertion in this repository can prove where a managed instance runs |

Neither is a gap in the software. What the repository can do for both, it does: the
environment schema refuses a production boot without a mail relay and without encrypted
mail submission, `FR-KVK-040`'s sweep and `FR-KVK-030`'s partition drop enforce the two
retention limits automatically, and `packages/shared`'s coordinate schema is deliberately
bounded to the globe rather than to Türkiye — a *data* restriction would be a different
requirement from a *residency* one.

## Closing the open list

*Not a phase.* `docs/PROJECT_PLAN.md` ends at the sysadmin console; what follows is the
open list above, worked item by item until the table is empty. Each step below closes one
row of it and says what closed it.

### Step 1 — `enforceRetention` for attendance (FR-KVK-040)

*Migration `20260817000200_attendance_retention`. Module `compliance`.*

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-KVK-040 | §13 `enforceRetention`, §17.2 *"Weekly job; archived to cold storage then deleted"* | `compliance/services/attendance-retention.service.ts`, `repositories/attendance-retention.repository.ts`, `jobs/compliance.processor.ts`; SQL function `retention_delete_attendance` | `attendance-retention.spec.ts` — 8 boundary cases; `attendance-retention.integration.spec.ts` — 10 cases, including "archives to cold storage and then destroys the expired attendance", "leaves everything inside retention exactly as it was", "wrote a complete, readable copy of what it destroyed"; `job-schedules.integration.spec.ts` — the weekly cadence | Verified |

**What the job does.** Weekly, Sunday 04:10 tenant-local, on `QUEUE_COMPLIANCE`. For each
operating tenant it selects the trips whose service date precedes the retention boundary
and whose attendance has not already been purged, reads their `trip_stop_students`,
`trip_events` and `sweep_checks` rows, writes them as one gzipped JSON object to
`retention/<tenant>/attendance/<cutoff>/<instant>.json.gz`, and only then destroys them.
Batched by trip (`ATTENDANCE_RETENTION_BATCH`, default 200), audited per batch with counts
and the archive key and never with contents, and one tenant's failure does not stop the
sweep.

### Decisions recorded during step 1

| # | Point | Resolution |
|---|---|---|
| 28 | **FR-KVK-040 and FR-TRP-110 point in opposite directions.** One requires attendance destroyed at academic year + 1; the other requires *"a permanent, queryable history of all completed Trips **including attendance outcomes**"*. Both are V1 and neither is qualified. | Resolved by **what** is destroyed rather than by choosing a winner. `trips` and `trip_stops` are out of scope and survive for ever: after a sweep a trip still records that a vehicle ran a direction on a date with a named driver, which is the operational history FR-TRP-110 is about. What is destroyed is every row attaching a **child's name** to it — the three tables listed above. SDD §17.2's *"archived to cold storage"* is where the attendance outcomes go, and it is why the job archives before it deletes rather than deleting alone. Recorded here rather than silently taken, because a reader arriving at FR-TRP-110 will otherwise think the requirement was forgotten. |
| 29 | `trip_events` and `sweep_checks` are append-only by `20260811000000_trip_execution` — REVOKE from the application role plus a trigger refusing DELETE for **every** role, the owner included. FR-KVK-040 mandates a delete. Two structural rules of the system, in direct contradiction. | The guard gains **one** exception and it is made as narrow as it can be. The application role is still granted no DELETE. The only route is `retention_delete_attendance`, `SECURITY DEFINER`, whose body fixes the predicate to one tenant, one cutoff date and an explicit list of already-archived trip identifiers — there is no parameter that widens it. The trigger admits a DELETE only while `app.retention_sweep` is on, and the only thing that sets it is that function, transaction-locally, releasing it before it returns. `attendance-retention.integration.spec.ts` — *"still refuses an ordinary delete of an attendance event"* — is the regression guard on the rule that remains. |
| 30 | The function runs as the schema owner, which is a superuser, so RLS is **not** what scopes it. CLAUDE.md rule 1 forbids relying on a hand-written `WHERE tenant_id =` alone. | The function opens with the same assertion `assert_trip_tenant_context` makes: `app.tenant_id` must equal its `p_tenant` argument or it raises. So the tenant predicate is enforced twice — by the caller's context and by the row filter — and it fails closed. Asserted directly: *"refuses to destroy anything without the tenant's own context"*, in both the no-context and the wrong-tenant forms. |
| 31 | After a delete, an expired trip and an already-swept one look identical — old, with no attendance rows. | `trips.attendance_purged_at`, written by the function as its last statement. Last, so a failure anywhere above leaves the trip unmarked and next Sunday retries it. Without the column the sweep would write an empty archive object for every historical trip every week, for ever; with it, the column is also the demonstrable record that a retention obligation needs and that an absence of rows is not. |
| 32 | Retention is measured in **academic years**, so it cannot be a rolling window of days the way FR-KVK-030's thirty are. | `attendanceRetentionCutoff(now, startMonth, extraYears)`, a free function so the eight cases that matter can be walked without a database. `ACADEMIC_YEAR_START_MONTH` defaults to 9 and `ATTENDANCE_RETENTION_EXTRA_YEARS` to 1, floored at one so the sweep can never be configured into breaching the requirement. Computed on the UTC calendar: a zone conversion could only move the boundary a day either side of 1 September, and keeping a record a day longer is the safe direction. |
| 33 | Which queue. | `QUEUE_COMPLIANCE`, not `QUEUE_TRIPS`. The obligation is this module's, the traversal is the one `exportSubjectData` already makes, and it is the only other job in the system that writes an archive to the bucket. Putting a job that destroys attendance history behind the five-minute detector would also mean a long archive pass delaying FR-ATT-100's alert about a child possibly still on a vehicle. 04:10 on Sunday rather than 03:40, because FR-NOT-050's sweep already holds 03:40 — asserted, so the two cannot drift onto the same tick. |

### Step 2 — the notification pipeline delivers (FR-AUTH-050/060/100, FR-SYS-110, FR-ABS-060, FR-FIN-110)

*New: `apps/api/src/infra/mail/` (transport, port, two channels, module),
`identity/adapters/email-notification.adapter.ts`. Removed:
`identity/adapters/logging-notification.adapter.ts`. No migration.*

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-SYS-110 | §12, §4.4 — *"notify the impersonated Tenant's Admin **by email** … including the recorded reason"* | `infra/mail/`, `identity/adapters/email-notification.adapter.ts` | `identity-notifications.integration.spec.ts` — "delivers to the tenant's Admin and carries the recorded reason", "survives Turkish end to end", "says so rather than failing silently when the tenant has no active Admin" | Verified — *was* "Verified (port; email Phase 7)" |
| FR-AUTH-050 | §12 despatch | `email-notification.adapter.ts` (`registration.approved` / `.rejected`) | `identity-notifications.integration.spec.ts` — "delivers an approval naming the company and the role", "delivers a rejection carrying the Admin's reason" | Verified — *was* "Verified (port; despatch Phase 7)" |
| FR-AUTH-060 | §6.2 `/admin/users/invite` | `email-notification.adapter.ts` (`user.invited`) | `identity-notifications.integration.spec.ts` — "delivers FR-AUTH-060's invitation to somebody who has installed nothing" | Verified |
| FR-AUTH-100 | §16 — *"and notify the account holder"* | `email-notification.adapter.ts` (`account.locked`) | `identity-notifications.integration.spec.ts` — "delivers after five consecutive failures, naming the window" | Verified |
| FR-ABS-060 | §6.3 `route:changed`, §12.2 | `notification.service.ts` `route.changed` branch, `notification-recipients.service.ts#forCrew` | `notifications.integration.spec.ts` — "reaches the driver and host, and nobody's guardian", "deduplicates a repeat of the same cause and admits a different one" | Verified — *was* `Implemented` |
| FR-FIN-110 (despatch half) | §12.2, §13 `sendPaymentReminders` | `notification.service.ts` `instalment.due` / `instalment.overdue` branch | `notifications.integration.spec.ts` — "names the child, the balance and the due date — and goes to one guardian", "sends the overdue notice as its own message", "writes nothing for an instalment that has gone" | Verified — the emit half was already Verified in Phase 4 |
| NFR-SEC-070 (mail) | §16 | `smtp-email.channel.ts`, `degraded-email.channel.ts` — code and identifiers only, never the address or the body | `env.schema.spec.ts` — "refuses unencrypted mail submission in production" | Verified |
| NFR-MNT-040 | §16 Secrets | `env.schema.ts` `EMAIL_*`/`SMTP_*`/`ACADEMIC_YEAR_*`/`ATTENDANCE_RETENTION_*`, `.env.example` | `env.schema.spec.ts` — 5 new cases | Verified |

### Decisions recorded during step 2

| # | Point | Resolution |
|---|---|---|
| 34 | The step brief said the adapter would need a `forwardRef` pair between `IdentityModule` and `NotificationsModule`. **It was built that way and abandoned.** `notifications` imports `identity`, `company`, `trips`, `platform`, `compliance`, `crm` and `finance`, and several of those import `identity` in turn — so a back-edge did not create one cycle, it created a knot. Nest resolved `CompanyModule` as `undefined` at scan time; adding a `forwardRef` there moved the failure to `TripsModule`, and so on down the list. | The transport moved to **`infra/mail`**, where `infra/storage` and `infra/redis` already are, and the adapter stayed in `identity` — where the facts it resolves (a user's address, a tenant's Admin roll) actually live. `identity` imports `MailModule`; `MailModule` imports nothing but configuration. No cycle, no deferred imports, and one fewer thing for the next person to trip over. CLAUDE.md P6. Recorded because it is a deliberate departure from the instruction that opened the step. |
| 35 | Should the six identity notifications go through the SDD §12 pipeline — catalogue entry, `notification_messages` row, push? | **No, and not as a shortcut.** Every one of them addresses somebody who cannot be assumed to be inside the application: an applicant whose membership was `PENDING_APPROVAL` until this moment and has no tenant to receive a scoped push; an invitee who has installed nothing; somebody locked out of the very application the push would arrive in; an Admin being told about something that happened to their company. Routing them through the pipeline would mean a catalogue category no `DomainEvent` can raise, a `notification_messages` row scoped to a tenant the recipient does not belong to, and — worst — an FR-NOT-040 preference row somebody could use to switch off a security alert. Two ports, one shared shape, and the argument is written in `email-channel.port.ts`. |
| 36 | No mail library in `package.json`, and `pnpm add nodemailer` failed repeatedly on a filesystem race in this environment. SDD §2.3 fixes the stack and names no mail technology, so adding one is a decision either way. | **`infra/mail/smtp-transport.ts`** — the submission half of RFC 5321 in ~250 lines: greeting, `EHLO`, `STARTTLS`, `AUTH PLAIN`/`LOGIN`, `MAIL FROM`, `RCPT TO`, `DATA`, `QUIT`. Everything a mail library is large for — templating, attachments, DKIM, pooling, OAuth, plugins — is surface this system does not use and would still have to keep patched. The file states what it deliberately does *not* do, and the seam above it is `EmailChannel`, so replacing it later changes nothing else. |
| 37 | How to prove the mail is *delivered* rather than merely attempted. | `test/smtp-sink.ts` — an in-process SMTP server on an ephemeral port, and the application configured to submit to it. A stubbed `EMAIL_CHANNEL` would prove *who* is notified and nothing about whether the message survives the wire, and every encoding rule in the transport exists because Turkish is multi-byte: an unencoded subject arrives as mojibake, an unencoded body is truncated or refused, a body line beginning with `.` ends the `DATA` block early. The sink answers `EHLO` with a **multi-line** reply on purpose — a client that read one line per command would otherwise pass. |
| 38 | The body is base64 and the subject is an RFC 2047 encoded-word, always — not only when non-ASCII is present. | A conditional would be two code paths, one exercised by every English test fixture and the other by every real Turkish subject, which is exactly the wrong way round. |
| 39 | `EMAIL_PROVIDER=none` in production. | **Refused at boot**, unlike `PUSH_PROVIDER=none`. Push degrades to an in-app history the recipient can still read; mail has no such fallback, and FR-SYS-110's obligation is to a customer whose account somebody entered. `SMTP_ALLOW_PLAINTEXT` is refused in production for the same class of reason (NFR-SEC-070). |
| 40 | An impersonation session started in a tenant with **no active Admin**. | Logged at `warn`, naming the tenant and the session, and nothing is sent. The obligation cannot be discharged and the one outcome that must not happen is for that to be invisible. Asserted — and asserted to *resolve* rather than throw, because a notification failure must never roll back what raised it (NFR-AVA-040). |
| 41 | `instalment.due` and `instalment.overdue` had no resolver — the branch returned `[]` with a note. | Resolved through `finance`'s exported `InstalmentService`, never its repository (SDD §3.2), and the money is **formatted, never recomputed**: `Instalment.balance` is the server's own figure and `money()` from `packages/report-templates` renders it (CLAUDE.md rule 4). `primaryOnly` on the guardian lookup, because FR-FIN-110 names *"the primary Guardian"* — a family with three contacts must not get three demands for one debt. The dedup scope is the instalment and the category is already part of the key, which is what stops a `due` notice suppressing the `overdue` one for the same money. |

### Step 3 — the three untested component surfaces (FR-CMP-060/070, FR-SYS-100, FR-CMP-110)

*Scope `apps/web`. No production code changed except one `export` — see decision 44.*

Phase 3 listed three surfaces under *Not closed* and named the test each was missing.
Phase 10's audit repeated the list and observed that it had written none of them. These
are those three tests, written against the sentences Phase 3 used.

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-CMP-060 / FR-CMP-070 (console) | §6.2 assignments, §15.2 | `features/vehicles/AssignmentsPanel.tsx` | `AssignmentsPanel.spec.tsx` — 6 cases, including "offers no edit control on a bounded assignment", "offers no edit control on an open assignment either — only end and substitute", "withholds substitution when nothing is open to substitute", "renders a driver with no host as hostless rather than as blank" | Verified — *was* `Implemented` |
| FR-SYS-100 (banner) | §15.2, §7.2 | `auth/ImpersonationBanner.tsx` | `ImpersonationBanner.spec.tsx` — 8 cases on a fixed clock, including "derives the remaining minutes from expiresAt rather than from a duration", "switches to seconds inside the last minute", "survives a reload", "is not dismissible and does not scroll away" | Verified — *was* `Implemented` |
| FR-CMP-110 (preview) | §15.2 bulk import | `features/students/import/parse-preview.ts` | `parse-preview.spec.ts` — 12 cases, including "reads the semicolons Turkish Excel writes", "picks the delimiter that actually separates, not the one that appears", "handles Windows line endings", "answers unreadable for a spreadsheet rather than guessing" | Verified — *was* `Implemented` |
| FR-CMP-110 (report) | §15.2, §6.2 `/students/import` | `features/students/import/StudentImportPage.tsx` `ReportCard` | `StudentImportPage.spec.tsx` — 8 cases, including "names the spreadsheet row number, header included", "renders the server's Turkish message, not its code", "names the failing fields", "lists every rejected row rather than a summary of them" | Verified |

### Decisions recorded during step 3

| # | Point | Resolution |
|---|---|---|
| 42 | The `AssignmentsPanel` test has to assert an **absence** — that no edit control exists — and an absence is the kind of assertion that passes for the wrong reason. | Matched on a pattern rather than on a label: `/Düzenle\|Güncelle\|Kaydet/`, so a future control fails whichever Turkish word it picks. And the *positive* set is asserted in the same case — end, substitute, add — so the test fails if the panel loses a control as well as if it gains one. The absence is load-bearing: Phase 2 decision 4 records that there is no PATCH route because *"a PATCH would suggest the existing row is edited, which is the one thing FR-CMP-060 forbids"*, so an added edit button would compile, render, and fail at the network with a 404 that reads like an API bug. |
| 43 | The banner's countdown could have been tested with the real clock. | Fixed clock (`vi.useFakeTimers`, `vi.setSystemTime`), because the untested thing is *arithmetic against an instant that keeps moving*. A real-clock suite could only assert that some number appeared — which is exactly the assertion that would still pass if the countdown were frozen, and a frozen countdown is the specific failure the component's own comment calls *"worse than no number because it looks live"*. The reload case remounts and asserts the number is rebuilt from `expiresAt`, which is what that field was added to `MeResponse` for in Phase 3. |
| 44 | `ReportCard` was a private component of `StudentImportPage`. | Exported, with the reason in its doc comment. Reaching it through the page would have meant driving a file input, a `File`, a `FormData` and a stubbed multipart response — four things with nothing to do with *what a rejected row says*. One `export` and a sentence is a smaller cost than a test that is mostly setup. |
| 45 | jsdom implements `File` but not `Blob.prototype.text()`, which `parsePreview` reads with. | The shim lives in `parse-preview.spec.ts` and **not** in `src/test/setup.ts`. A global patch would make every other suite's `File` quietly non-standard, and the next person to hit a `File` bug would have one more place to look. Changing the parser to a `FileReader` dance no browser has needed since 2019 was the other option and is worse. |
| 46 | Which delimiter cases are worth having. | The one that matters is *"picks the delimiter that actually separates, not the one that appears"* — a semicolon file whose cells contain commas, which is every Turkish address. Counting raw occurrences would choose the comma and turn three columns into nine, and the Admin would conclude their file was broken and go and "fix" a file that was already right. |

### Step 4 — the navigator, SDD §12.4's deep link, and the four mobile screens

*Scope `apps/mobile`, plus one formatter moved into `packages/shared`. New dependencies:
`@react-navigation/native` + `native-stack`, `react-native-screens`,
`react-native-gesture-handler`, `expo-notifications`, `expo-linking`, `react-native-maps`
— every one at the version Expo SDK 54 bundles.*

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| SDD §14.1 (the navigator) | *"After authentication the root navigator selects a role stack"* | `navigation/RoleNavigator.tsx`, `navigation/routes.ts`; `navigation/RoleRouter.tsx` **removed** | `routes.spec.ts` — 11 cases over the route map and its linking config | Verified |
| SDD §12.4 (the deep link) | *"Every push carries a `data` payload with `type`, `tripId` and `studentId`, so that tapping it deep-links to the relevant screen"* | `navigation/routes.ts#resolveDeepLink`, `navigation/navigation-ref.ts`, `notifications/push.ts`, `notifications/expo-push-platform.ts` | `routes.spec.ts`; `push.spec.ts` — 15 cases, including the cold start and the exhaustive category sweep | Verified |
| FR-NOT-010 (registration) | §12.1, `POST /me/devices` | `notifications/push.ts#register`, wired in `App.tsx` on every launch | `push.spec.ts` — 6 registration cases | Verified — *the mobile application never registered a push token before this step; nothing could have arrived to deep-link* |
| FR-TRP-040 (crew screen) | §14.1 today screen | `features/crew/TodayScreen.tsx` | `TodayScreen.spec.tsx` — 6 cases | Verified — *was* `Implemented` |
| FR-TRK-040 (guardian map) | §9.3, §2.3 `react-native-maps` | `features/parent/VehicleMap.tsx`, mounted inside `child.visible` by `ChildrenScreen.tsx` | `ChildrenScreen.spec.tsx` — 10 cases, three of them the requirement's *"only where"* clauses | Verified — *was* `Implemented`, and the map did not exist |
| FR-FIN-150 (guardian screen) | §6.2 `GET /me/fees` | `features/parent/FeesScreen.tsx` | `FeesScreen.spec.tsx` — 11 cases | Verified — *was* `Implemented`; **the screen did not exist**, only the endpoint |
| FR-AUTH-090 (mobile) | §6.2, §16 | `features/auth/LoginScreen.tsx` | `LoginScreen.spec.tsx` — 7 cases | Verified — *was* `Implemented` |
| FR-FIN-290 | §1.2 P2 — *"clients render and queue; they never compute money"* | `packages/shared/src/money.ts#formatMoney`; `apps/web/src/lib/money.ts` and `packages/report-templates/src/html.ts` now delegate | `money.spec.ts` — 7 new formatting cases, including the exactness one past a double's ceiling; `html.spec.ts`; `FeesScreen.spec.tsx` | Verified |

### Decisions recorded during step 4

| # | Point | Resolution |
|---|---|---|
| 47 | **The deep link is what forced the navigator, not the back gesture.** Phase 8 decision 13 weighed a navigation library against a `useState` machine and chose the machine, recording the cost: *"there is no back gesture, no deep linking, and SDD §12.4's 'tapping a push deep-links to the relevant screen' has nowhere to land."* | The reason it had nowhere to land was structural rather than unwired: that machine's `TRIP` route held a whole `CachedTrip` **object**, and a push carries three identifiers and no history. The destination was unreachable by construction. So every route parameter is now an identifier and the screens read the rest from `trips_cache` — which React Navigation requires anyway for linking and state persistence, and which removes a real defect besides: a `CachedTrip` captured when `Today` rendered still said `PLANNED` after the driver had started it. |
| 48 | Where a tapped notification lands. | `resolveDeepLink(role, data)`, a pure function switching on the **role** first. The same event reaches two audiences with two different applications open — a `trip.cancelled` tells a guardian their child's bus is not coming and tells the driver not to set off, and those are different screens. Three cases resolve to `null` and none is an error: an Admin-facing category, a payload missing the identifier its destination needs, and a category addressed to the other role. In every one the application opens where it would have opened anyway; a navigator that guessed, or threw, would turn a malformed push into a crash on a driver's phone at 07:00. |
| 49 | A crew notification never opens the attendance screen, even when the category names a stop. | Two reasons, and the second is the one that matters: SDD §12.4 lists three keys and `tripStopId` is not one of them, and NFR-USA-030 is *"the screen does not auto-navigate away from the active stop"* — dropping a driver into a stop they did not choose is that same hazard from the other direction. |
| 50 | The cold start. | `DeepLinkRouter` holds one destination until `NavigationContainer.onReady` fires. A guardian tapping *"Elif servise bindi"* on a locked phone starts the process **because of** the tap; `expo-notifications` delivers the response before React has rendered anything, and a `navigate` at that moment is dropped silently — the application opens on the wrong screen and nobody can say why. `PushService.listen` therefore reads `getLastNotificationResponseAsync` as well as subscribing. |
| 51 | **The mobile application had never registered a push token.** `POST /me/devices` existed, `notificationsResource.registerDevice` existed in `packages/contracts`, and nothing called either. Every guardian notification in the system would have settled as `NO_DEVICE`. | Registration on **every launch**, because a token rotates without warning and a stale one delivers nothing — silently, which for FR-ATT-070's *"shall immediately notify all linked Guardians"* is the worst failure mode available. Four outcomes are distinguished rather than collapsed into a boolean, because each needs a different thing done about it, and none of them throws: a driver at 06:50 on a bad connection must still be able to start their trip (SDD §1.2 P5). |
| 52 | **Phase 8 decision 12 — *"no React Native renderer in this repository"* — was true and had become the reason four requirements could not be closed.** FR-TRP-040, FR-TRK-040, FR-FIN-150 and FR-AUTH-090 are each a claim that is only true *on a screen*. | `src/test/react-native-stub.tsx`: a DOM stand-in for the **eight** React Native primitives this application uses, aliased in the Vitest config. The surface is that small because Phase 8's decision shaped the code that way, so the stub is eighty lines rather than a preset. What the resulting tests prove is structure and behaviour; what they do **not** prove is native layout, and the file says so — `StyleSheet` returns its input, and a component that looked wrong on a phone would pass. The alternative is an emulator, and a suite that needs an emulator is a suite nobody runs. |
| 53 | `@testing-library/react` was tried first and abandoned. | `.npmrc` sets `node-linker=hoisted` (Metro cannot resolve pnpm's symlinks), so the root holds `apps/web`'s React 18 and the testing library carries a **second physical copy** of React 19 nested inside it for this workspace's peer. The component renders with one copy and the renderer's hook dispatcher belongs to the other: `Cannot read properties of null (reading 'useState')`, thrown from inside `useState`, saying nothing about the cause. Aliasing the entry points did not collapse them, because Vitest hands `node_modules` imports to Node where a Vite alias does not apply. `src/test/render.tsx` is `createRoot` plus a `Map` over `@testing-library/dom`, which has no React peer at all — every query is still the real library's. |
| 54 | FR-TRK-040 says *"on a map"* and there was no map. `ChildrenScreen`'s own comment said so and pointed at this file. | `react-native-maps` at the version Expo SDK 54 bundles — SDD §2.3's mobile stack names it. `VehicleMap` renders the vehicle and **this child's own stop**, and no route line: the rest of the route is another family's information as much as this one's. It is mounted **inside `child.visible`**, so the requirement's two *"only where"* clauses are enforced by there being no component rather than by a component that checks; `GuardianVisibilityService` remains the only thing that decides. The marker greys on FR-TRK-110's signal loss, because a pin that kept its colour while the position aged would be a parent standing at a kerb watching a bus that is not there. |
| 55 | FR-FIN-150's screen renders four money figures, and `money()` already existed twice — in `apps/web/src/lib/money.ts` and in `packages/report-templates/src/html.ts`. | `formatMoney` moved to `packages/shared/src/money.ts`, beside the arithmetic it formats the output of; both originals now delegate. Three implementations of *"1.234,56 ₺"* would be three places for a separator to be wrong, and the wrong one is the one nobody looks at. The screen never adds two amounts: the outstanding total is read, not derived from the instalment list, so a **waived** instalment cannot make the phone disagree with the invoice — which is the case `FeesScreen.spec.tsx` asserts directly. |
| 56 | FR-FIN-110's payment reminders had been resolving to the children list, for want of anywhere else. | They now open the fee screen. A guardian tapping *"taksit ödemesi yaklaşıyor"* is asking *"what do I owe"*, and the list of where their children are answers a question they did not ask. |

### Test-infrastructure changes — step 4

| Change | Why |
|---|---|
| `apps/mobile/vitest.config.ts` — `jsdom`, `esbuild.jsx: 'automatic'`, two module aliases | Expo's base tsconfig sets `jsx: "react-native"`, which esbuild reads as *preserve*: without the override the JSX reaches Node untransformed. The aliases are the React Native and `react-native-maps` stand-ins, matched as `^…$` regexes rather than string prefixes so `react-native-safe-area-context` resolves normally. |
| `apps/api/test/app-harness.ts` — a 50 ms yield before `app.close()` | **A flake found by this step and worth recording as one.** BullMQ opens its connections lazily and issues `CLIENT SETNAME`/`INFO` on the first tick; ioredis's close handler flushes the command queue by *rejecting* every pending promise, and BullMQ does not catch them. Node reports an unhandled rejection and Vitest counts it as an error in a suite whose assertions all passed. It appears only in the suites that boot the application and close it almost immediately — `routing-wiring`, `finance-wiring` — and only in about one run in three, which is the worst possible frequency: often enough to fail a pipeline, rarely enough to be dismissed. `RedisService.onModuleDestroy` already takes exactly this precaution for the connection it owns and explains it at length; this is the same precaution for the ones a harness does not. Production never meets it — a replica that has served traffic has no boot-time command outstanding when SIGTERM arrives. |

### Step 5 — the document amendments, and the last `Implemented` row

*Scope `docs/SDD.md`, plus `packages/report-templates/src/route-sheet.spec.ts`.*

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-TRP-090 (documentation) | §3.3 event union, §12.2 catalogue | `docs/SDD.md` — both amended | `notification-catalogue.spec.ts` (the catalogue as data, which is what the table documents) | Verified — the code has had the event since Phase 6; the documents now say so |
| FR-RTE-150 | §11.6, §16 | `packages/report-templates/src/route-sheet.ts` | `route-sheet.spec.ts` — 15 cases | Verified — *was* `Implemented` |

### Decisions recorded during step 5

| # | Point | Resolution |
|---|---|---|
| 57 | The carried debt was *"SDD §3.3 and §12.2 still lack `trip.overdue`"*. Auditing it found that the debt was larger than the entry. | §3.3's union was missing **seven** members — `trip.overdue`, `stop.arrived`, `stop.completed`, `student.undelivered`, `student.returnedToSchool`, `trip.crewAssigned`, `trip.signalLost` — and several payloads had grown a field. §12.2 was missing **five** rows. All twelve are now in the documents, with an amendment note naming which phase each landed in. The lesson is the one this file already draws about grouped identifiers: a document that is a *copy* of a declaration drifts, and the drift is invisible until somebody reads both. Both sections now name the file that is the authority — `packages/shared/src/events.ts` and `notification-catalogue.ts` — so the next reader knows which one to believe. |
| 58 | `trip.delayed` was in §12.2 and in nothing else. | Removed, and replaced by `trip.overdue`'s row with both audiences on it. Nothing in the system measures *"significantly delayed"* separately from FR-TRP-090's detection; a second detector raising a second event about the same minute would be two answers to one question, and the first Admin to see them disagree would stop trusting both. Phase 6 decision 4 made this call and only the code recorded it. |
| 59 | FR-RTE-150 had been `Implemented` since Phase 5 on the grounds that *"no test may launch Chromium"*. | True, and the wrong thing to have been waiting for. The requirement lists four things the sheet must **contain** — stops, times, students and guardian contact numbers — and every one of them is in the HTML this package produces. Puppeteer turns that HTML into pages and has no opinion about which children are on it. So the contents are asserted and the byte-level conversion stays out of the suite, where SDD §19.2's reasoning put the Maps provider. The cases are shaped by the document being a **safety** one rather than a report: an absent child is not on it, a cancelled stop is not on it, a missing telephone number says so rather than rendering blank, and a name containing markup is escaped — that string is tenant data and the same template feeds an on-screen preview. |

## The V1 inventory, closed

Re-run against the SRS after the five steps above.

| | Count |
|---|---|
| V1, `Verified` — implemented **and** covered by a passing test | **172** |
| V1, discharged at provisioning rather than in code — FR-KVK-110, NFR-AVA-060 | 2 |
| V1, `Implemented` — a stated gap | **0** |
| V1, **not implemented** | **0** |
| | **174** |
| V2 found in shipped code | **0** |

Of the SRS's 174 V1 requirements, every one is implemented and covered by a passing test
except **FR-KVK-110** and **NFR-AVA-060** — obligations on a *deployment* rather than on the
software, recorded above under *What remains* with the reason no assertion here can
discharge them. The nine V2 identifiers still appear only in comments explaining why the
feature is absent, which is CLAUDE.md rule 2 exactly.

### Verification

All five suites run against a live database and Redis on 2026-08-17:

| Command | Result |
|---|---|
| `pnpm lint` | clean across all eight workspaces |
| `pnpm typecheck` | clean |
| `pnpm test:unit` | **1 188** passed (65 files) — 1 049 in 52 files at the close of Phase 10 |
| `pnpm test:integration` | **891** passed, 2 skipped — the opt-in route-generation benchmark; 864 at the close of Phase 10 |
| `pnpm test:tenant-isolation` | 20 passed, over the discovered table set |
| `pnpm test:trip-invariants` | 100 passed, unchanged — none of this work adds a trip edge |

One migration landed: `20260817000200_attendance_retention`.

| Module | Phase | Rows added |
|---|---|---|
| RPT, FIN (the PDF pipeline), CMP (the dashboard alert) | 10 | step 1 — 4 rows, 6 decisions |
| SYS, FLG | 10 | step 2 — 8 rows, 13 decisions, 2 defects |
| SYS (console), FLG (UI) | 10 | step 3 — 11 rows, 8 decisions, 1 defect |
| OFF, KVK | 10 | step 4 — 3 rows closed by the audit |
| KVK | — | closing step 1 — 1 row, 6 decisions |
| AUTH, SYS, ABS, FIN, NOT | — | closing step 2 — 8 rows, 8 decisions |
| CMP, SYS (console) | — | closing step 3 — 4 rows, 5 decisions |
| TRP, TRK, FIN, AUTH, NOT (mobile) | — | closing step 4 — 8 rows, 10 decisions, 1 flake |
| TRP (documentation), RTE | — | closing step 5 — 2 rows, 3 decisions |

---

# V2 Phase 11 — Frictionless onboarding and identity

*Claimed: FR-AUTH-160 … FR-AUTH-210, and the extension of FR-AUTH-060 from an invitation
link to an invitation state. The six new rows are in the AUTH table above; this section
records what was decided while building them.*

## The requirement rows

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case | Status |
|---|---|---|---|---|
| FR-AUTH-060 | §7.4, extended | `registration.service.ts#invite` — now a shadow account, `PENDING_APPROVAL` | `registration.integration.spec.ts` — "creates a shadow account from a phone number alone" | Verified (amended) |
| FR-AUTH-080 | §7 *Two authentication domains* | `auth.service.ts#login` refuses a null `password_hash` | `registration.integration.spec.ts` — "refuses to sign in to a shadow account with any password" | Verified (amended) |

## Decisions recorded during Phase 11

1. **The SRS/SDD conflict on SMS was resolved by splitting the interface, not the
   requirement.** SRS §6.2 put the SMS gateway in Phase 12; SDD §7.4 and §7.5 need a
   carrier in Phase 11 for the invitation link and the handshake code, and the phase's
   exit criterion is a guardian typing six digits they were sent. The resolution:
   FR-NOT-070 is a *fallback channel inside the notification pipeline* — defined by a push
   that went unacknowledged, sharing that pipeline's dedupe key, bounded by a per-Tenant
   cost limit — and none of those ideas applies to a one-time code. Phase 11 supplies
   `SmsProviderPort` (transactional, provider-agnostic, `SMS_PROVIDER=none` by default);
   Phase 12 supplies FR-NOT-070 unchanged. SRS §6.2 now carries two rows and the argument.

2. **`password_hash` is nullable, and NULL means *no credential shall ever authenticate
   this row*.** V1's placeholder — a random hash nobody knows — said the opposite to
   every reader of the row, and its only escape hatch was FR-AUTH-090's reset, which is
   not a social-only user's path. `AuthService.login` refuses NULL explicitly *before* any
   comparison, burning the dummy hash first so timing does not reveal which numbers hold
   shadow accounts.

3. **`MembershipService.assignableRoleIn` splits *assignable* from *accessible*.**
   FR-AUTH-180 requires a shadow account to be assignable immediately while holding no
   access until acceptance — two clauses, and reusing `roleIn` for both made the phase's
   own exit criterion unreachable: an Admin who invited a guardian could not link that
   guardian to a child. Widening `roleIn` would have been far worse, because it feeds
   `AuthGuard` and the WebSocket handshake, so a pending invitation would have become a
   live session.

4. **`@HandshakeOnly()` is a third answer to *who may call this*.** The handshake has a
   genuine third kind of caller: not anonymous, since `AuthGuard` knows which `users` row
   they are, and not authenticated, since they hold no membership and no tenant. Modelling
   it as `@Public()` would have put credential handling below the controller layer and
   recorded three restricted routes as open. `authorisation-matrix.integration.spec.ts`
   now enumerates the set that carries it and fails if it grows.

5. **The handshake always ends in a session, even with every invitation unanswered.**
   FR-AUTH-030's existing rule: the token carries no tenant, so RLS returns nothing.
   Withholding tokens until acceptance would have made accepting an invitation something
   only the ten-minute handshake token could authorise, so a user who read it carefully
   would be locked out of answering it. Found by writing the mobile flow.

6. **The merge accepts a holder whose number is already verified.** An earlier revision
   refused one, reasoning that it protected a real account from a stranger. It did not:
   reaching that line requires having redeemed a code sent to that handset, which is the
   whole of what controlling a number means. What the refusal actually did was make
   SDD §7.5's own *"one user, many providers"* journey impossible. Found by the Tier 1
   suite; the residual recycled-number risk is documented where the decision is made.

7. **The invitation routes are not consent-exempt; the two handshake steps are.** The
   exemption for the handshake rests on the caller holding no session at all. By the time
   an invitation can be answered they hold one, and joining a company is exactly the
   *"further use"* FR-KVK-020 gates — which is also the order that makes legal sense.
   `consent.integration.spec.ts`'s enumerated exempt set records both halves.

8. **`PendingRegistration` deliberately gains no `isShadow`.** The console's only use for
   it is the *Numarayı düzelt* affordance, which the server gates on `phoneVerified`. A
   boolean that could disagree with the check it predicts is worse than none: the Admin
   would be shown a button the server refuses.

9. **`OTP_DELIVERY_DRIVER` removed.** Declared in V1, read by nothing, and `SMS_PROVIDER`
   now answers the same question. Two knobs for one decision, and the unread one is the
   one that drifts.

10. **`TokenBucketService` became `RateLimitModule`.** FR-AUTH-200's *three per role per
    day* is a bound on an operation rather than on a route, so `InvitationService`
    consumes a bucket directly. That made `identity` depend on something only the
    `@Global` `GuardsModule` provided — invisible in the API graph, fatal in the worker's,
    which imports no guards. `finance-wiring.integration.spec.ts` caught it, which is
    exactly what that suite exists for.

11. **Google sign-in moved to the native SDK, and step 3's nonce was corrected rather
    than engineered around.** `expo-auth-session` is gone from the mobile app; Google is
    now `@react-native-google-signin/google-signin`. This was forced, not chosen:
    Google's *OAuth 2.0 policy for keeping apps secure* refuses a custom-scheme redirect
    from a mobile client, so the browser flow returned `Error 400: invalid_request` with
    correct client ids, package name and SHA-1 — a policy rejection with no configuration
    to fix. The native SDK has no `redirect_uri` at all, so the closed surface is never
    touched, and SDD §7.5 step 2 already took an ID token rather than an authorization
    code, so the server contract did not move.

    That SDK accepts no caller-supplied nonce on Android, which put the client at odds
    with SDD §7.5 step 3's *"signature, issuer, audience and nonce"*. The alternative was
    `react-native-nitro-google-signin`, which does offer `configure({ nonce })`. It was
    rejected on three counts: SDD §2.3 pins the stack and Nitro Modules is not in it;
    CLAUDE.md P6 asks for boring patterns and a Nitro-based native module on Expo SDK 54
    is the opposite; and the win is narrower than it looks, because the server's nonce
    comparison is already conditional and already live for Apple — the check is not dead
    code, it simply does not apply to one provider.

    So the document was corrected to say what the code does. §7.5 now records that the
    comparison is conditional and enumerates what actually bounds replay for a Google
    token — `aud` restricted to this application, single use, a one-hour expiry, TLS —
    together with the residual risk that remains and the fact that `socialLoginSchema`'s
    `nonce` field and the server's comparison stay in place, so adopting a nonce later is
    a client-side change alone. **No server code changed.**

    Two documentation defects surfaced while verifying the audience. `.env.example`
    claimed the Android build presents the Android client id as `aud`; it does not — the
    native SDK is configured with the *web* client id and mints `aud` = web client,
    `azp` = Android client, so an Android client id in `GOOGLE_OAUTH_CLIENT_IDS` fails
    every verification with `SOCIAL_PROVIDER_UNAVAILABLE` and no indication of why. And
    the adapter's own comment attributed the missing nonce to *"Google's web flow"*,
    which is no longer the flow in use. Both were corrected; the verification logic was
    not.

12. **`SOCIAL_PROVIDER_MODE=live` with no audience now refuses to boot, in every
    environment.** The first real Google token this phase produced was answered with
    `503 SOCIAL_PROVIDER_UNAVAILABLE`, and the stack named
    `FakeIdentityProviderAdapter.verify`: the development `.env` had inherited the
    schema's `fake` default, so the API was verifying nothing and rejecting a validly
    signed token because it was not one the suite had minted. The mode is a development
    configuration matter and was set to `live` there — `.env` is not in source control,
    and `vitest.integration.config.ts` keeps its own `fake` for the reason recorded
    below.

    The guard around it did change. `GOOGLE_OAUTH_CLIENT_IDS` was required only when
    `NODE_ENV=production`, which left a second silent failure one step behind the first:
    `live` with a blank audience booted happily, and then `JwksIdentityProviderAdapter`
    refused every token — correctly, since check 3 cannot be skipped — with the one code
    that says *the provider is unreachable*. An operator reading that message is told
    Google is down when a line in their own `.env` is empty. The requirement is now
    checked in every environment, on the same reasoning `SMS_PROVIDER=http` already used:
    the symptom is silent, so the boot is the only cheap place to name the cause. The
    message names the variable and says *Web* client id, because the Android one is the
    mistake that produces an identical `SOCIAL_PROVIDER_UNAVAILABLE`. **No verification
    logic was loosened; the adapter is unchanged.**

## Test-infrastructure changes — Phase 11

| Change | Why |
|---|---|
| `SMS_PROVIDER=fake` and `SOCIAL_PROVIDER_MODE=fake` set in `vitest.integration.config.ts` | For the same reason `RATE_LIMIT_ENABLED=false` is set there: `AppConfigModule` evaluates `ConfigModule.forRoot(...)` at import time, before any hook. `SMS_PROVIDER` defaults to `none`, which would leave the suite unable to read a code back — and the handshake's assertions are about what was *sent*. |
| `FakeSmsProvider` exported from `IdentityModule` | So a suite can assert that an invitation carried a link to *this* tenant, that a resend produced exactly one further message, and that the fourth resend in a day sent nothing. Reading codes out of the database would have tested the challenge row rather than the delivery. |
| `FakeIdentityProviderAdapter` | The Tier 1 subject is the match, and testing it adversarially means minting tokens for subjects of the suite's choosing — two providers claiming one person, a subject already bound to somebody else. No real provider issues those on request. |
| `handshake-match.integration.spec.ts` | **Tier 1**, 18 cases, written from the attacker's side as `tenant-isolation.spec.ts` is. |
| `invitations.integration.spec.ts` | 12 cases over the FR-AUTH-180/190/200 lifecycle. |
| `ApprovalsPage.spec.tsx` | 6 cases; the console must not offer a button the server refuses. |

## Verification

All five suites run against a live database, Redis and MinIO on 2026-08-25:

| Command | Result |
|---|---|
| `pnpm lint` | clean across all eight workspaces |
| `pnpm typecheck` | clean |
| `pnpm test:unit` | **1 229** passed (68 files) — 1 193 before this phase |
| `pnpm test:integration` | **924** passed, 2 skipped (54 files) — 891 before |
| `pnpm test:tenant-isolation` | 20 passed, over the discovered table set |
| `pnpm test:trip-invariants` | 100 passed, unchanged — this phase adds no trip edge |

One migration landed: `20260825000000_social_identity_and_invites`.

`social_identities` carries no `tenant_id`, so it is outside the isolation suite's remit
by construction rather than by an entry in `platform-tables.registry.ts` — the same
footing `users` and `refresh_tokens` have stood on since Phase 1. The registry is for
tables that *do* carry the column and nonetheless have no policy, and nothing this phase
added is one; the reasoning is in the migration.

## Still `[V2]`, still not implemented

| Requirement | Where it goes |
|---|---|
| FR-AUTH-150 | Phase 12. `user_mfa_factors` and `user_recovery_codes` are declared in SDD §5.2 and deliberately **not** created — `baseline-migration.integration.spec.ts` now names both, so creating one early fails a test. |
| FR-NOT-070 | Phase 12, unchanged. The transactional SMS transport this phase added is a different obligation; SRS §6.2 records the boundary. |
| FR-ATT-130, FR-KVK-120 | Unscheduled, per the V2 section of `docs/PROJECT_PLAN.md`. |

