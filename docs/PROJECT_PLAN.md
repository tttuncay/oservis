# Project Plan — ServisApp

**Status:** draft, authored during Phase 0. Amended before Phase 3 and again at the opening of V2 — see *Amendments*.
**Derived from:** SRS Appendix B (Suggested Implementation Sequence), SDD §3.1 (Module Map), SDD §19.1 (Testing Priority Tiers).

## Amendments

| When | Change | Why |
|---|---|---|
| At the opening of V2 | **V2 defined as Phases 11 and 12 under the theme *Frictionless Go-Live and Operational Continuity*, and five V1-era `[V2]` requirements re-marked `[V3]`.** See the V2 section. | V1 closed with a system that runs a company but is painful to start and brittle when a device is unreachable. Onboarding friction and delivery failure are what a pilot customer meets on day one; online payment, invoicing, payroll, richer optimisation and campaigns are not. Naming the deferral in the plan and in the SRS keeps the boundary a decision rather than an interpretation. |
| During Phase 8 | **OI-03 resolved, and KVK consent plus the mobile screens folded into Phase 8.** See the Phase 8 section for the three items and the argument for each. | OI-03 was due *"before the first live trip"* and its resolution is partly a notification, which is Phase 8's module. The other two were already named as outstanding in `docs/traceability.md` rather than scheduled anywhere. |
| Before Phase 3 | **Admin web inserted as Phase 3**; Finance and everything after it renumbered one higher. Plan numbering now runs one ahead of SRS Appendix B numbering, and each section cites its Appendix B origin explicitly. | The admin web was implicit in the original plan ("phases 2 and 3 together constitute the administrative panel") but was never a phase, so it had no scope boundary and no exit criterion — the two things this document exists to supply. Building it before Finance puts a demonstrable product in front of a customer sooner and settles the screen patterns Finance will copy. |
| During Phase 1 | Announcements (FR-SYS-080) moved from Phase 1 to the sysadmin console. | Recorded in `docs/traceability.md`, Phase 1 decision 7. |
| Before Phase 5 | **Absence (ABS, FR-ABS-010…080) moved from Phase 6 to Phase 5.** | FR-RTE-020 defines generation as including *"only Students without an active absence declaration"* — the routing phase cannot be completed without it. A generation pipeline that ignored absences would not be retrofitted later; it would be rewritten. Phase 6 keeps trip execution, attendance and the sweep check. |
| During Phase 5 | FR-RTE-120 (driver ad-hoc stop) and FR-RTE-130 (driver skips a stop) **stay in Phase 6**, although they fall inside the FR-RTE-* range. | Both require an active trip and the Driver application, which Phase 5 explicitly excludes; SDD §6.2 lists them under *Trip execution*. The re-optimisation engine they need is built in Phase 5, so Phase 6 adds only the trigger. |

This document is the authority on **phase order and scope boundaries**. When work is proposed that
falls outside the current phase, it stops and is raised rather than absorbed.

## Rules

1. A phase is not complete until every requirement it claims has a passing test and a row in
   `docs/traceability.md`. SRS Appendix A: *no requirement may be closed without an associated
   passing test case.*
2. Nothing beyond the release currently in progress is implemented. During V1 this read *nothing
   marked `[V2]`*; from the opening of V2 it reads **nothing marked `[V3]`**, and a `[V2]`
   requirement is implemented only in the V2 phase that claims it. The schema must accommodate
   the deferred work; the code must not contain it.
3. Every new tenant-scoped table gets its RLS policy in the same migration that creates it.
4. Where the SRS and SDD disagree, work stops and the conflict is raised. It is never resolved
   silently.

---

## Phase 0 — Repository scaffold and local environment

**Scope:** project skeleton only. No domain logic, no business tables, no UI screens.

| Deliverable | Reference |
|---|---|
| pnpm workspace monorepo | SDD §2.4 |
| NestJS API, TS strict, Zod-validated config with boot-time fail-fast | SDD §2.3 |
| Structured error body `{ code, message, details?, requestId }` | FR-INT-040, SDD §6.1 |
| Request-id middleware, Pino logs with `requestId`, `tenantId`, `userId`, `route`, `duration` | NFR-MNT-020, SDD §18.3 |
| `/health` returning per-dependency status | SDD §18.3 |
| Prisma baseline migration: PostGIS extension, non-BYPASSRLS application role | SDD §4.2, §5.1, NFR-MNT-030 |
| Redis + BullMQ wiring, separate worker entrypoint, one no-op scheduled job | SDD §2.2, §13 |
| React web shell: Vite, Tailwind, shadcn/ui, TanStack Query, router, empty layouts | SDD §15.1 |
| Expo SDK 54 placeholder app | SDD §2.3 |
| `packages/shared` (DomainEvent union, error codes), `packages/i18n` (tr default) | SDD §3.3, §2.4 |
| docker-compose: Postgres+PostGIS, Redis, MinIO | SDD §18.1 |
| CI: install, lint, typecheck, test:unit, test:integration, test:tenant-isolation, audit | SDD §18.2 |

**Explicitly deferred:** authentication, guards, tenant middleware, domain tables, Socket.IO gateway,
Sentry, rate limiting, OpenAPI generation, mobile navigation.

**Exit criterion:** `docker compose up -d && pnpm install && pnpm db:migrate && pnpm dev` yields an
API whose `/health` reports three dependencies independently; all CI steps green.

---

## Phase 1 — Tenancy, identity, audit, feature flags

*SRS Appendix B phase 1. Modules `platform`, `identity`, `compliance` (audit only).*

Everything downstream depends on this, and retrofitting tenancy or audit is not feasible.

**Scope:** tenants, subscriptions, plans, feature flags, impersonation (SYS, FLG) ·
users, credentials, tokens, roles, registration approval, tenant context (AUTH, TEN) · audit log
writing (KVK, write path only).

Announcements (FR-SYS-080) moved to Phase 10 with the rest of the sysadmin console: they are a
display surface on top of the tenant model rather than something later phases depend on.

**The defining work of this phase is SDD §4.2 in full:**
- Layer 1 — RLS `ENABLE` + `FORCE` on every tenant-scoped table, `SET LOCAL app.tenant_id` applied by
  Prisma middleware wrapping every operation in a transaction.
- Layer 2 — a repository base class injecting `tenant_id` into every query and insert.
- Layer 3 — `tenant-isolation.spec.ts` generated from the schema, failing when a table is added
  without a policy. The Phase 0 stub becomes the real test here.

Also lands: Argon2id password hashing (SDD §16), the role + relationship guards, the
`RequestContext` resolution middleware that fills the `tenantId` and `userId` fields Phase 0 wired
as `null`, and Redis token-bucket rate limiting (NFR-SEC-050).

**Tier 1 testing:** tenant isolation, exhaustive and adversarial.

**Exit criterion:** a query executed under tenant A's context returns zero rows belonging to
tenant B, for every tenant-scoped table, with the application connected as `servisapp_app`.

---

## Phase 2 — Company configuration

*SRS Appendix B phase 2. Module `company` (CMP).*

Schools, vehicles, staff, students, guardians, addresses, assignments, bulk import. Geocoding with
the mandatory admin verification step (FR-CMP-100 — TI-04 makes this non-optional). Vehicle document
expiry tracking (FR-CMP-030). The map provider goes behind its interface here, with the
deterministic fake used by every test (SDD §19.2).

At the end of this phase the Admin can enter real data.

---

## Phase 3 — Admin web: shell and company configuration screens

*No SRS Appendix B counterpart. Scope `apps/web`, `packages/contracts`, `packages/i18n`.*

**From here on, plan phase numbers run one ahead of SRS Appendix B phase numbers.** Each section
below still cites the Appendix B phase it derives from; the two are deliberately no longer equal.

Phases 1 and 2 gave the Admin an API they can only reach with a REST client. This phase is the
first thing a customer can be shown, and it is inserted ahead of Finance because a finance module
nobody can operate is worth less than a company panel they can — and because every screen built
here is the pattern the finance screens will copy.

**Scope:** login, refresh, role-based routing, tenant switcher · the component kit (DataTable,
FormKit, MapPicker, ConfirmDialog, EmptyState, ErrorState) · list and create/edit screens for every
Phase 2 entity · bulk import with row-level error reporting (FR-CMP-110) · the read-only provider
(FR-SYS-060) and impersonation banner (FR-SYS-100) · Turkish throughout, every string from
`packages/i18n` (NFR-USA-050/060/070).

**Requirements claimed:** the FR-CMP-* screen surfaces, FR-AUTH-040/060 (approvals and invitations),
FR-SYS-060, FR-SYS-100, NFR-USA-050/060/070, NFR-SEC-090.

**API-shape work this phase authorises in `apps/api`** — no new business logic, each with its own
integration test:
- the `Page<T>` envelope (`{ data, nextCursor }`, SDD §6.1) on the list endpoints, which today
  return a bare array; the type is already declared in `packages/shared` and used nowhere
- a `sort` parameter per resource, validated against a per-resource allow-list of columns
- `search` and `status` filters on schools and vehicles, whose list endpoints today accept
  pagination only
- `WEB_REFRESH_TOKEN_TTL_HOURS` (default 12), branched on the `surface` discriminator `loginSchema`
  already carries, so NFR-SEC-090's twelve-hour administrative session is enforced by the server
  rather than by a timer in the browser (SDD §1.2 P2)
- three endpoints without which a screen has no data source: `GET /guardians`,
  `GET`/`PATCH /me/tenant` (an Admin reading and editing their own tenant — `/platform/tenants/:id`
  is Sysadmin-only), and an `impersonation` object on `MeResponse` so the FR-SYS-100 banner can
  still show remaining time after a page reload

**Out of scope:** finance, trips, live map, sysadmin console. The dashboard is a placeholder until
the aggregate endpoint lands in Phase 9 (SDD §15.3) — it does not issue a dozen parallel requests
in the meantime.

**Tier 1 testing:** none. This phase renders and queues; it decides nothing. Component tests for
DataTable and FormKit, and one end-to-end path: login → create student → add address → confirm
coordinates → assign to route template.

**Exit criterion:** an Admin can complete every Phase 2 workflow with a mouse, in Turkish; setting
the tenant to `READ_ONLY` visibly disables every mutating control and states why.

---

## Phase 4 — Finance

*SRS Appendix B phase 3. Module `finance` (FIN).*

Fee plans, instalment generation, payment recording and application, expenses, financial reports.
This is where the business value the customer pays for lives.

Money is `numeric(12,2)` + `currency char(3)`, arithmetic in integer minor units or Decimal, never
float (SDD §11.1). History is append-only: corrections reverse, never update (SDD §1.2 P5).

**Tier 1 testing:** instalment arithmetic (property test: Σ instalments === net_total exactly for
amounts 1..100000 × counts 1..12), payment application and reversal, overpayment rejection.

Phases 2, 3 and 4 together constitute the administrative panel the business uses first.

---

## Phase 5 — Routing

*SRS Appendix B phase 4. Module `routing` (RTE).*

Route templates, daily generation, optimisation, route sheet export. Operationally usable on paper
before any mobile application exists.

**SDD §8.3 caching is not optional.** An uncached implementation costs more than all hosting
combined (SDD §18.5). The PostGIS fallback optimiser is what tests exercise; no test calls a paid
API.

---

## Phase 6 — Driver and Host applications

*SRS Appendix B phase 5. Modules `trips` (TRP, ATT), `sync` (OFF), `absence` (ABS).*

Trip lifecycle, attendance, sweep check, offline queue. The most safety-critical phase and the one
requiring the most testing.

**Tier 1 testing:** attendance state transitions · sweep enforcement · the boarded-without-dropoff
invariant · offline idempotency (replay the same batch three times → single effect).

Per SDD TI-01, a skeleton iOS build goes to App Store review **early in this phase**, before the
location feature is complete, to surface `Always` permission objections while there is time.

---

## Phase 7 — Tracking and Guardian application

*SRS Appendix B phase 6. Module `tracking` (TRK).*

Position ingestion, live state, ETA, path replay, background location, the guardian visibility
window (SDD §9.3 — room membership computed server-side per subscribe). Socket.IO gateway with the
Redis adapter, and the 15-second polling fallback (FR-INT-020).

---

## Phase 8 — Notifications, KVKK, and the mobile screens

*SRS Appendix B phase 7. Module `notifications` (NOT), the second half of `compliance` (KVK),
and the Driver, Host and Parent screens carried from Phase 6.*

Depends on the events emitted by phases 6 and 7. Templating, push despatch, deduplication, message
history. FCM/APNs is optional infrastructure with a defined degraded path (SDD §1.2 P6).

**Amended during Phase 8.** Three items joined the phase, and none of them is new scope so much
as scope that had nowhere else to go:

- **SRS OI-03**, carried as *blocking go-live* since Phase 6 and due *"before the first live
  trip"*. Its resolution is an attendance state, an invariant and a **notification** — the last
  of which is this phase's module, so resolving it anywhere else would have meant building the
  escalation twice.
- **KVK consent (FR-KVK-010/020) and subject rights (FR-KVK-060/070)**, which the
  *Cross-cutting* table below schedules for *"Phase 7 — needs the data they act on to exist"*.
  The data exists from Phase 7; the work landed here.
- **The Driver, Host and Parent screens**, Phase 6's mobile half. Phase 7 built the layers they
  sit on (SDD §14.2's `db/`, `sync/`, `location/`) and named the screens as outstanding.

---

## Phase 9 — CRM, dashboard, remaining reports

*SRS Appendix B phase 8. Modules `crm` (MKT), `reporting` (RPT).*

Leads and the public quote page, the aggregate dashboard endpoint (SDD §15.3 — one cached request,
not a dozen parallel ones), operational reports and exports. The Phase 3 dashboard placeholder is
replaced here.

---

## Phase 10 — Sysadmin console and subscription lifecycle

*SRS Appendix B phase 9.* **Complete.** See `docs/traceability.md`, Phase 10.

The phase opened by discharging the two items Phase 9 carried — every PDF export became a
`report_jobs` job, and FR-RPT-010's `VEHICLE_DOCUMENT` alert reached the dashboard — and
closed with an audit of the whole V1 inventory: 166 of 174 `Verified`, six `Implemented`
with the reason recorded where each was written, one verified at provisioning
(FR-KVK-110's data residency, which no test here can prove), and **one not implemented**:
FR-KVK-040's attendance retention job, which slipped through Phase 8 because it had no row
to be missing from. It is the project's open list now, not a phase's — see
*Outstanding at the close of Phase 10*.

Required before onboarding a second customer. The Sysadmin's own console — tenant list, plans,
flags, health, audit. The impersonation *banner* is not here: it is a property of the Admin shell a
Sysadmin lands in, so it ships with Phase 3 (FR-SYS-100 — the server side landed in Phase 1, the
console that starts a session lands here). Tenant status advancement, subscription plans and
charge computation (FR-SYS-020, FR-SYS-040), announcements (FR-SYS-080, moved here from Phase 1),
tenant retention on suspension (FR-SYS-070), and the health view (FR-SYS-090) that surfaces the
metrics Phase 0's `/health` began.

---

# V2 — Frictionless Go-Live and Operational Continuity

V1 proved the system can run a transport company. V2 addresses the two things that decide whether
it ever gets to: the friction of the first day, and what happens when the day goes wrong.

The V2 theme is deliberately narrow. Everything that adds revenue surface rather than removing
operational friction — online payments, e-invoicing, payroll, richer optimisation, campaigns — is
pushed to V3 and listed below, so that the boundary is a decision on the record rather than a
matter of interpretation.

**The V1 rules above continue to apply**, with Rule 2 now read as: nothing marked `[V3]` is
implemented, and a `[V2]` requirement is implemented only in the V2 phase that claims it.

---

## Phase 11 — Frictionless onboarding and identity

*No SRS Appendix B counterpart. Modules `identity` (AUTH), `notifications` (NOT), `apps/mobile`,
`apps/web`.*

FR-AUTH-010's self-registration asks a guardian to find their company in a list, invent a password,
and then wait for an Admin to notice them. Every step is a place the onboarding stops. This phase
inverts the flow: the Admin, who already holds the phone number, starts it; the guardian only
confirms.

**Scope:**

- **Smart Invites and shadow accounts.** The Admin creates a Guardian, Driver or Host from a phone
  number alone. A `users` row and a `PENDING_APPROVAL` `user_tenant_roles` row exist from that
  moment — the shadow account — so the Admin can assign students, routes and fees before the
  person has ever opened the application. An SMS deep link is dispatched.
- **B2C social login.** Guardians, Drivers and Hosts authenticate with Google or Apple SSO on
  mobile. No password is created and none is asked for.
- **The phone handshake.** On first social login the user supplies and verifies their phone number
  by OTP. The verified number is what matches them to the shadow account waiting for them; the
  pending invitation is then presented for acceptance.
- **Rejection and recovery.** A user may decline an invitation. The role goes to `REJECTED`, the
  Admin sees it in the pending list with that state, and *Resend Invite* returns it to
  `PENDING_APPROVAL` and fires a fresh notification. A mistyped digit costs one click, not a
  support call.

- **A transactional SMS transport.** The invitation deep link and the handshake code both
  need a carrier, and V1 has none — `NoopOtpDeliveryAdapter` logs the code in development
  and deliberately drops it in production. Phase 11 binds a provider-agnostic
  `SmsProviderPort` behind the existing `OtpDeliveryPort`, disabled by default and
  configured per installation. This is **not** FR-NOT-070, which stays whole in Phase 12;
  the boundary and the argument for it are recorded in SRS §6.2.

**Requirements claimed:** FR-AUTH-160 … FR-AUTH-210, and the extension of FR-AUTH-060 from an
invitation *link* to an invitation *state*.

**Tier 1 testing:** the handshake match. A verified phone number shall match exactly the pending
roles bound to that number and nothing else — an adversarial test in the same spirit as tenant
isolation, because the match is the only thing standing between a stranger and a shadow account.
Also: idempotent re-verification, `REJECTED → PENDING_APPROVAL` transitions, and social identity
collision (two providers, one phone number, one `users` row).

**Explicitly out of scope:** social login for Admin and Sysadmin (FR-AUTH-210) — see SDD §7,
*Two authentication domains*, where the prohibition is argued as a design decision and not
recorded as an omission.

**Exit criterion:** an Admin who knows nothing but a guardian's phone number can, without that
guardian being present, produce a fully configured account; and that guardian can reach their
child's live map having typed nothing but a six-digit code.

---

## Phase 12 — Operational continuity and security

*No SRS Appendix B counterpart. Modules `identity` (AUTH), `notifications` (NOT).*

Phase 11 assumes the happy path: a smartphone, a data connection, a push token that works. This
phase covers the two cases where it does not, one for each side of the product.

**Scope:**

- **MFA for B2B web roles (FR-AUTH-150).** TOTP as the primary second factor for Admin and
  Sysadmin, with recovery codes, per-tenant enforcement policy, and mandatory enrolment for
  Sysadmin. An Admin account holds a whole company's student roster and payment history; a
  password alone is not a proportionate control over it.
- **SMS fallback for critical notifications (FR-NOT-070).** The SMS channel defined and disabled
  since V1 is enabled and placed behind the notification pipeline's delivery-failure path: where a
  push is not acknowledged, or the recipient holds no registered device, a defined subset of
  notifications is re-sent by SMS. The subset is the **non-disableable** rows of SDD §12.2 — a
  catalogue decision, not a per-message one — and per-tenant cost limits bound it.

**Requirements claimed:** FR-AUTH-150, FR-NOT-070.

**Tier 1 testing:** MFA cannot be bypassed by refresh-token replay or by an unfinished enrolment;
SMS fallback fires exactly once per notification (the dedupe key is shared with the push path, so a
recovered push does not produce a second message).

**Exit criterion:** an Admin session cannot be established with a stolen password alone, and a
`student.undelivered` notification reaches a guardian whose phone has been switched off since
morning — once, by SMS, and not a second time when the phone comes back and the push lands.

---

## V3 — deferred, on the record

The following are **not V2**. They are marked `[V3]` in the SRS and carry the same prohibition
`[V2]` carried during V1: the schema accommodates them, the code does not contain them.

| Requirement | Subject | Why it waits |
|---|---|---|
| FR-FIN-160 | Online card payment through a PSP, with instalments | Revenue convenience, not an operational blocker. Manual recording works today; SRS OI-01 already settled that. |
| FR-FIN-170 | e-Arşiv / e-Fatura electronic invoicing | A statutory integration with a long compliance tail. Nothing in daily field operation depends on it. |
| FR-FIN-220 | Structured payroll and payslips | Salaries are recorded as ordinary expenses and the company keeps paying them the way it already does. |
| FR-RTE-160 | Per-student time windows and multi-vehicle load balancing | The V1 optimiser plus the manual override produces routes a dispatcher accepts. This is a better answer to a question already answered. |
| FR-MKT-080 | Outbound campaign messaging and referral tracking | Marketing to guardians the company already has. It grows the business; it does not keep a vehicle running. |

The V2 theme is *field operations first*. A feature that earns more money is worth less, this
cycle, than a feature that stops the first day from failing.

Two further requirements stay marked `[V2]` in the SRS and are claimed by **neither** Phase 11 nor
Phase 12 — FR-ATT-130 (photographic sweep evidence) and FR-KVK-120 (breach reporting). They are
unscheduled, not deferred to V3, and either may be picked up as a third V2 phase if a pilot
customer asks for it. Until one does, Rule 2 applies to them unchanged.

---

## Cross-cutting, scheduled deliberately

| Item | Lands in | Why not earlier |
|---|---|---|
| Staging environment | When the first pilot customer goes live | SDD §18.1 — real student data makes testing in production unacceptable |
| Sentry | Phase 1 | Needs `tenantId`/`userId` to be meaningful |
| Retention and subject-rights jobs (KVK) | Phase 7 → **landed in Phase 8** | Needs the data they act on to exist. FR-KVK-030's location retention did land in Phase 7 with `location_pings`; consent and subject rights landed in Phase 8, with the notification history whose ninety-day rule they sit beside (SDD §17.2). |
| Quarterly restore test | First production deploy | NFR-AVA-060 |

## Open issues carried from the SRS

SRS §8 lists ten open issues, each with a default that applies unless overridden. Three fall due
before their phase can complete:

| ID | Decide before | Status |
|---|---|---|
| OI-01 (manual payment recording only in V1) | Phase 4 | Closed in Phase 4 |
| OI-06 (per-vehicle revenue apportionment) | Phase 4 reporting | Closed in Phase 4 |
| OI-02 (route composition), OI-10 (absence after boarding) | Phase 5 / Phase 6 | Closed in Phase 5 |
| OI-03 (no one present at drop-off) | **Before the first live trip — a safety and liability matter** | **Closed in Phase 8.** Resolved as FR-ATT-140 and FR-ATT-150: `GUARDIAN_NO_SHOW` is an intermediate state that keeps the child accounted for as aboard, and `RETURNED_TO_SCHOOL` is a second terminal one. See `docs/traceability.md`, Phase 8 decision 1. |
