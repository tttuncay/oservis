# Software Design Document
## School Transport Management Platform (**ServisApp**)

| Field | Value |
|---|---|
| Document version | 1.1 — §7 rewritten at the opening of V2 (Phases 11 and 12) |
| Date | 2026-08-05, amended 2026-08-24 |
| Status | For review |
| Governing document | SRS v1.0 — School Transport Management Platform |
| Audience | Implementers, including AI-assisted development sessions |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Overview](#2-architectural-overview)
3. [Backend Structure](#3-backend-structure)
4. [Multi-Tenancy Design](#4-multi-tenancy-design)
5. [Data Design](#5-data-design)
6. [API Design](#6-api-design)
7. [Authentication and Authorisation](#7-authentication-and-authorisation)
8. [Route Generation and Optimisation](#8-route-generation-and-optimisation)
9. [Trip Execution and Real-Time Tracking](#9-trip-execution-and-real-time-tracking)
10. [Offline Synchronisation](#10-offline-synchronisation)
11. [Financial Calculation Design](#11-financial-calculation-design)
12. [Notification Design](#12-notification-design)
13. [Background Jobs](#13-background-jobs)
14. [Mobile Application Design](#14-mobile-application-design)
15. [Web Application Design](#15-web-application-design)
16. [Security Design](#16-security-design)
17. [Compliance and Retention Implementation](#17-compliance-and-retention-implementation)
18. [Infrastructure and Operations](#18-infrastructure-and-operations)
19. [Testing Strategy](#19-testing-strategy)
20. [Traceability](#20-traceability)
21. [Open Technical Issues](#21-open-technical-issues)

---

# 1. Introduction

## 1.1 Purpose

This document specifies **how** the requirements in the SRS are to be implemented. Where the SRS states what the system does, this document states the structures, algorithms, schemas and interfaces that realise it.

Requirements are referenced by their SRS identifier throughout. Any design element here that does not trace to an SRS requirement is a defect in one document or the other.

## 1.2 Design Principles

These govern every decision below and should be applied when resolving anything this document does not cover.

| # | Principle | Consequence |
|---|---|---|
| P1 | **Correctness of safety and money over everything else** | Attendance, sweep checks and financial records are never lost, never silently overwritten, always attributable |
| P2 | **Tenant isolation is structural, not procedural** | Enforced by the database, not by remembering to add a `WHERE` clause |
| P3 | **The server is the only authority** | Clients render and queue; they never decide permissions or compute money |
| P4 | **Boring technology, conventional patterns** | A solo/pair team with AI assistance cannot afford novel architecture (SRS CON-01) |
| P5 | **History is append-only** | Corrections create new records; nothing operational or financial is edited in place (SRS CON-07) |
| P6 | **External services are optional** | Every external dependency has a defined degraded mode |
| P7 | **Cost is a design constraint** | Particularly for mapping APIs, where naïve implementation costs more than the hosting |

## 1.3 References

- SRS v1.0 — all `FR-*` and `NFR-*` identifiers
- PostgreSQL 16 documentation — Row Level Security
- PostGIS 3.4 documentation
- Google Maps Platform — Routes API, Geocoding API
- Expo SDK documentation — `expo-location`, `expo-task-manager`, EAS Build/Update

---

# 2. Architectural Overview

## 2.1 Style

**Modular monolith** — a single deployable backend application, internally partitioned into modules that correspond one-to-one with the SRS module codes. Modules communicate through explicit service interfaces and an internal event bus, never by reaching into each other's data access layer.

**Rationale.** Microservices would multiply deployment, observability and data-consistency work by the number of services, against a team of two. The module boundaries defined here are strict enough that any module could later be extracted without redesign, but no extraction is planned.

## 2.2 Deployment Topology

```
                        ┌──────────────────────────────┐
                        │        CDN / Static           │
                        │  Admin & Sysadmin web bundle  │
                        │  Public quote-request page    │
                        └──────────────────────────────┘

  ┌──────────────┐                                        ┌──────────────┐
  │  Mobile app  │──── HTTPS REST ───┐   ┌──── HTTPS ─────│   Web app    │
  │  (Expo RN)   │──── WebSocket ────┤   │                │   (React)    │
  └──────────────┘                   ▼   ▼                └──────────────┘
                            ┌────────────────────┐
                            │   API application  │  ← stateless, N replicas
                            │   (NestJS)         │
                            │  ┌──────────────┐  │
                            │  │  HTTP layer  │  │
                            │  │  WS gateway  │  │
                            │  │  Job workers │  │  ← separate replica set
                            │  └──────────────┘  │
                            └─────────┬──────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
    ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐
    │  PostgreSQL 16   │   │      Redis         │   │  Object storage  │
    │  + PostGIS       │   │  cache, queues,    │   │  photos, PDFs,   │
    │  managed, EU/TR  │   │  WS pub/sub        │   │  attachments     │
    └──────────────────┘   └────────────────────┘   └──────────────────┘
                                      │
                            ┌─────────┴──────────┐
                            │  External services │
                            │  Google Maps       │
                            │  FCM / APNs        │
                            │  Sentry            │
                            └────────────────────┘
```

**Job workers run as a separate replica set from the HTTP application**, sharing the codebase but started with a different entrypoint. This prevents a long-running route generation batch from degrading API latency during the morning peak (NFR-PER-020, NFR-PER-030).

## 2.3 Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend runtime | Node.js 22 LTS, TypeScript strict mode | Single language across the whole system; largest training corpus for AI-assisted development |
| Backend framework | NestJS 10 | Enforced module structure, dependency injection, first-class validation and OpenAPI generation. The opinionated structure is an asset when generating code with an assistant |
| ORM / migrations | Prisma | Type-safe client, migration files in source control (SRS NFR-MNT-030). Raw SQL used where PostGIS or RLS requires it |
| Database | PostgreSQL 16 + PostGIS 3.4, managed | Geospatial types and indexes needed for stop merging and proximity; RLS needed for P2 |
| Cache / queue / pub-sub | Redis 7 | BullMQ job queues, Socket.IO adapter, route cache, rate limiting |
| Job queue | BullMQ | Retries, scheduling, dead-letter handling, dashboard |
| Real-time | Socket.IO + Redis adapter | Self-hosted; load is small enough that per-message pricing is unjustifiable |
| Web frontend | React 18 + Vite + TypeScript | — |
| Web UI kit | Tailwind CSS + shadcn/ui | Dense data tables and forms without a designer |
| Web data layer | TanStack Query + Zustand | Server cache and minimal client state |
| Web tables | TanStack Table | Sorting, filtering, virtualisation for large student lists |
| Mobile | Expo SDK 54 (managed) + React Native | Single codebase, EAS Build, EAS Update for OTA (NFR-MNT-080) |
| Mobile local store | SQLite via `expo-sqlite` + Drizzle | Offline queue and trip cache (FR-OFF-010/020) |
| Mobile maps | `react-native-maps` (Google provider) | — |
| Mobile background location | `expo-location` + `expo-task-manager` | Background tracking during active trips only (FR-TRK-020/030) |
| PDF generation | Puppeteer, HTML templates | Receipts and reports; same templates render on screen and to PDF |
| Excel export | ExcelJS | (FR-FIN-280, FR-RPT-070) |
| Error tracking | Sentry | Backend, web and mobile (NFR-MNT-020) |
| CI/CD | GitHub Actions | Test, migrate, deploy |
| Hosting | Managed platform, EU or TR region | Coolify on Hetzner (EU) or Railway. Constraint: FR-KVK-110 |

## 2.4 Repository Layout

A single repository (monorepo) with pnpm workspaces.

```
servisapp/
├── apps/
│   ├── api/                 NestJS backend (HTTP + WS + workers)
│   ├── web/                 React admin & sysadmin console
│   └── mobile/              Expo application (all three mobile roles)
├── packages/
│   ├── shared/              Types, DTOs, validation schemas, enums, constants
│   ├── contracts/           Generated API client + OpenAPI spec
│   └── i18n/                Turkish and English string catalogues
├── docs/
│   ├── SRS.md
│   ├── SDD.md
│   └── PROJECT_PLAN.md
└── .github/workflows/
```

**`packages/shared` is the single source of truth for types.** DTOs, enums and Zod validation schemas are defined once and imported by backend, web and mobile. This eliminates the most common class of AI-assisted development defect: the client and server drifting apart on a field name or enum value.

---

# 3. Backend Structure

## 3.1 Module Map

Each NestJS module corresponds to an SRS module code. Cross-module calls go through the exported service class only.

| Module | SRS code | Responsibilities |
|---|---|---|
| `platform` | SYS, FLG | Tenants, subscriptions, plans, feature flags, announcements, impersonation |
| `identity` | AUTH, TEN | Users, credentials, tokens, roles, registration approval, tenant context |
| `company` | CMP | Schools, vehicles, staff, students, guardians, addresses, assignments, bulk import |
| `routing` | RTE | Route templates, daily generation, optimisation, geocoding, map provider adapter |
| `trips` | TRP, ATT | Trip lifecycle, stops, attendance, sweep checks |
| `tracking` | TRK | Position ingestion, live state, ETA computation, path replay |
| `absence` | ABS | Absence declarations, cut-off enforcement |
| `finance` | FIN | Fee plans, instalments, payments, expenses, financial reports |
| `crm` | MKT | Leads, public quote page |
| `reporting` | RPT | Dashboards, operational reports, exports |
| `notifications` | NOT | Event subscription, templating, push despatch, message history |
| `compliance` | KVK | Consent, audit log, retention jobs, data export/erasure |
| `sync` | OFF | Offline event intake, idempotency, conflict resolution |

## 3.2 Layering

Every module follows the same four-layer structure. This uniformity matters more than elegance: it makes generated code predictable.

```
Controller     HTTP boundary. Validates DTO, extracts tenant context, delegates. No logic.
    │
Service        Business rules, transactions, event emission. The only place logic lives.
    │
Repository     Data access. Prisma or raw SQL. No business rules.
    │
Database
```

**Rules:**

- A controller never touches a repository directly
- A service never touches another module's repository
- A repository never emits events
- Anything with a monetary or safety consequence runs inside an explicit transaction

## 3.3 Internal Event Bus

Modules communicate asynchronously through a typed in-process event emitter, with durable events persisted for the notification module.

```typescript
// packages/shared/events.ts
export type DomainEvent =
  | { type: 'trip.started';             tenantId: string; tripId: string; at: Date }
  | { type: 'trip.finished';            tenantId: string; tripId: string; at: Date }
  | { type: 'trip.cancelled';           tenantId: string; tripId: string; reason: string }
  | { type: 'trip.crewAssigned';        tenantId: string; tripId: string; staffUserIds: readonly string[] }
  | { type: 'trip.overdue';             tenantId: string; tripId: string; expectedFinishAt: Date }
  | { type: 'trip.signalLost';          tenantId: string; tripId: string; vehicleId: string;
                                        silentForSeconds: number; lastSeenAt: Date | null }
  | { type: 'stop.approaching';         tenantId: string; tripId: string; tripStopId: string; etaSeconds: number }
  | { type: 'stop.arrived';             tenantId: string; tripId: string; tripStopId: string; at: Date }
  | { type: 'stop.completed';           tenantId: string; tripId: string; tripStopId: string; at: Date }
  | { type: 'stop.skipped';             tenantId: string; tripId: string; tripStopId: string; reason: string }
  | { type: 'student.boarded';          tenantId: string; studentId: string; tripId: string; at: Date }
  | { type: 'student.noShow';           tenantId: string; studentId: string; tripId: string; at: Date }
  | { type: 'student.droppedOff';       tenantId: string; studentId: string; tripId: string; at: Date }
  | { type: 'student.undelivered';      tenantId: string; studentId: string; tripId: string;
                                        tripStopId: string; at: Date }
  | { type: 'student.returnedToSchool'; tenantId: string; studentId: string; tripId: string;
                                        tripStopId: string; at: Date }
  | { type: 'sweep.overdue';            tenantId: string; tripId: string }
  | { type: 'route.changed';            tenantId: string; tripId: string; cause: string }
  | { type: 'instalment.due';           tenantId: string; instalmentId: string }
  | { type: 'instalment.overdue';       tenantId: string; instalmentId: string }
  | { type: 'lead.created';             tenantId: string; leadId: string }
  | { type: 'vehicle.docExpiring';      tenantId: string; vehicleId: string; kind: 'INSPECTION' | 'INSURANCE' };
```

Events are emitted **after** the originating transaction commits, never inside it. Handlers that must not be lost (notifications) enqueue a BullMQ job rather than working inline.

**Amendment (recorded at the close of V1).** The union above was four phases out of date.
`trip.overdue` (FR-TRP-090's `detectOverdueTrip`, Phase 6) was the one carried in
`docs/traceability.md` as documentation debt; auditing it turned up six more that had
landed with their phases and never reached this page — `stop.arrived` and `stop.completed`
(Phase 6, FR-TRP-050), `student.undelivered` and `student.returnedToSchool` (Phase 6,
FR-ATT-140/150, SRS OI-03), `trip.crewAssigned` (Phase 8, FR-NOT-030) and `trip.signalLost`
(Phase 7, FR-TRK-110). Several payloads had also grown a field: `stop.approaching` and
`stop.skipped` carry `tripId` alongside `tripStopId`, because a recipient resolver needs
the trip to find the audience, and the three `student.*` events carry `at` because their
templates print a time.

`trip.overdue` carries `expectedFinishAt` rather than a bare `at`, because the whole of
the notification is *how late* — a recipient told a trip is overdue without being told what
it was due at cannot judge whether to act.

`packages/shared/src/events.ts` is the authority for this union and always was; this
listing is documentation of it. They are now in step, and the lesson is the one
`docs/traceability.md` draws about grouped rows: a document that is a *copy* of a
declaration drifts, and the drift is invisible until somebody reads both.

`trip.finished` remains in the union above and raises no notification: §12.2 has no entry
for it, deliberately. A guardian is told about **their own child** being dropped off
(`student.droppedOff`); *"the vehicle has finished its route"* is an operational fact with
no audience.

## 3.4 Request Context

Every request carries an immutable context object resolved by middleware before any handler runs:

```typescript
interface RequestContext {
  userId: string;
  tenantId: string | null;        // null only for sysadmin platform-scope operations
  role: Role;                     // PARENT | DRIVER | HOST | ADMIN | SYSADMIN
  isImpersonating: boolean;
  impersonationReason?: string;
  ip: string;
  requestId: string;              // propagated to logs, Sentry and audit entries
}
```

This context is passed explicitly into every service call. It is **not** read from a global or async-local store inside repositories, because implicit context is the mechanism by which tenant leaks occur.

---

# 4. Multi-Tenancy Design

Implements FR-TEN-010 to FR-TEN-050. This is the most consequential section of the document.

## 4.1 Model

**Shared database, shared schema, row-level isolation.** Every operational table carries a non-nullable `tenant_id`.

Rejected alternatives: schema-per-tenant (migration cost multiplies by tenant count) and database-per-tenant (operationally impossible for a team of two).

## 4.2 Two-Layer Enforcement

FR-TEN-020 requires that isolation not depend on application code alone. Both layers are mandatory.

**Layer 1 — PostgreSQL Row Level Security.** The authoritative backstop.

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Applied identically to every tenant-scoped table. The application connects as a role **without** `BYPASSRLS`.

Each transaction sets the context before any statement:

```sql
SET LOCAL app.tenant_id = '<uuid>';
```

`SET LOCAL` is transaction-scoped, so a pooled connection cannot leak context to the next request. This is implemented as a Prisma middleware wrapping every operation in a transaction that sets the variable first.

**Layer 2 — Application scoping.** A repository base class that injects `tenant_id` into every query and every insert. Redundant with RLS by design; it catches errors earlier and produces clearer failures.

**Layer 3 — Test enforcement.** An automated test asserts, for every tenant-scoped table, that a query executed under tenant A's context returns zero rows belonging to tenant B. This test is generated from the schema and fails when a new table is added without a policy (NFR-MNT-060).

## 4.3 Cross-Tenant Identity

FR-AUTH-070 requires one user identity across multiple tenants. The `users` table is therefore **platform-scoped**, not tenant-scoped, and holds no operational data. Tenant membership lives in `user_tenant_roles`.

Login resolves the set of tenant memberships. Where a user holds exactly one, it is selected automatically. Where a guardian holds several, the mobile client requests all children across memberships in one call and the API iterates tenant contexts server-side, returning a merged list labelled by company (FR-TEN-030). No client ever sees a tenant it has no role in.

## 4.4 Sysadmin Access

Sysadmin operations run against platform-scoped tables with no tenant context. Sysadmin **cannot** read tenant operational tables (FR-SYS-120) because no `app.tenant_id` is set and RLS therefore returns nothing.

Impersonation (FR-SYS-100) issues a distinct, short-lived token that sets a tenant context and an `ADMIN` effective role, with `isImpersonating = true`. Every request under this token writes an audit entry carrying the recorded reason. The token expires after 60 minutes and cannot be refreshed.

---

# 5. Data Design

## 5.1 Conventions

| Rule | Detail |
|---|---|
| Primary keys | UUID v7 — time-ordered, so index locality is preserved without exposing sequential counts |
| Tenant column | `tenant_id uuid NOT NULL` on every operational table, first column of every composite index |
| Timestamps | `timestamptz`, always UTC. Rendered in the tenant timezone by the client |
| Money | `numeric(12,2)` with a separate `currency char(3)`. **Never** `float` or `double` (FR-FIN-290) |
| Geography | `geography(Point, 4326)` with GiST index. Metric distance functions used throughout |
| Soft delete | `deleted_at timestamptz` on master data only. Transactional and financial records are never deleted |
| Enums | PostgreSQL native enum types, mirrored in `packages/shared` |
| Audit | Every table has `created_at`, `updated_at`, `created_by`, `updated_by` |

## 5.2 Core Schema

Abridged DDL. Columns of structural significance only; routine descriptive fields omitted for brevity.

### Platform scope (no RLS)

```sql
CREATE TYPE tenant_status AS ENUM ('TRIAL','ACTIVE','GRACE','READ_ONLY','SUSPENDED');
CREATE TYPE user_status   AS ENUM ('PENDING_APPROVAL','ACTIVE','SUSPENDED','REJECTED');
CREATE TYPE role_type     AS ENUM ('PARENT','DRIVER','HOST','ADMIN','SYSADMIN');

CREATE TABLE tenants (
  id              uuid PRIMARY KEY,
  legal_name      text NOT NULL,
  tax_no          text,
  status          tenant_status NOT NULL DEFAULT 'TRIAL',
  timezone        text NOT NULL DEFAULT 'Europe/Istanbul',
  trial_ends_at   timestamptz,
  grace_ends_at   timestamptz,
  settings        jsonb NOT NULL DEFAULT '{}',   -- cut-off times, radii, discounts
  public_slug     text UNIQUE,                   -- public quote page (FR-MKT-010)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              uuid PRIMARY KEY,
  phone_e164      text UNIQUE,
  email           citext UNIQUE,
  password_hash   text,                          -- [V2] nullable: a shadow account (§7.4) and
                                                 -- a social-only B2C user (§7.5) have none.
                                                 -- NOT NULL in V1; relaxed in Phase 11.
  phone_verified  boolean NOT NULL DEFAULT false,
  status          user_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  locale          text NOT NULL DEFAULT 'tr',
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_tenant_roles (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  role         role_type NOT NULL,
  status       user_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  approved_by  uuid REFERENCES users(id),
  approved_at  timestamptz,
  rejected_reason text,
  UNIQUE (user_id, tenant_id, role)
);

-- [V2 — Phase 11] Platform-scoped: an identity is a person, not a tenant membership (§7.5).
CREATE TABLE social_identities (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         text NOT NULL,          -- 'GOOGLE' | 'APPLE'
  provider_subject text NOT NULL,          -- the provider's stable subject claim
  email_at_signup  citext,                 -- may be an Apple relay address; never used to match
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)      -- many identities → one user
);

-- [V2 — Phase 12] Second factors for B2B roles only (§7.7).
CREATE TABLE user_mfa_factors (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'TOTP',
  secret_enc    bytea NOT NULL,            -- envelope-encrypted, never returned by any endpoint
  confirmed_at  timestamptz,               -- null until the first correct code
  last_step     bigint,                    -- consumed TOTP step; blocks replay inside the window
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

CREATE TABLE user_recovery_codes (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,                -- Argon2id
  used_at    timestamptz
);

CREATE TABLE feature_flags (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  flag      text NOT NULL,      -- parent_app, driver_app, host_app, tracking, online_payment, crm
  enabled   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, flag)
);

CREATE TABLE subscription_plans (
  id uuid PRIMARY KEY, name text NOT NULL,
  tiers jsonb NOT NULL,          -- [{min:1,max:10,pricePerVehicle:...}, ...]
  currency char(3) NOT NULL DEFAULT 'TRY'
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  plan_id   uuid NOT NULL REFERENCES subscription_plans(id),
  period_start date NOT NULL, period_end date NOT NULL,
  active_vehicle_count int, amount numeric(12,2), status text
);

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY,
  tenant_id    uuid,
  actor_user_id uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  before       jsonb,
  after        jsonb,
  reason       text,               -- mandatory for impersonation (FR-SYS-100)
  ip           inet,
  request_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- Append-only: no UPDATE or DELETE grant to the application role (FR-KVK-090)
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
CREATE INDEX ON audit_log (tenant_id, entity_type, entity_id, created_at DESC);
```

### Company scope (RLS enabled)

```sql
CREATE TABLE schools (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  name text NOT NULL, geo geography(Point,4326) NOT NULL,
  morning_bell time NOT NULL, afternoon_dismissal time NOT NULL
);

CREATE TABLE school_calendar_exceptions (      -- FR-CMP-130, FR-CMP-140
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES schools(id),
  date date NOT NULL,
  is_service_day boolean NOT NULL DEFAULT false,
  morning_bell time, afternoon_dismissal time,
  UNIQUE (school_id, date)
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  plate text NOT NULL, capacity int NOT NULL CHECK (capacity > 0),
  make_model text, inspection_due date, insurance_due date,
  status text NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, plate)
);

CREATE TABLE staff (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id),        -- null until the person registers
  kind role_type NOT NULL CHECK (kind IN ('DRIVER','HOST')),
  full_name text NOT NULL, phone_e164 text,
  licence_no text, licence_expiry date, record_cert_date date
);

CREATE TABLE vehicle_assignments (            -- FR-CMP-060
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  driver_id  uuid NOT NULL REFERENCES staff(id),
  host_id    uuid REFERENCES staff(id),       -- nullable (FR-CMP-070)
  valid_from date NOT NULL, valid_to date,
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(valid_from, COALESCE(valid_to,'infinity'::date)) WITH &&
  )   -- no overlapping assignments for one vehicle
);

CREATE TABLE students (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  full_name text NOT NULL, date_of_birth date,
  school_id uuid NOT NULL REFERENCES schools(id),
  class_name text, photo_key text, medical_note text,
  status text NOT NULL DEFAULT 'ACTIVE', deleted_at timestamptz
);

CREATE TYPE address_type AS ENUM ('HOME','ALTERNATIVE');
CREATE TABLE addresses (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id),
  type address_type NOT NULL, label text,
  text_address text NOT NULL,
  geo geography(Point,4326) NOT NULL,
  verified_by_admin boolean NOT NULL DEFAULT false
);
CREATE INDEX ON addresses USING gist (geo);

CREATE TABLE guardian_links (                  -- FR-CMP-120
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  is_authorised_receiver boolean NOT NULL DEFAULT true,
  can_view_location boolean NOT NULL DEFAULT true,
  receives_notifications boolean NOT NULL DEFAULT true,
  UNIQUE (student_id, user_id)
);
```

### Routing and trips

```sql
CREATE TYPE direction   AS ENUM ('MORNING','AFTERNOON');
CREATE TYPE trip_state  AS ENUM ('PLANNED','STARTED','SWEEP_PENDING','FINISHED','CANCELLED');
CREATE TYPE stop_state  AS ENUM ('PENDING','ARRIVED','COMPLETED','SKIPPED','CANCELLED');
CREATE TYPE att_state   AS ENUM ('PENDING','BOARDED','NO_SHOW','ABSENT_DECLARED','DROPPED_OFF',
                                 'GUARDIAN_NO_SHOW','RETURNED_TO_SCHOOL');  -- last two: OI-03, §9.1

CREATE TABLE route_templates (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  school_id  uuid NOT NULL REFERENCES schools(id),
  direction  direction NOT NULL,
  name text, active boolean NOT NULL DEFAULT true
);

CREATE TABLE route_template_students (
  template_id uuid NOT NULL REFERENCES route_templates(id),
  student_id  uuid NOT NULL REFERENCES students(id),
  tenant_id   uuid NOT NULL,
  PRIMARY KEY (template_id, student_id)
);

CREATE TABLE trips (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  template_id uuid REFERENCES route_templates(id),
  vehicle_id uuid NOT NULL, driver_id uuid NOT NULL, host_id uuid,
  direction direction NOT NULL,
  service_date date NOT NULL,
  state trip_state NOT NULL DEFAULT 'PLANNED',
  planned_polyline text,          -- encoded, from Routes API
  planned_duration_s int, planned_distance_m int,
  route_optimised boolean NOT NULL DEFAULT true,   -- false on fallback (FR-RTE-090)
  order_locked boolean NOT NULL DEFAULT false,     -- FR-RTE-110
  started_at timestamptz, finished_at timestamptz,
  actual_distance_m int, cancel_reason text,
  UNIQUE (vehicle_id, direction, service_date)
);

CREATE TABLE trip_stops (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  trip_id uuid NOT NULL REFERENCES trips(id),
  sequence int NOT NULL,
  geo geography(Point,4326) NOT NULL,
  label text,
  is_school boolean NOT NULL DEFAULT false,
  is_adhoc  boolean NOT NULL DEFAULT false,       -- FR-RTE-120
  state stop_state NOT NULL DEFAULT 'PENDING',
  eta timestamptz, arrived_at timestamptz, departed_at timestamptz,
  skip_reason text,
  UNIQUE (trip_id, sequence) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE trip_stop_students (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  trip_stop_id uuid NOT NULL REFERENCES trip_stops(id),
  student_id uuid NOT NULL REFERENCES students(id),
  status att_state NOT NULL DEFAULT 'PENDING',
  recorded_by uuid, recorded_at timestamptz,
  recorded_geo geography(Point,4326),
  recorded_offline boolean NOT NULL DEFAULT false,
  client_event_id text,                            -- idempotency (FR-OFF-030)
  UNIQUE (trip_stop_id, student_id)
);
CREATE UNIQUE INDEX ON trip_stop_students (client_event_id) WHERE client_event_id IS NOT NULL;

CREATE TABLE sweep_checks (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  trip_id uuid NOT NULL UNIQUE REFERENCES trips(id),
  performed_by uuid NOT NULL, performed_at timestamptz NOT NULL,
  geo geography(Point,4326), result text NOT NULL, photo_key text
);

CREATE TABLE location_pings (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL,
  trip_id uuid NOT NULL REFERENCES trips(id),
  geo geography(Point,4326) NOT NULL,
  speed_mps real, heading real,
  recorded_at timestamptz NOT NULL
) PARTITION BY RANGE (recorded_at);
-- Daily partitions; retention by partition drop (FR-KVK-030)

CREATE TABLE absence_declarations (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id),
  service_date date NOT NULL, direction direction NOT NULL,
  alternative_address_id uuid REFERENCES addresses(id),   -- FR-ABS-070
  declared_by uuid NOT NULL, declared_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('PARENT','ADMIN')),
  cancelled_at timestamptz, cancelled_by uuid,
  UNIQUE (student_id, service_date, direction)
);
```

### Notifications and consent — Phase 8

*Not in this section as originally written.* §12 describes the notification pipeline in full
— recipients, preferences, deduplication, despatch, *"persist to messages (90-day
history)"* — without naming a table, and §17.1 declares the two consent tables inline
rather than here. FR-NOT-040, FR-NOT-050 and FR-NOT-060 each require durable state that no
queue can hold, so the gap is filled here.

```sql
CREATE TABLE device_tokens (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('IOS','ANDROID','WEB')),
  token text NOT NULL, locale text NOT NULL DEFAULT 'tr',
  last_seen_at timestamptz NOT NULL, disabled_at timestamptz, disabled_reason text,
  UNIQUE (tenant_id, token)          -- not UNIQUE (token): RLS scopes every statement,
);                                   -- and one guardian may hold two tenants on one phone

CREATE TABLE notification_preferences (   -- FR-NOT-040. Stores decisions, not state:
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,   -- no row means enabled
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL, enabled boolean NOT NULL,
  UNIQUE (tenant_id, user_id, category)
);

CREATE TABLE notification_messages (      -- FR-NOT-050 history, FR-NOT-060 failures
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL, channel text NOT NULL,   -- PUSH | SMS | IN_APP
  title text NOT NULL, body text NOT NULL, data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'QUEUED',           -- QUEUED|SENT|FAILED|NO_DEVICE
  failure_code text, attempts int NOT NULL DEFAULT 0,
  trip_id uuid, student_id uuid,                   -- denormalised; no FK, outlives them
  dedup_key text,                                  -- the durable half of §12.3
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, read_at timestamptz
);
CREATE UNIQUE INDEX ON notification_messages (dedup_key) WHERE dedup_key IS NOT NULL;

-- FR-KVK-060/070. Not in §17.1, which describes the behaviour without naming anywhere to
-- record that a request was made — and a job with no row is a request the subject cannot
-- be told the status of and which leaves no evidence it was honoured.
CREATE TABLE data_subject_requests (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('EXPORT','ERASURE')),
  status text NOT NULL DEFAULT 'QUEUED',
  requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  failure_reason text,
  archive_key text, archive_bytes int, archive_expires_at timestamptz,  -- §17.3, 48 h
  outcome jsonb                        -- what an erasure touched, and what it retained
);
```

**Which of these carry `tenant_id`.** All four above do. `consent_documents` and
`consent_acceptances` (§17.1) do **not**, and deliberately: the KVKK notice is the
platform's own legal text, and a person accepts it once rather than once per company they
drive for (§4.3). They are therefore not discovered by the isolation suite and hold no
policy.

### Finance

```sql
CREATE TYPE inst_status AS ENUM ('PENDING','PARTIAL','PAID','OVERDUE','WAIVED','CANCELLED');

CREATE TABLE fee_plans (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  name text NOT NULL, academic_year text NOT NULL,
  total_amount numeric(12,2) NOT NULL, currency char(3) NOT NULL DEFAULT 'TRY',
  instalment_count int NOT NULL, due_day int NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  first_due_month date NOT NULL
);

CREATE TABLE student_fees (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id),
  fee_plan_id uuid NOT NULL REFERENCES fee_plans(id),
  discount_type text NOT NULL DEFAULT 'NONE',
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  discount_reason text,
  gross_total numeric(12,2) NOT NULL, net_total numeric(12,2) NOT NULL,
  UNIQUE (student_id, fee_plan_id)
);

CREATE TABLE instalments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_fee_id uuid NOT NULL REFERENCES student_fees(id),
  sequence int NOT NULL, due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status inst_status NOT NULL DEFAULT 'PENDING',
  waive_reason text,
  UNIQUE (student_fee_id, sequence)
);
CREATE INDEX ON instalments (tenant_id, status, due_date);

CREATE TABLE payments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  instalment_id uuid NOT NULL REFERENCES instalments(id),
  amount numeric(12,2) NOT NULL,
  paid_at date NOT NULL,
  method text NOT NULL,          -- CASH | BANK_TRANSFER | CARD_OFFLINE | ONLINE
  reference text, note text,
  reversal_of uuid REFERENCES payments(id),   -- FR-FIN-090
  receipt_key text,
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON payments FROM app_role;   -- immutable

CREATE TABLE expenses (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id),     -- nullable = company overhead
  category text NOT NULL,
  amount numeric(12,2) NOT NULL, incurred_on date NOT NULL,
  description text, attachment_key text,
  recurring_rule_id uuid, recorded_by uuid NOT NULL
);
CREATE INDEX ON expenses (tenant_id, incurred_on, vehicle_id);
```

## 5.3 Index Strategy

| Table | Index | Purpose |
|---|---|---|
| all tenant tables | `(tenant_id, ...)` leading | RLS predicate efficiency |
| `trips` | `(tenant_id, service_date, state)` | Daily dashboard, generation batch |
| `trip_stops` | `(trip_id, sequence)` | Route rendering |
| `trip_stop_students` | `(student_id, recorded_at DESC)` | Attendance history per student |
| `location_pings` | daily partition + `(trip_id, recorded_at DESC)` | Live view and replay; retention by partition drop |
| `addresses` | GiST on `geo` | Stop merging within radius (FR-RTE-040) |
| `instalments` | `(tenant_id, status, due_date)` | Receivables report, overdue job |
| `audit_log` | `(tenant_id, entity_type, entity_id, created_at DESC)` | Record history view |

## 5.4 Partitioning and Volume

`location_pings` is the only high-volume table. At 100 vehicles × 2 trips × 45 minutes × 4 pings/minute ≈ **36,000 rows/day**, ~1.1M/month. Daily range partitions allow FR-KVK-030 retention to be implemented as `DROP PARTITION` rather than a mass `DELETE`, which would otherwise bloat the table indefinitely.

All other tables remain well under a million rows at the first-year scale (NFR-PER-010) and require no partitioning.

---

# 6. API Design

## 6.1 Conventions

| Aspect | Rule |
|---|---|
| Base path | `/api/v1` — version in path (NFR-MNT-050) |
| Format | JSON. `camelCase` keys |
| Timestamps | ISO 8601 with offset, UTC (FR-INT-030) |
| Auth | `Authorization: Bearer <access token>` |
| Tenant | Derived from the token, **never** from a header or body parameter |
| Pagination | Cursor-based: `?cursor=&limit=` (max 100), returns `{ data, nextCursor }` |
| Validation | Zod schemas in `packages/shared`, applied by a NestJS pipe |
| Errors | Structured body, stable machine code, Turkish message (FR-INT-040) |

```json
{
  "error": {
    "code": "TRIP_SWEEP_REQUIRED",
    "message": "Sefer tamamlanamaz: araç kontrolü yapılmadı.",
    "details": { "tripId": "..." },
    "requestId": "01J..."
  }
}
```

Error codes are enumerated in `packages/shared/error-codes.ts`. Clients switch on `code`, never on message text.

## 6.2 Endpoint Catalogue

Abridged. Every endpoint is tenant-scoped and role-guarded unless noted.

**Identity — `/auth`**

| Method | Path | Role | SRS |
|---|---|---|---|
| POST | `/auth/register` | public | FR-AUTH-010 |
| POST | `/auth/verify-phone` | public | FR-AUTH-020 |
| POST | `/auth/login` | public | FR-AUTH-080 |
| POST | `/auth/refresh` | any | FR-AUTH-110 |
| POST | `/auth/logout` | any | — |
| POST | `/auth/password-reset/request` · `/confirm` | public | FR-AUTH-090 |
| GET | `/auth/me` | any | returns memberships across tenants |
| GET | `/admin/registrations?status=pending` | ADMIN | FR-AUTH-040 |
| POST | `/admin/registrations/:id/approve` | ADMIN | FR-AUTH-040 |
| POST | `/admin/registrations/:id/reject` | ADMIN | FR-AUTH-040 |
| POST | `/admin/users/invite` | ADMIN | FR-AUTH-060 |

**Company — `/schools` `/vehicles` `/staff` `/students` `/guardians`**

Standard REST CRUD per resource, plus:

| Method | Path | SRS |
|---|---|---|
| POST | `/students/import` (multipart) | FR-CMP-110 |
| GET | `/students/import/template` | FR-CMP-110 |
| POST | `/students/:id/addresses` | FR-CMP-100 |
| PATCH | `/addresses/:id/geo` | manual coordinate correction |
| POST | `/students/:id/guardians` | FR-CMP-120 |
| POST | `/vehicles/:id/assignments` | FR-CMP-060 |
| GET | `/vehicles/alerts` | FR-CMP-030 |

**Absence — `/absences`**

| Method | Path | Role | SRS |
|---|---|---|---|
| POST | `/absences` | PARENT, ADMIN | FR-ABS-010/020 |
| DELETE | `/absences/:id` | PARENT, ADMIN | FR-ABS-030 |
| GET | `/students/:id/absences` | PARENT, ADMIN | — |

**Routing — `/route-templates` `/trips`**

| Method | Path | Role | SRS |
|---|---|---|---|
| POST/GET/PATCH | `/route-templates` | ADMIN | FR-CMP-080 |
| POST | `/route-templates/:id/generate?date=` | ADMIN | manual generation trigger |
| GET | `/trips?date=&state=&vehicleId=` | ADMIN | FR-RPT-010 |
| GET | `/trips/:id` | ADMIN, DRIVER, HOST | — |
| POST | `/trips/:id/reoptimise` | ADMIN | FR-RTE-100 |
| PATCH | `/trips/:id/stop-order` | ADMIN | FR-RTE-110 |
| GET | `/trips/:id/sheet.pdf` | ADMIN | FR-RTE-150 |

**Trip execution — `/trips/:id/...`** (DRIVER, HOST)

| Method | Path | SRS |
|---|---|---|
| POST | `/trips/:id/start` | FR-TRP-030 |
| POST | `/trips/:id/finish` | FR-TRP-060 |
| POST | `/trips/:id/cancel` (ADMIN) | FR-TRP-070 |
| POST | `/trips/:id/stops/:stopId/arrive` | FR-TRP-050 |
| POST | `/trips/:id/stops/:stopId/complete` | FR-ATT-060 |
| POST | `/trips/:id/stops/:stopId/skip` | FR-RTE-130 |
| POST | `/trips/:id/stops` (ad-hoc) | FR-RTE-120 |
| POST | `/trips/:id/attendance` (batch) | FR-ATT-010/020 |
| POST | `/trips/:id/sweep` | FR-ATT-080 |
| POST | `/trips/:id/pings` (batch) | FR-TRK-010 |

**Tracking — `/tracking`**

| Method | Path | Role | SRS |
|---|---|---|---|
| GET | `/tracking/my-children` | PARENT | FR-TRK-040 |
| GET | `/tracking/live` | ADMIN | FR-TRK-090 |
| GET | `/trips/:id/path` | ADMIN | FR-TRK-100 |
| WS | `/ws` channel `trip:{id}` | PARENT, ADMIN | FR-INT-020 |

**Finance — `/finance`**

| Method | Path | SRS |
|---|---|---|
| POST/GET | `/finance/fee-plans` | FR-FIN-010 |
| POST | `/finance/student-fees` | FR-FIN-020/030 |
| GET | `/finance/instalments?status=&from=&to=` | FR-FIN-240 |
| PATCH | `/finance/instalments/:id` | FR-FIN-050 |
| POST | `/finance/instalments/:id/waive` | FR-FIN-130 |
| POST | `/finance/payments` | FR-FIN-070 |
| POST | `/finance/payments/:id/reverse` | FR-FIN-090 |
| GET | `/finance/payments/:id/receipt.pdf` | FR-FIN-140 |
| POST/GET | `/finance/expenses` | FR-FIN-180 |
| GET | `/finance/reports/{income-expense,receivables,vehicle-profit,occupancy}` | FR-FIN-230–270 |
| GET | `/me/fees` | PARENT — FR-FIN-150 |

**Platform — `/platform`** (SYSADMIN)

| Method | Path | SRS |
|---|---|---|
| POST/GET/PATCH | `/platform/tenants` | FR-SYS-010 |
| POST | `/platform/tenants/:id/status` | FR-SYS-050 |
| PUT | `/platform/tenants/:id/flags` | FR-FLG-010 |
| POST | `/platform/tenants/:id/impersonate` | FR-SYS-100 |
| GET | `/platform/health` | FR-SYS-090 |
| POST | `/platform/announcements` | FR-SYS-080 |

**Public — no auth**

| Method | Path | SRS |
|---|---|---|
| GET | `/public/:slug/quote-form` | FR-MKT-010 |
| POST | `/public/:slug/quote` | FR-MKT-010/070 |

## 6.3 WebSocket Protocol

Single namespace `/ws`, authenticated by access token on connection.

| Direction | Event | Payload | Authorisation |
|---|---|---|---|
| S→C | `trip:position` | `{ tripId, lat, lng, heading, speed, at }` | Guardian of an expected student, or Admin |
| S→C | `trip:state` | `{ tripId, state }` | as above |
| S→C | `stop:state` | `{ stopId, state, eta }` | as above |
| S→C | `student:status` | `{ studentId, status, at }` | linked Guardian only |
| S→C | `route:changed` | `{ tripId, cause }` | Driver, Host, Admin |
| C→S | `subscribe` | `{ tripId }` | validated server-side against guardian links |

**Room membership is computed server-side at subscribe time.** A client requesting a `tripId` it is not entitled to receives an error and is not joined. Position broadcasts are per-trip rooms, so a guardian never receives data for another vehicle (FR-TRK-070).

Fallback: where the socket cannot connect, the client polls `GET /trips/:id/live` at 15-second intervals (FR-INT-020).

---

# 7. Authentication and Authorisation

## Two authentication domains

Authentication is not one design. It is two, and conflating them is how an administrative console acquires a consumer login.

| | **B2B** — Admin, Sysadmin | **B2C** — Guardian, Driver, Host |
|---|---|---|
| Surface | Web only | Mobile only |
| Credential | Email + password + second factor | Google or Apple identity provider |
| Password | Argon2id, deny-listed, rotatable | **None exists** |
| Second factor | TOTP, mandatory for Sysadmin (§7.7) | Phone OTP, once, at the handshake (§7.5) |
| Social login | **Prohibited** | The only path |
| Account created by | Sysadmin (Admin), platform (Sysadmin) | Admin, as a shadow account (§7.4) |
| Session | 12 hours (NFR-SEC-090) | 30 days, rotating |

**Why B2B is excluded from social login.** The reasoning is account lifecycle, not fashion.

1. **Deprovisioning.** When a company dismisses its Admin, the tenant must be able to end that access immediately and provably. An account whose authority rests on a Google account the company does not control cannot be closed by the company — only by the person being removed.
2. **The blast radius is a whole tenant.** An Admin session reaches every student's home address, every guardian's phone number and every payment record in the company. That is the exact class of access NFR-SEC-090's twelve-hour session and §7.7's second factor exist to bound, and both controls have to be ours to enforce.
3. **A dependency we cannot degrade.** §1.2 P6 requires every external service to have a defined degraded path. Maps has one; push has one. An identity provider outage has none — it is simply a locked door. For a guardian checking a map that is an inconvenience; for the Admin who must record today's payments it is an outage of the product.
4. **Audit.** FR-SYS-100 and the KVK audit trail attribute administrative actions to a person the platform provisioned. Provider-side account merges, recycled workspace addresses and delegated access all weaken that attribution in ways we cannot observe.

The inverse argument applies to B2C, which is why the split exists: a guardian will not tolerate a sign-up form, will forget a password by the second week, and holds authority over nothing beyond their own children.

## 7.1 Registration Flow (FR-AUTH-010 to FR-AUTH-050)

From V2 this is the **second** of the two ways a B2C account comes into being, and the less common one. The Admin-initiated path in §7.4 is the default; self-registration remains for the guardian who finds the application before the company enters them.

```
Applicant submits: name, phone, email, password, target tenant
        │
        ▼
  User created, status = PENDING_APPROVAL
  UserTenantRole created, status = PENDING_APPROVAL
        │
        ▼
  OTP sent to phone → verified → phone_verified = true
        │                              (still no data access)
        ▼
  Admin of target tenant sees the pending list
        │
   ┌────┴─────┐
   ▼          ▼
Approve     Reject (with reason)
   │            └─→ status = REJECTED, applicant notified
   ▼
Admin assigns role; if PARENT, links to one or more students
Status → ACTIVE; applicant notified; login now returns data
```

**Security note.** A pending user is authenticated but unauthorised. The token issued before approval carries no tenant context, so RLS returns nothing for every operational query. Access is therefore denied structurally, not by a status check that could be forgotten.

Registration is rate-limited by IP and by phone number to prevent enumeration of tenants.

## 7.2 Tokens

| Token | Lifetime | Contents | Storage |
|---|---|---|---|
| Access | 15 minutes | `sub`, `tenantId`, `role`, `impersonation`, `jti` | Memory (web), SecureStore (mobile) |
| Refresh | 30 days, rotating | `sub`, `deviceId`, `jti` | httpOnly cookie (web), SecureStore (mobile) |
| Impersonation | 60 minutes, non-refreshable | as access + `actorSysadminId`, `reason` | Memory only |
| Handshake **[V2]** | 10 minutes, single-use | `sub`, `provider`, `providerSubject` — **no `tenantId`, no `role`** | Memory only (mobile) |
| MFA challenge **[V2]** | 5 minutes, single-use | `sub`, `factorId` — **not an access token** | Memory only (web) |

Refresh tokens rotate on every use; reuse of a consumed token revokes the entire device family and raises a security alert.

The two V2 additions are deliberately *not* access tokens. Each names a user who has proved one thing and not yet the other, and neither carries a tenant, so RLS returns nothing for every operational query held behind them — the same structural denial §7.1's security note relies on.

## 7.3 Authorisation

Two mechanisms, both server-side (NFR-SEC-040):

**Role guard** — declarative, coarse:

```typescript
@Roles('ADMIN')
@Post('students')
create(@Ctx() ctx: RequestContext, @Body() dto: CreateStudentDto) { ... }
```

**Relationship guard** — imperative, fine. Required wherever a parent accesses child-specific data:

```typescript
// A guardian may read a student only through an active guardian_link
await this.access.assertGuardianOf(ctx.userId, studentId);
```

Feature flags are evaluated in the same guard chain (FR-FLG-040): a request from a role whose application flag is disabled for that tenant is rejected with `FEATURE_DISABLED` regardless of the client build.

The surface restriction of the two domains is enforced in this same chain (FR-AUTH-210): a login attempt for an `ADMIN` or `SYSADMIN` identity through `/auth/social` is rejected with `SOCIAL_LOGIN_NOT_PERMITTED`, and it is rejected on the role held, not on the client that asked.

## 7.4 Shadow Accounts and Smart Invites (FR-AUTH-180, FR-AUTH-190) **[V2 — Phase 11]**

The Admin already holds the phone number: it is on the enrolment form the parent signed. Asking that parent to independently discover the application, find the company in a list and invent a password is asking them to re-supply what the company has, and it is where onboarding stops.

The invite inverts the flow. The Admin creates the person; the person only confirms.

```
Admin enters: name, phone, role  (a Guardian, Driver or Host with no account)
        │
        ▼
  users              row created — phone_e164 set, phone_verified = false,
                     no password_hash, status = PENDING_APPROVAL     ← the shadow account
  user_tenant_roles  row created — tenant, role, status = PENDING_APPROVAL
        │
        │   The Admin can now assign students, routes and fee plans.
        │   The person holds no session and no token; no tenant
        │   context can be issued, so RLS returns nothing for them.
        ▼
  SMS dispatched with a deep link  (servisapp://invite → store listing if not installed)
        │
        ▼
  User opens the app and signs in with Google or Apple            ← §7.5
        │
        ▼
  User enters their phone number → OTP → phone_verified = true
        │
        ▼
  System matches the verified number against pending invitations  ← the match, §7.5
        │
        ▼
  Invitation presented:  "Yıldız Turizm sizi Veli olarak davet ediyor"
        │
   ┌────┴─────┐
   ▼          ▼
 Accept     Reject
   │            └─→ user_tenant_roles.status = REJECTED             ← §7.6
   ▼
user_tenant_roles.status = ACTIVE
users.status            = ACTIVE
Full session issued; the children the Admin already linked are simply there
```

**The shadow account is a real `users` row, not a separate table.** Two reasons. The Admin must be able to complete a whole tenant's configuration — assignments, fee plans, guardian links — before anyone has installed anything, and every one of those foreign keys points at `users.id`. And when the person finally arrives, acceptance is a status transition rather than a migration of records out of a provisional table, so there is no second write path to get wrong.

What makes it a *shadow* is the absence of credentials: `password_hash` is null, `phone_verified` is false, and no token has ever been issued for the row. It is a placeholder with an identity, not an account with a dormant login.

**A phone number is not yet an identity.** The invite proves the Admin believes the number belongs to a person; it proves nothing about who answers it. Authority passes only after §7.5's verification, and until then the row is inert by construction.

## 7.5 B2C Social Login and the Phone Handshake (FR-AUTH-160, FR-AUTH-170) **[V2 — Phase 11]**

Two facts must be established before a mobile user gets a session, and neither alone is enough:

| Fact | Established by | Answers |
|---|---|---|
| A durable identity we can recognise on the next launch | Google / Apple ID token | *Who is signing in?* |
| A phone number this person controls | One-time code | *Which invitation is theirs?* |

The social provider supplies the first and knows nothing about the second — the relay address in an Apple token is not a phone number, and no company invited one. The OTP supplies the second and would, alone, be a password made of six digits sent in cleartext. The handshake is the join.

```
1. Mobile app obtains an ID token from Google or Apple
2. POST /auth/social  { provider, idToken }
3. Server verifies signature, issuer, audience and expiry against the provider's JWKS,
   and the nonce where the provider carries one — see below
4. Look up social_identities (provider, provider_subject)
        │
   ┌────┴──────────────────────────────┐
   ▼                                   ▼
 known                              unknown
   │                                   │
 issue full session                 create users row (or attach to one — below),
 (skip to step 8)                   issue a HANDSHAKE token: no tenant, no role
                                       │
5.                                     ▼  POST /auth/handshake/phone { phone }
                                    OTP dispatched
6.                                     ▼  POST /auth/handshake/verify { code }
                                    phone_verified = true
7.                                     ▼
                                    MATCH: every user_tenant_roles row in
                                    PENDING_APPROVAL whose user holds this
                                    verified number → presented for acceptance
8. Full session issued for the accepted tenant(s)
```

**The match is the security boundary of this phase, and it is narrow on purpose.** The server matches on the **verified** `phone_e164` and on nothing else — never the provider's email, never a name, never a fuzzy comparison. A number that matches nothing yields an empty invitation list and an unremarkable screen: the response does not distinguish *no invitation exists* from *an invitation exists for someone else*, because that distinction is an oracle for probing which numbers a company has enrolled. Rate limiting on `/auth/handshake/phone` is per user and per number, as for registration.

**Merging the shadow account.** Where the verified number already belongs to a shadow `users` row, the row created at step 4 is discarded and the social identity is attached to the shadow row instead. This is the ordinary case — it is what makes the Admin's assignments appear the moment the guardian accepts — and it runs inside one transaction, with `phone_e164` uniquely indexed so two concurrent handshakes cannot both claim it.

**One user, many providers.** `social_identities` is many-to-one against `users`: a guardian who signs in with Google on Android and Apple on an iPad is one person, with one phone number and one set of children. The verified phone number, not the provider subject, is the identity of record.

**Multi-tenant, still (FR-AUTH-070).** One verified number can match invitations from several companies. Each is accepted or rejected independently, and the result is the multi-tenant identity §4.3 already describes, reached through a different door.

**Step 3's nonce, and what carries replay protection when there is none.** The check at step 3 is conditional, not unconditional: the server compares a nonce when the client supplied one **and** the token carries one. Apple's native flow meets both conditions and is checked. Google's does not, and cannot — the mobile client obtains its token from the native Google Sign-In SDK (see the mobile note below), whose Android implementation accepts no caller-supplied nonce. Requiring one would refuse every valid Google token; requiring one never would let an Apple token replay from another session. So the field stays optional in `socialLoginSchema` and the comparison stays conditional.

What bounds replay for a Google token is therefore not the nonce but four other properties, and they are the reason this is acceptable rather than merely unavoidable:

1. **`aud` is ours.** A replayed token has to have been minted for *this* application's client id. A token from any other Google client is refused at step 3, which removes the entire population of tokens an attacker could collect from elsewhere.
2. **The token is spent once.** It is presented at `/auth/social` and never again; nothing in the system re-presents it, and the session that results rests on our own refresh token (§7.2), not on the provider's.
3. **It is short-lived.** Google ID tokens expire in an hour, and `jwtVerify` treats expiry as a failure. The replay window is that hour, not the lifetime of the account.
4. **It never leaves the device in the clear.** The token is minted on the handset by Play Services and sent over TLS to one endpoint. An adversary positioned to capture it is already positioned to capture the access token it would be exchanged for, which is the stronger credential.

The residual risk is an attacker who has read a valid token in transit or at rest on a device within its hour, and who could not already impersonate that user by simpler means. A nonce would close that; nothing else in this list does. It is accepted for V1 and revisited if the Android SDK gains caller-supplied nonces — the schema field and the server's comparison are already in place, so that change is a client-side one.

**Mobile note: the native SDK, not a browser.** The client obtains its Google token through `@react-native-google-signin/google-signin` rather than through an OAuth authorization request in a browser. This is not a preference. Google's *OAuth 2.0 policy for keeping apps secure* refuses a custom-scheme redirect from a mobile client, so the browser flow returns `Error 400: invalid_request` with correct client ids, package name and SHA-1 — a policy decision with nothing to configure around. The native SDK has no `redirect_uri`: the token is minted on the device, and the surface the policy closed is never used. Step 2 is unchanged by this — the server has always taken an ID token and never an authorization code.

**Degraded path (§1.2 P6).** Where the provider's JWKS endpoint is unreachable, `/auth/social` fails closed with `SOCIAL_PROVIDER_UNAVAILABLE` and the client says so in Turkish. Existing sessions are unaffected — the ID token is used once, at sign-in, and never again — so an outage blocks new sign-ins and not the morning's trips. The device-side half of the same path is `SocialSignInError`: a handset with no Play Services (§18 TI-07) or a build whose signing certificate Google does not recognise never reaches step 2, and the screen says which in Turkish from `packages/i18n` rather than showing a provider's English string.

## 7.6 Rejection and Recovery (FR-AUTH-190, FR-AUTH-200) **[V2 — Phase 11]**

An invite flow that cannot survive a mistyped digit generates support calls, and the digit will be mistyped. Rejection is therefore a state with a way out, not a dead end.

```
PENDING_APPROVAL ──user rejects──► REJECTED ──admin resends──► PENDING_APPROVAL
        │                              │                              │
        │                       Admin's pending list            new push (or SMS
   user accepts                 shows it as "Reddedildi",       where no device is
        │                       with the timestamp              registered — §12)
        ▼
     ACTIVE
```

- **Rejection is not deletion.** `user_tenant_roles.status = REJECTED` keeps the row, its `rejected_reason`, and every assignment the Admin made against it. A wrong number reached a real person who declined; the company's configuration should not be lost because of it.
- **Resend is a reset, not an insert.** *Tekrar Davet Gönder* returns the existing row to `PENDING_APPROVAL`, clears `rejected_reason` and emits a fresh notification. `UNIQUE (user_id, tenant_id, role)` means there is no way to express this as a second row, which is the point: the Admin sees one invitation with a history, not a list of attempts.
- **Correcting the number is a different operation.** Where the Admin mistyped, they edit the phone number on the shadow account and then resend. Editing is permitted only while `phone_verified` is false — once a real person has proved control of the number, the Admin can no longer redirect the account, which would otherwise be a way to hand one person's linked children to another.
- **Resend is rate-limited and audited** (three per role per day). It sends SMS, and an unbounded button that sends SMS is a cost defect and a harassment vector at the same time.
- **A rejected role denies access exactly as a pending one does.** No tenant context is issued for it, so the denial is RLS returning nothing rather than a status check in a controller.

## 7.7 B2B Multi-Factor Authentication (FR-AUTH-150) **[V2 — Phase 12]**

TOTP (RFC 6238), because it needs no SMS gateway, no per-message cost and no carrier — and because the alternative, SMS codes, is the second factor whose weakness is best documented.

```
POST /auth/login  { email, password }
        │
        ▼
  Password verified (Argon2id)
        │
   ┌────┴────────────────────┐
   ▼                         ▼
 no factor enrolled       factor enrolled
   │                         │
 policy check:            issue MFA CHALLENGE token (5 min, single-use)
 mandatory for SYSADMIN,  no tenant, no role — §7.2
 per-tenant for ADMIN        │
   │                         ▼  POST /auth/mfa/verify { code }
 ┌─┴──────────┐           TOTP window ±1 step; consumed steps recorded per
 ▼            ▼           user, so a replayed code inside the window fails
enrol now   proceed          │
(forced)                     ▼
                        Full session issued
```

- **Enrolment is mandatory for Sysadmin** and cannot be dismissed: a Sysadmin without a second factor is issued an enrolment-scoped session and nothing else.
- **Per-tenant enforcement for Admin**, held in `tenants.settings` and surfaced in the sysadmin console. A tenant that turns it on forces enrolment at each Admin's next login.
- **Recovery codes**: ten, single-use, Argon2id-hashed, displayed once. Using one is an audited event and notifies the account holder. Exhausting them is not a lockout — the Sysadmin can reset a factor, and that reset is itself audited under FR-SYS-100's trail.
- **The refresh path is not a bypass.** A refresh token issued before enrolment does not survive a policy change: enabling MFA for a tenant revokes the device families of every Admin in it, so the next request lands on the login screen instead of extending a session that never presented a second factor.
- **Rate limiting** on `/auth/mfa/verify` is per user, and a failure counts toward FR-AUTH-100's five-attempt lockout. Six digits with unlimited attempts is not a factor.

---

# 8. Route Generation and Optimisation

Implements FR-RTE-010 to FR-RTE-150. This module carries the highest external cost and the highest algorithmic complexity.

## 8.1 Generation Pipeline

Runs as a scheduled BullMQ job per tenant, at `cutoff + 30 minutes` in tenant-local time (FR-RTE-020).

```
For each active route template (vehicle × school × direction):

 1. RESOLVE SERVICE DAY
    Skip if school_calendar_exceptions marks the date non-service (FR-CMP-130)

 2. RESOLVE ATTENDING STUDENTS
    template students
      MINUS students with an active absence_declaration for (date, direction)

 3. RESOLVE EFFECTIVE ADDRESS per student
    alternative address if selected for that date, else HOME  (FR-RTE-030)

 4. CAPACITY CHECK
    count > vehicle.capacity → create trip in PLANNED, flag BLOCKED,
    notify admin, do not optimise                             (FR-RTE-070)

 5. CLUSTER ADDRESSES INTO STOPS
    ST_ClusterDBSCAN over addresses, eps = 100 m, minpoints = 1  (FR-RTE-040)
    stop location = centroid of cluster members

 6. ORDER STOPS
    if template.order_locked → reuse previous manual order      (FR-RTE-110)
    else → call optimiser (§8.2)

 7. COMPUTE ETAs
    cumulative from departure time, using leg durations returned by the API,
    plus per-stop dwell allowance (default 45 s × students at stop)

 8. VALIDATE ARRIVAL
    morning: arrival at school < bell time → else warn admin    (FR-RTE-080)

 9. PERSIST
    trips + trip_stops + trip_stop_students (all PENDING), in one transaction
```

Step 5 uses PostGIS directly:

```sql
SELECT student_id,
       ST_ClusterDBSCAN(geo::geometry, eps := 100, minpoints := 1)
         OVER () AS cluster_id
FROM effective_addresses
WHERE trip_context = $1;
```

## 8.2 Optimiser

**Primary.** Google Maps Routes API (`computeRoutes`) with `optimizeWaypointOrder: true`, origin and destination pinned to the school (afternoon) or the school as destination (morning), `routingPreference: TRAFFIC_AWARE`, and `departureTime` set to the planned start.

Waypoint limit is 25 optimisable intermediates. Where a route exceeds this — unlikely at typical capacities but possible after clustering fails to merge — the stop set is split into geographic halves, each optimised separately, and concatenated. This is recorded as a degraded optimisation.

**Fallback** (FR-RTE-090). Where the API is unavailable or the request fails after retries:

```
1. Nearest-neighbour construction from the school using ST_Distance
2. 2-opt improvement pass over straight-line distances, capped at 200 iterations
3. trips.route_optimised = false
4. Admin notified: route generated without traffic optimisation
```

The fallback is pure PostGIS and requires no network. It is also used in automated tests, so the test suite never calls a paid API.

## 8.3 Cost Control

This is the single largest recurring cost risk in the system. Naïve implementation — recomputing the route on every screen view, or recomputing ETA on every position ping — would generate millions of billable requests per month.

| Rule | Implementation |
|---|---|
| **One optimisation per trip per day** | Result persisted in `trips.planned_polyline`. Viewing a route never calls the API (FR-RTE-100) |
| **Re-optimisation is explicit** | Triggered only by: late absence removing a stop (FR-ABS-050), ad-hoc stop added (FR-RTE-120), or Admin request |
| **ETA is computed locally, not fetched** | Live ETA derives from remaining polyline distance and a rolling average of observed speed, refreshed against the API at most once per 10 minutes per active trip |
| **Geocoding is persisted** | An address is geocoded once, on entry or change (FR-CMP-100) |
| **Cache key** | `route:{templateId}:{sortedStudentIdHash}:{dayOfWeek}` in Redis, 7-day TTL. A recurring identical stop set on the same weekday reuses the prior result |
| **Quota alarm** | Daily spend projected and surfaced on the sysadmin health view (FR-SYS-090); hard cap triggers automatic fallback mode |

**Projected volume at 100 vehicles:** 100 vehicles × 2 directions × 21 school days ≈ 4,200 optimisation calls/month, plus re-optimisations (~15%) and ETA refreshes (~9,000). Well inside a controlled budget. Without the caching rules above, the same workload would exceed 20 million calls.

## 8.4 Live Route Adaptation (FR-ABS-050, FR-RTE-120)

```
Late absence declared, trip already STARTED
        │
        ▼
Mark trip_stop_student.status = ABSENT_DECLARED
        │
        ▼
Any other student still PENDING at this stop?
   ├── yes → stop remains; no re-optimisation
   └── no  → stop.state = CANCELLED
                │
                ▼
        Re-optimise remaining PENDING stops only
        (visited stops are frozen; origin = current vehicle position)
                │
                ▼
        Emit route.changed → push to Driver and Host (FR-ABS-060)
        Broadcast updated ETAs over WebSocket
```

Visited stops are never reordered. The optimiser is invoked with the vehicle's current position as origin and only the unvisited set as waypoints.

---

# 9. Trip Execution and Real-Time Tracking

## 9.1 Trip State Machine (FR-TRP-010)

```
                    ┌──────────┐
                    │ PLANNED  │
                    └────┬─────┘
            start (driver, geofence or override)
                         ▼
                    ┌──────────┐
              ┌─────│ STARTED  │─────┐
              │     └────┬─────┘     │
     all stops terminal  │        cancel (admin)
              ▼          │           ▼
        ┌──────────────┐ │     ┌───────────┐
        │ SWEEP_PENDING│ │     │ CANCELLED │
        └──────┬───────┘ │     └───────────┘
         sweep recorded  │
               ▼         │
          ┌──────────┐   │
          │ FINISHED │◄──┘ (cancel also reachable from PLANNED)
          └──────────┘
```

Transitions are implemented as a guarded state machine in `TripsService`. Every transition:

1. Loads the trip `FOR UPDATE` inside a transaction
2. Validates the transition is legal from the current state
3. Validates the actor is the assigned driver, host or an admin
4. Applies invariants (below)
5. Writes the audit entry
6. Commits, then emits the domain event

**Invariants enforced at transition:**

| Transition | Invariant | SRS |
|---|---|---|
| `→ STARTED` | Actor is assigned driver; position within 500 m of first stop or override reason recorded | FR-TRP-030 |
| `stop → COMPLETED` | No `trip_stop_student` at that stop remains `PENDING` | FR-ATT-060 |
| `→ SWEEP_PENDING` | Every stop is `COMPLETED`, `SKIPPED` or `CANCELLED` | FR-TRP-060 |
| `→ FINISHED` | Sweep check exists; no student is `BOARDED` or `GUARDIAN_NO_SHOW` without a matching terminal record | FR-ATT-100, FR-ATT-110, FR-ATT-150 |

The boarded-without-dropoff check (FR-ATT-110) is the system's most important safety invariant. It is enforced in the database transaction, not in the client, and produces a blocking error naming the affected students.

### The attendance machine, and OI-03's escalation

`att_state` is the child's state *on the trip*, not at a stop. Its edges:

```
   PENDING ──────────► BOARDED ──────────► DROPPED_OFF          FR-ATT-010, FR-ATT-020
      │                   │
      │                   └──► GUARDIAN_NO_SHOW ──┬──► DROPPED_OFF        FR-ATT-140
      │                          (still aboard)   │
      ├──► NO_SHOW                                └──► RETURNED_TO_SCHOOL FR-ATT-150
      │                                                  (terminal)
      └──► ABSENT_DECLARED ──► PENDING                    FR-ABS-050, FR-ABS-030
```

`GUARDIAN_NO_SHOW` is an **intermediate** state, and this is the whole of its design: the child is
physically still on the vehicle, so it blocks `→ FINISHED` on exactly the same basis `BOARDED` does.
Modelling it as a terminal outcome — the obvious shortcut — would have made "nobody collected the
child" a way of finishing a trip with a child aboard, which is the failure FR-ATT-110 exists to
prevent.

`RETURNED_TO_SCHOOL` is terminal and does not block: the child has left the vehicle. It sits beside
`DROPPED_OFF`, `NO_SHOW` and `ABSENT_DECLARED` in every query that asks "is this child still aboard".

Entering `GUARDIAN_NO_SHOW` emits `student.undelivered` (§12.2, non-disableable, routed to the linked
guardians **and** the Admin). Leaving it for `RETURNED_TO_SCHOOL` emits `student.returnedToSchool`,
also non-disableable — a guardian who has been told nobody was at the kerb must be told where the
child then went.

## 9.2 Position Ingestion Pipeline

```
Driver device
  │  batch of pings every 15 s (or queued while offline)
  ▼
POST /trips/:id/pings
  │
  ├──► Redis: SET trip:{id}:last = {lat,lng,at}  (TTL 1h)   ← live reads
  ├──► Socket.IO: broadcast to room trip:{id}               ← FR-TRK-040
  ├──► ETA recompute for remaining stops (local, §8.3)
  │      └─► if ETA(guardian stop) < threshold and not yet sent
  │              → emit stop.approaching                     ← FR-NOT-020
  └──► Buffered insert into location_pings (flushed per 20 rows or 10 s)
```

**Live position reads never touch PostgreSQL.** The current position of every active vehicle lives in Redis; the admin fleet map (FR-TRK-090) is a single `MGET`. The database write path is buffered and asynchronous, so a database slowdown degrades history, never the live view.

Signal loss (FR-TRK-110) is detected by a worker scanning Redis keys for `last.at` older than 3 minutes on trips in `STARTED`.

## 9.3 Guardian Visibility Window (FR-TRK-040, FR-TRK-060)

A guardian may subscribe to `trip:{id}` only while **all** of the following hold:

```
   guardian_link exists and can_view_location = true
AND a linked student appears in trip_stop_students for this trip
AND trip.state = 'STARTED'
AND that student's status is PENDING or BOARDED   (not yet DROPPED_OFF)
```

This is re-evaluated on every subscribe **and** on every `student:status` change — when the child is dropped off, the server removes the guardian from the room. Expiry is server-driven; the client is not trusted to stop listening.

---

# 10. Offline Synchronisation

Implements FR-OFF-010 to FR-OFF-070. This is the highest-risk subsystem in the mobile application and the one most often underestimated.

## 10.1 Local Store

The Driver and Host applications hold a SQLite database mirroring the day's operational data.

```
trips_cache        (id, direction, state, service_date, vehicle, school)
stops_cache        (id, trip_id, sequence, lat, lng, label, state)
students_cache     (id, stop_id, name, photo_uri, medical_note, guardian_phones, status)
outbox             (client_event_id, type, payload_json, created_at,
                    attempts, last_error, synced_at)
```

Student photographs are pre-fetched to the device file system during the prefetch step, because they are needed for attendance marking and cannot be loaded on demand without a network (FR-OFF-010).

**Prefetch** occurs when the driver or host opens the app and a trip exists for today, and is retried on connectivity restoration. The entire day — both directions — is fetched at once.

## 10.2 Outbox Pattern

Every state-changing action on the device writes to `outbox` **first**, updates the local UI optimistically, and returns. The user never waits on the network (NFR-PER-070).

```
User taps "boarded"
   │
   ├─► INSERT INTO outbox (client_event_id = uuidv7(), type='attendance', ...)
   ├─► UPDATE students_cache SET status='BOARDED'   ← UI updates immediately
   └─► trigger sync attempt (fire and forget)

Sync worker (on connectivity, on app foreground, every 30 s while online):
   SELECT * FROM outbox WHERE synced_at IS NULL ORDER BY created_at
   → POST /sync/events  (batch, max 50)
   → on 2xx: mark synced
   → on 4xx (permanent): mark failed, surface to user
   → on 5xx / network: exponential backoff, retry
```

**Ordering is preserved.** Events are transmitted in creation order and the server applies them in the order received within a batch, because `stop.arrive` must precede `attendance` for that stop.

## 10.3 Idempotency (FR-OFF-030)

Every event carries a client-generated `client_event_id` (UUID v7). The server enforces uniqueness with a partial unique index and treats a duplicate as success, returning the original result. A retried batch after an ambiguous timeout is therefore harmless.

```typescript
// sync module — conceptual
async applyEvent(ctx, event) {
  const existing = await this.repo.findByClientEventId(event.clientEventId);
  if (existing) return { status: 'DUPLICATE', result: existing };
  return this.dispatch(ctx, event);          // routed to the owning module's service
}
```

## 10.4 Conflict Resolution (FR-OFF-070)

Conflicts arise when an Admin has changed the same record from the web console while the device was offline.

**Rule: the server value prevails.** The device's queued event is rejected, an audit entry records the conflict, and the record is surfaced in the Admin's exception report (FR-RPT-060).

| Conflict | Resolution |
|---|---|
| Attendance already recorded server-side with a different value | Server value kept; conflict logged; device cache corrected on next sync |
| Stop cancelled server-side (late absence) but device marked attendance | Attendance rejected; device notified; student shown as absent |
| Trip cancelled server-side, device still operating | Device receives cancellation on reconnect; queued events for that trip are rejected and logged |
| Trip already finished server-side | Events rejected as `TRIP_CLOSED` |

Position pings are exempt: they are append-only observations and are always accepted with their original timestamps (FR-OFF-040).

## 10.5 Sync Status Surface (FR-OFF-050)

A persistent banner shows one of: `Çevrimiçi` / `Çevrimdışı — N kayıt bekliyor` / `Eşitleniyor…`. Tapping it opens a list of unsynchronised events. This visibility is a requirement, not a nicety: a host who believes attendance was recorded when it was not is a safety failure.

Records applied from an offline queue are flagged `recorded_offline = true` and identified as such in reports (FR-OFF-060).

---

# 11. Financial Calculation Design

Implements FR-FIN-010 to FR-FIN-300. Governed by principle P5 (append-only) and SRS CON-07.

## 11.1 Money Representation

| Rule | Detail |
|---|---|
| Storage | `numeric(12,2)`, never floating point (FR-FIN-290) |
| Application | `decimal.js` throughout. No arithmetic on JavaScript `number` |
| Rounding | Half-up to 2 decimal places, applied once at the end of a calculation chain |
| Currency | Stored per record; TRY in V1, schema supports others (FR-FIN-300) |

## 11.2 Instalment Generation (FR-FIN-020, FR-FIN-030)

```
net_total = gross_total × (1 − discount_percent / 100)

base   = floor_to_cents(net_total / instalment_count)
remainder = net_total − (base × instalment_count)

instalment[i].amount = base                       for i = 1..n−1
instalment[n].amount = base + remainder           ← residual on the final instalment

instalment[i].due_date = first_due_month + (i−1) months, on due_day
```

The residual is placed on the final instalment so that the sum of instalments equals the net total exactly. This is verified by an automated test over a range of amounts and counts — a rounding discrepancy of one kuruş across 1,800 students is the kind of defect that destroys trust in the finance module.

**Sibling discount** (FR-FIN-030) is applied at fee assignment time. Siblings are identified as students sharing a guardian link with `is_primary = true`. The discount applies to the second and subsequent students ordered by enrolment date. The applied percentage and reason are persisted on `student_fees` — the discount is never recomputed at read time, so a later change to the tenant's discount setting does not silently alter existing fees.

## 11.3 Payment Application (FR-FIN-070 to FR-FIN-100)

```
Record payment of amount A against instalment I:
  BEGIN
    SELECT ... FROM instalments WHERE id = I FOR UPDATE
    INSERT INTO payments (...)
    UPDATE instalments
       SET paid_amount = paid_amount + A,
           status = CASE
             WHEN paid_amount + A >= amount THEN 'PAID'
             WHEN paid_amount + A > 0       THEN 'PARTIAL'
             ELSE status END
    INSERT INTO audit_log (...)
  COMMIT
```

Overpayment is rejected. Underpayment produces `PARTIAL` (FR-FIN-080).

**Reversal** (FR-FIN-090): a correction inserts a new `payments` row with a negative amount and `reversal_of` set to the original. The original is never modified. `paid_amount` is recalculated as the sum of all payment rows. Both entries appear in the student's payment history, which is what an audit requires.

## 11.4 Overdue Transition (FR-FIN-100)

A nightly job at 00:15 tenant-local:

```sql
UPDATE instalments
   SET status = 'OVERDUE'
 WHERE status IN ('PENDING','PARTIAL')
   AND due_date < current_date
   AND paid_amount < amount;
```

Each transition emits `instalment.overdue`, consumed by the notification module. No interest or penalty is computed (FR-FIN-120).

## 11.5 Vehicle Profitability (FR-FIN-250, resolves SRS OI-06)

Revenue attribution requires a rule because students may change vehicle mid-year.

```
For vehicle V, month M:

  REVENUE(V,M) = Σ over students S assigned to V during M:
                   (S.net_total / instalment_count)
                   × (days S was assigned to V in M / days in M)

  EXPENSE(V,M) = Σ expenses where vehicle_id = V and incurred_on within M

  OVERHEAD(V,M) = Σ expenses where vehicle_id IS NULL for M
                  × (active vehicles share = 1 / count of active vehicles)

  PROFIT(V,M) = REVENUE − EXPENSE − OVERHEAD
```

Revenue is recognised on a straight-line monthly basis over the fee plan, **not** on cash receipt, so that a vehicle's profitability is not distorted by payment timing. Both figures are shown: accrued profit and cash collected.

The assignment history required by the day-weighting comes from `route_template_students` change history, which is therefore retained rather than overwritten.

## 11.6 Report Generation

Reports over a single academic year execute synchronously (NFR-PER-080). Longer ranges are dispatched to a BullMQ job that writes an Excel or PDF file to object storage and notifies the Admin with a signed download link.

PDF output uses Puppeteer against the same React templates rendered on screen, so a report never diverges between display and export.

---

# 12. Notification Design

Implements FR-NOT-010 to FR-NOT-080.

## 12.1 Pipeline

```
Domain event emitted (post-commit)
        │
        ▼
NotificationService.handle(event)
        │
        ├── resolve recipients        (guardian_links / staff assignment)
        ├── filter by preference      (FR-NOT-040; safety events exempt)
        ├── filter by feature flag    (parent_app disabled → no push)
        ├── deduplicate               (see §12.3)
        ├── render template (tr)      
        └── enqueue BullMQ job 'push'
                    │
                    ▼
            FCM / APNs despatch
                    │
        ┌───────────┴────────────┐
     success                  failure
        │                        │
  persist to messages     retry ×3, then record
  (90-day history)        delivery failure (FR-NOT-060)
```

Notification despatch is **always** asynchronous via the queue. A push provider outage must never block a trip transition or an attendance record.

## 12.2 Catalogue

| Event | Recipients | Disableable | SRS |
|---|---|---|---|
| `trip.started` | Guardians of expected students | yes | FR-NOT-010 |
| `stop.approaching` | Guardians at that stop | yes | FR-NOT-020 |
| `student.boarded` | Linked guardians | yes | FR-NOT-010 |
| `student.noShow` | Linked guardians | **no** | FR-ATT-070 |
| `student.droppedOff` | Linked guardians | yes | FR-NOT-010 |
| `student.undelivered` | Linked guardians **and** Admin | **no** | FR-ATT-140 (OI-03) |
| `student.returnedToSchool` | Linked guardians **and** Admin | **no** | FR-ATT-150 (OI-03) |
| `stop.skipped` | Guardians at that stop | **no** | FR-RTE-130 |
| `trip.cancelled` | All affected guardians | **no** | FR-TRP-070 |
| `trip.crewAssigned` | Driver, Host | yes | FR-NOT-030 |
| `route.changed` | Driver, Host | yes | FR-ABS-060 |
| `trip.overdue` | Admin **and** affected guardians | yes | FR-TRP-090, FR-NOT-010 |
| `trip.signalLost` | Admin | **no** | FR-TRK-110 |
| `instalment.due` / `.overdue` | Primary guardian | yes | FR-FIN-110 |
| `sweep.overdue` | Admin | **no** | FR-ATT-100 |
| `vehicle.docExpiring` | Admin | yes | FR-CMP-030 |
| `lead.created` | Admin | yes | FR-MKT-020 |
| `admin.broadcast` | Chosen by the Admin | yes | FR-NOT-080 |

Safety-critical notifications are marked non-disableable in the template registry, and the preference API rejects attempts to disable them (FR-NOT-040).

**Amendment (Phase 6 decision 4, recorded here at the close of V1).** `trip.overdue`
replaces the `trip.delayed` row this table used to carry, and four entries were added that
had landed with their phases and never reached this page: `trip.crewAssigned`,
`trip.signalLost`, `lead.created` and `admin.broadcast`.
`apps/api/src/modules/notifications/services/notification-catalogue.ts` is the authority —
it is the catalogue *as data*, with the disableable flag FR-NOT-040 enforces and the
`packages/i18n` key each entry renders from — and this table is documentation of it.

On the substitution itself: Nothing in the system measures *"significantly delayed"*
separately from FR-TRP-090's overdue detection — `detectOverdueTrip` computes the one
number both refer to — so a second detector raising a second event about the same minute
would be two answers to one question, and the first Admin to see them disagree would stop
trusting both. One event, two audiences: the Admin because FR-TRP-090 alerts them, the
affected guardians because FR-NOT-010 lists a significantly delayed trip among the events
a guardian is told about.

It is **disableable**, unlike the safety categories. A late bus is an inconvenience, and
FR-NOT-040 lets a guardian who does not want to hear about every ten-minute overrun turn it
off. The Admin's copy is governed by the same row, which is correct — an Admin who silences
it has the fleet map and the health view instead.

## 12.3 Deduplication

`stop.approaching` is the principal risk: an ETA oscillating around the threshold on successive position updates would fire repeatedly. Suppressed by a Redis key `notif:approaching:{tripStopId}` with a TTL spanning the trip, set on first despatch (FR-NOT-020).

## 12.4 Templates

Stored in `packages/i18n` as keyed Turkish strings with typed parameters, so that adding English later requires no code change (SRS CON-06).

```
notif.student.boarded.title = "{studentName} servise bindi"
notif.student.boarded.body  = "{time} · {stopLabel}"
notif.student.noShow.title  = "{studentName} servise binmedi"
```

Every push carries a `data` payload with `type`, `tripId` and `studentId`, so tapping it deep-links to the relevant screen.

## 12.5 SMS Channel (FR-NOT-070, V2)

A `NotificationChannel` interface is defined in V1 with `PushChannel` as the only implementation. `SmsChannel` is implemented against the interface and registered but disabled by feature flag. No structural change is required to enable it.

---

# 13. Background Jobs

All jobs run on the worker replica set via BullMQ, with a shared Redis instance. Every job is idempotent and safe to re-run.

| Job | Schedule | Purpose | SRS |
|---|---|---|---|
| `generateDailyTrips` | Per tenant, cut-off + 30 min | Build the day's trips | FR-RTE-010/020 |
| `recomputeRoute` | On demand | Re-optimise after change | FR-ABS-050, FR-RTE-120 |
| `flushLocationPings` | Continuous, buffered | Persist position history | FR-TRK-010 |
| `detectSignalLoss` | Every 60 s | Flag vehicles silent > 3 min | FR-TRK-110 |
| `detectOverdueSweep` | Every 5 min | Alert on sweep outstanding > 15 min | FR-ATT-100 |
| `detectOverdueTrip` | Every 10 min | Alert on trip running > expected + 60 min | FR-TRP-090 |
| `markOverdueInstalments` | Daily 00:15 | Status transition | FR-FIN-100 |
| `sendPaymentReminders` | Daily 09:00 | Due and overdue reminders | FR-FIN-110 |
| `generateRecurringExpenses` | Monthly, 1st | Fixed monthly costs | FR-FIN-210 |
| `checkVehicleDocuments` | Daily 08:00 | Inspection/insurance expiry | FR-CMP-030 |
| `dropLocationPartitions` | Daily 03:00 | Delete partitions > 30 days | FR-KVK-030 |
| `enforceRetention` | Weekly | Attendance and personal data retention | FR-KVK-040 |
| `computeSubscriptionCharges` | Monthly | Active vehicle count × tier | FR-SYS-040 |
| `advanceTenantStatus` | Daily | TRIAL→ACTIVE→GRACE→READ_ONLY→SUSPENDED | FR-SYS-050 |
| `sendPush` | On demand | Notification despatch | FR-NOT-010 |
| `generateReport` | On demand | Long-range report export | NFR-PER-080 |

**Scheduling across timezones.** All tenants are `Europe/Istanbul` in V1, but jobs resolve schedule times through the tenant's configured timezone rather than server local time, so the schema does not need revisiting.

---

# 14. Mobile Application Design

## 14.1 Single Application, Role-Routed

One Expo application serves Parent, Driver and Host (SRS decision, one store listing). After authentication the root navigator selects a role stack:

```
App
├── AuthStack           (login, register, OTP, pending-approval, consent)
└── RoleNavigator
    ├── ParentStack     children · tracking map · trip timeline · absence ·
    │                   messages · fees & receipts · profile
    ├── DriverStack     today · active trip (nav + stop list) · add/skip stop ·
    │                   attendance (when no host) · sweep · summary
    └── HostStack       today · stop list · attendance · sweep · student detail
```

Where a feature flag disables a role's application for the tenant, the router renders an explanatory screen rather than the stack (FR-FLG-030).

## 14.2 Structure

```
apps/mobile/src/
├── api/              generated client from packages/contracts
├── db/               SQLite schema, migrations, outbox
├── sync/             sync worker, connectivity listener, conflict surfacing
├── location/         background task registration, ping batching
├── features/
│   ├── auth/  parent/  driver/  host/  shared/
├── components/       design system primitives
└── i18n/
```

## 14.3 Background Location (FR-TRK-010, FR-TRK-020, FR-TRK-030)

```typescript
// Registered only while a trip is STARTED; unregistered on finish or cancel
TaskManager.defineTask(TRACKING_TASK, async ({ data }) => {
  const { locations } = data;
  await outbox.enqueuePings(locations);   // local first, always
  await sync.tryFlush();                  // best effort
});

await Location.startLocationUpdatesAsync(TRACKING_TASK, {
  accuracy: Location.Accuracy.High,
  timeInterval: 15000,
  distanceInterval: 50,
  foregroundService: {
    notificationTitle: 'Servis takibi aktif',
    notificationBody: 'Sefer devam ediyor',
  },
});
```

**Critical constraints:**

- Tracking starts on `trip.start` and stops on `trip.finish`, `trip.cancel`, or app-level trip abandonment. It is never registered outside an active trip (FR-TRK-030) — this is both a requirement and the basis of the KVKK position.
- Android requires a persistent foreground service notification. This is mandatory and must be explained in onboarding, or drivers will disable it.
- iOS `Always` location permission requires justification in App Store review. The review submission must include a demonstration account and a written explanation of the child-safety purpose. **This is a schedule risk: budget two review cycles.**
- Battery: 15-second intervals with high accuracy over a 45-minute trip is acceptable; continuous all-day tracking would not be, which is a further reason tracking is trip-scoped.

## 14.4 Driver Interface Constraints (NFR-USA-030)

The driver operates the device while responsible for a vehicle full of children. The interface is therefore deliberately impoverished:

- One primary action visible at a time; the next stop dominates the screen
- Touch targets ≥ 48 dp, primary actions ≥ 64 dp
- No free-text entry during an active trip except reason selection from a fixed list
- Destructive actions require a second confirmation
- The screen does not auto-navigate away from the active stop

---

# 15. Web Application Design

## 15.1 Structure

```
apps/web/src/
├── api/            generated client, TanStack Query hooks
├── auth/           login, session, role guard, impersonation banner
├── layouts/        AdminLayout, SysadminLayout
├── features/
│   ├── dashboard/  students/  guardians/  vehicles/  staff/
│   ├── routes/     trips/  live-map/  attendance/
│   ├── finance/    fees/  payments/  expenses/  reports/
│   ├── crm/        approvals/  settings/
│   └── platform/   tenants/  plans/  flags/  health/  audit/
└── components/     data table, form kit, map, chart primitives
```

## 15.2 Patterns

| Concern | Approach |
|---|---|
| Server state | TanStack Query. No manual cache management |
| Client state | Zustand for UI state only — never for server data |
| Tables | TanStack Table with server-side pagination, sorting and filtering; virtualised above 200 rows |
| Forms | React Hook Form + the shared Zod schema, so client and server validate identically |
| Live map | Socket.IO subscription to all active trips of the tenant, markers updated in place |
| Impersonation | A persistent, unmissable banner naming the tenant and remaining session time (FR-SYS-100) |
| Read-only mode | On tenant status `READ_ONLY`, a global provider disables every mutating control and displays the reason (FR-SYS-060) |
| Bulk import | Client-side parse and preview, server-side validation, row-level error report (FR-CMP-110) |

## 15.3 Dashboard Composition (FR-RPT-010, FR-RPT-020)

A single aggregate endpoint `GET /dashboard?date=` returns operational and financial summary in one response. The dashboard does not issue a dozen parallel requests; the aggregate is computed server-side and cached in Redis for 60 seconds.

---

# 16. Security Design

| Control | Implementation | SRS |
|---|---|---|
| Transport | TLS 1.2+ enforced at the edge; HSTS | NFR-SEC-010 |
| Passwords | Argon2id (memory 64 MB, iterations 3, parallelism 4) | NFR-SEC-020 |
| Encryption at rest | Managed database and object storage encryption enabled | NFR-SEC-030 |
| Authorisation | Role guard + relationship guard, server-side only | NFR-SEC-040 |
| Rate limiting | Redis token bucket: auth 10/15 min per identifier; API 300/min per user; registration 5/hour per IP | NFR-SEC-050 |
| Input validation | Zod at the boundary; Prisma parameterisation prevents injection | NFR-SEC-060 |
| Dependency scanning | `pnpm audit` and Dependabot on every build | NFR-SEC-060 |
| Log hygiene | Redaction middleware strips tokens, passwords, phone numbers and coordinates from logs and Sentry payloads | NFR-SEC-070 |
| File upload | Type and size validated; stored in object storage outside the web root; served by signed URLs expiring in 15 minutes | NFR-SEC-080 |
| Session expiry | Admin 12 h inactivity; mobile refresh 30 d | NFR-SEC-090 |
| Secrets | Environment variables via the platform's secret store; none in source control | NFR-MNT-040 |
| CORS | Explicit origin allow-list; credentials permitted only for the web origin | — |

**Threat notes specific to this system:**

| Threat | Mitigation |
|---|---|
| Cross-tenant data access | RLS + application scoping + generated isolation test (§4.2) |
| A guardian tracking another family's child | Room membership computed server-side per subscribe and per status change (§9.3) |
| Enumeration of students or guardians via the registration flow | Registration returns an identical response whether or not the tenant or phone exists; rate-limited |
| A compromised driver device exposing student data | Local cache holds only the current day; cleared on logout and on trip completion + 24 h |
| Sysadmin overreach | No tenant data access without audited, time-boxed, notified impersonation (FR-SYS-100/110/120) |

---

# 17. Compliance and Retention Implementation

## 17.1 Consent (FR-KVK-010, FR-KVK-020)

```sql
CREATE TABLE consent_documents (
  id uuid PRIMARY KEY, kind text NOT NULL,     -- KVKK_NOTICE | EXPLICIT_CONSENT
  version int NOT NULL, locale text NOT NULL,
  body_md text NOT NULL, effective_from timestamptz NOT NULL,
  UNIQUE (kind, version, locale)
);

CREATE TABLE consent_acceptances (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  document_id uuid NOT NULL REFERENCES consent_documents(id),
  accepted_at timestamptz NOT NULL, ip inet, user_agent text
);
```

A guard on every authenticated request compares the user's latest acceptance against the current effective document version. Where it is stale or absent, the API returns `CONSENT_REQUIRED` and the client renders the consent screen before any other. This is enforced server-side so that an outdated client cannot bypass it.

**Both tables are append-only** — the application role holds no `UPDATE` or `DELETE`, and a trigger refuses one from every role including the owner. An acceptance is evidence: it is what would be produced to a KVKK complaint, and a row the application could edit is not evidence of anything. A document somebody has accepted cannot be edited under them either, or the version number would still match while the text no longer did; a correction is a new version, which `UNIQUE (kind, version, locale)` makes cheap.

**`effective_from` may be in the future.** A version is published and becomes binding on its stated day, which is what a KVKK change-notification period is. `findInForce(now)` takes the newest version of each kind whose instant has passed.

**Exempt routes.** The guard cannot cover the consent routes themselves, or the refusal would name a screen the client cannot fetch — a lockout rather than a policy. The complete exempt set is `GET /consent/pending`, `GET /consent/current`, `POST /consent/accept`, `GET /auth/me`, `POST /auth/logout` and `POST /auth/select-tenant`, and `consent.integration.spec.ts` enumerates the application's routes and fails if it grows.

## 17.2 Retention Enforcement

| Data | Retention | Mechanism | SRS |
|---|---|---|---|
| Location pings | 30 days | Daily partition drop | FR-KVK-030 |
| Attendance | Academic year + 1 | Weekly job; archived to cold storage then deleted | FR-KVK-040 |
| Financial records | 10 years | Never auto-deleted; excluded from erasure | FR-KVK-050 |
| Notification history | 90 days | Weekly job | FR-NOT-050 |
| Audit log | Indefinite | Never deleted | FR-KVK-090 |
| Suspended tenant data | 90 days minimum | Manual sysadmin action only | FR-SYS-070 |

## 17.3 Subject Rights (FR-KVK-060, FR-KVK-070)

**Export.** `POST /me/data-export` enqueues a job assembling all records referencing the user and their linked students into a JSON archive, delivered by a signed link valid 48 hours.

**Erasure.** Implemented as pseudonymisation, not deletion, because financial and attendance records must survive (FR-KVK-050):

```
users:            phone → NULL, email → NULL, name → 'Silinmiş Kullanıcı',
                  password_hash → random, status → SUSPENDED
students:         full_name → 'Silinmiş Öğrenci', photo deleted,
                  medical_note → NULL, date_of_birth → NULL
addresses:        text_address → 'Silinmiş Adres', geo → NULL
payments/instalments: retained in full, now referencing a pseudonymised subject
audit_log:        retained unmodified (legally required, and immutable by design)
user_tenant_roles: status → SUSPENDED
consent_acceptances: retained — the evidence that consent was obtained
```

**Three departures from the sketch above, recorded rather than silently made.**

`addresses.text_address` is `NOT NULL` and has been since Phase 2, because an address with
no text is a row a route sheet cannot print. The placeholder achieves what the requirement
asks — nothing identifying survives — without loosening a constraint four modules rely on.

`user_tenant_roles.status → SUSPENDED` is not in the sketch and is what actually stops an
erased account working. `AuthGuard` re-resolves the role from that table on every request
and never reads `users.status`, so suspending the user alone would leave a window the
length of an access token in which an outstanding token still reached the — now blanked —
data.

**Only children exclusively linked to the subject are erased.** A child with a second
guardian who has not asked is that guardian's data as much as this one's, and blanking the
name would erase a record the other parent is entitled to. The requesting guardian's own
link is removed; the student stays.

**Scope.** `POST /me/data-export` and `POST /me/erasure` take no subject parameter: the
subject is always the verified token's own. An endpoint that accepted a user identifier
would let one guardian export or erase another family, and no role check makes that safe
because both are inside the same tenant.

## 17.4 Audit Log Writing

Implemented as a NestJS interceptor on every mutating route, plus explicit calls from services where the before/after state requires domain knowledge. The interceptor captures actor, entity, request id, IP, and the diff. Impersonated requests additionally carry the recorded reason (FR-SYS-100).

Grants are configured so the application role holds `INSERT` only on `audit_log` (FR-KVK-090). No code path can modify history, including a compromised one.

---

# 18. Infrastructure and Operations

## 18.1 Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development | Docker Compose: Postgres+PostGIS, Redis, MinIO. Seeded synthetic data |
| Production | Live | Managed Postgres, Redis, object storage, EU/TR region |
| Staging | **Added when the first pilot customer goes live** | Anonymised copy |

Until a paying customer exists, two environments are sufficient. Once real student data exists in production, testing there stops being acceptable and staging becomes mandatory.

## 18.2 CI/CD (NFR-MNT-020, NFR-MNT-030)

```yaml
on: [push, pull_request]
jobs:
  verify:
    - pnpm install --frozen-lockfile
    - pnpm lint && pnpm typecheck
    - pnpm test:unit
    - pnpm test:integration        # against ephemeral Postgres service
    - pnpm test:tenant-isolation   # generated per-table isolation assertions
    - pnpm audit
  deploy:
    if: branch == main && verify passed
    - prisma migrate deploy        # migrations before app rollout
    - deploy api (rolling)
    - deploy web (static)
  mobile:
    - eas build (manual trigger)
    - eas update (OTA for JS-only changes)
```

**Migrations run before application rollout and must be backward-compatible for one release**, so a rolling deploy never runs new code against an old schema or the reverse. Column drops are performed one release after the code stops using them.

## 18.3 Observability

| Signal | Tool | Detail |
|---|---|---|
| Errors | Sentry | Backend, web, mobile. Release tagging; `requestId` attached |
| Logs | Structured JSON to platform log store | `requestId`, `tenantId`, `userId`, `route`, duration |
| Metrics | Endpoint exposing request rate, p95/p99 latency, queue depth, failed jobs, push failures, Maps API spend | Surfaced on the sysadmin health view (FR-SYS-090) |
| Uptime | External monitor against `/health` | Alerts to the operators |
| Alerts | p95 > 1.5 s sustained; queue depth > 500; failed jobs > 10/h; any sweep overdue; Maps spend > daily budget | — |

**Health endpoint** checks database connectivity, Redis connectivity, queue responsiveness and Maps API reachability, returning a per-dependency status rather than a single boolean.

## 18.4 Backup and Recovery (NFR-AVA-050, NFR-AVA-060)

| Item | Policy |
|---|---|
| Database | Managed automated backups, daily full + point-in-time recovery ≤ 15 min (RPO) |
| Retention | 30 days |
| Restore test | Quarterly, into a scratch environment, timed against the 4-hour RTO |
| Object storage | Versioning enabled; lifecycle rules for cold storage |
| Secrets | Held in the platform secret store; recovery procedure documented outside the repository |

## 18.5 Cost Model (indicative, first year)

| Item | Monthly |
|---|---|
| Application hosting (2 small instances) | $20–40 |
| Managed PostgreSQL + PostGIS | $20–50 |
| Redis | $10–15 |
| Object storage + egress | $5–10 |
| Google Maps (with §8.3 caching) | $40–90 |
| Sentry, monitoring | $0–26 |
| **Total** | **≈ $95–230** |
| Apple Developer | $99/year |
| Google Play | $25 once |

Without the caching rules in §8.3 the Maps line alone would exceed the entire budget by two orders of magnitude. This is the single most expensive mistake available in this design.

---

# 19. Testing Strategy

Implements NFR-MNT-060. Coverage is deliberately uneven: concentrated where failure is expensive.

## 19.1 Priority Tiers

| Tier | Area | Required coverage |
|---|---|---|
| **1 — Must not fail** | Tenant isolation; attendance state transitions; sweep enforcement; boarded-without-dropoff invariant; instalment arithmetic; payment application and reversal; offline idempotency | Exhaustive, including adversarial cases |
| **2 — High** | Authorisation guards; route generation; absence handling; guardian visibility window; conflict resolution | Unit + integration |
| **3 — Standard** | CRUD, reports, exports, notification routing | Happy path + principal errors |
| **4 — Manual** | Map rendering, background location, push delivery on physical devices, App Store review readiness | Documented manual checklist |

## 19.2 Specific Tests

```
tenant-isolation.spec.ts
  For every tenant-scoped table:
    seed rows for tenant A and tenant B
    execute every repository read under tenant A context
    assert zero rows belonging to tenant B
  Fails automatically when a new table lacks an RLS policy.

finance-arithmetic.spec.ts
  Property test: for amounts 1..100000 and counts 1..12,
    assert Σ instalments === net_total exactly.
  Assert reversal restores the prior balance.
  Assert overpayment is rejected.

trip-invariants.spec.ts
  Assert FINISHED is unreachable while any student is BOARDED without DROPPED_OFF.
  Assert FINISHED is unreachable without a sweep check.
  Assert stop COMPLETED is unreachable with a PENDING student.

offline-sync.spec.ts
  Replay the same batch three times → single effect.
  Out-of-order arrival → rejected in the correct order.
  Server-side conflict → server value prevails, conflict audited.

route-generation.spec.ts
  Uses the PostGIS fallback optimiser exclusively — never calls a paid API.
  Absent students excluded; addresses within 100 m merged;
  capacity exceeded → blocked; late absence → stop cancelled and re-optimised.
```

**No test calls the Google Maps API.** The provider is behind an interface with a deterministic fake in tests.

---

# 20. Traceability

| SRS module | SDD section |
|---|---|
| AUTH | §7, §6.2 |
| TEN | §4 |
| SYS, FLG | §4.4, §6.2, §13 |
| CMP | §5.2, §6.2 |
| ABS | §8.4, §6.2 |
| RTE | §8 |
| TRP, ATT | §9.1, §5.2 |
| TRK | §9.2, §9.3, §14.3 |
| NOT | §12 |
| FIN | §11 |
| MKT | §6.2 |
| RPT | §11.6, §15.3 |
| OFF | §10 |
| KVK | §17 |
| NFR-PER | §9.2, §5.4, §18 |
| NFR-SEC | §16 |
| NFR-AVA | §18.4 |
| NFR-MNT | §2.4, §3, §18.2, §19 |
| NFR-USA | §14.4, §15.2 |

The complete requirement-level matrix is maintained in `docs/traceability.md`, populated as implementation proceeds (SRS Appendix A).

---

# 21. Open Technical Issues

| ID | Issue | Position | Decide by |
|---|---|---|---|
| TI-01 | iOS `Always` location permission review outcome is not predictable. Rejection would require re-submission with additional justification. | Submit a skeleton build for review **early**, before the feature is complete, to surface objections while there is time to respond | Week 1 of mobile work |
| TI-02 | Android battery optimisation on some manufacturer ROMs (Xiaomi, Huawei, Oppo) kills foreground services despite the notification. | Detect and prompt the driver to whitelist the app; document per-manufacturer instructions | Before pilot |
| TI-03 | Google Maps waypoint optimisation is capped at 25 intermediates. Splitting degrades quality. | Acceptable at typical capacities; monitor and revisit if a route exceeds it | On occurrence |
| TI-04 | Geocoding quality for informal Turkish addresses (`... mahallesi, X sokak, no 5/A`) is variable. | Admin verification step (FR-CMP-100) is mandatory, not optional. Expect meaningful manual correction effort during onboarding | Accepted |
| TI-05 | Whether `route_template_students` change history is sufficient for the day-weighted revenue attribution in §11.5, or a dedicated assignment history table is needed. | Start with change history; add the table if reporting proves awkward | Before finance reporting |
| TI-06 | Redis is a single point of failure for live tracking. | Acceptable at V1 scale — its loss degrades live view but not attendance or history. Managed Redis with persistence | Accepted |
| TI-07 | Push notification delivery on Android in Türkiye where Google Play Services is absent on some devices. | No mitigation in V1; SMS fallback (FR-NOT-070) addresses it in V2 | V2 |
| TI-08 | Bulk import address geocoding will consume Geocoding API quota in bursts during onboarding. | Throttle imports; batch geocode as a background job with progress reporting | Before first onboarding |

---

*End of document.*
