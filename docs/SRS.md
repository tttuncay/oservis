# Software Requirements Specification
## School Transport Management Platform (working name: **ServisApp**)

| Field | Value |
|---|---|
| Document version | 1.0 (Draft) |
| Date | 2026-08-05 |
| Status | For review |
| Standard | Structured per ISO/IEC/IEEE 29148 (IEEE 830 successor) |
| Author | Product owner, with drafting assistance |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Data Model](#3-data-model)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [External Interface Requirements](#6-external-interface-requirements)
7. [Out of Scope](#7-out-of-scope)
8. [Open Issues](#8-open-issues)
9. [Glossary](#9-glossary)

---

# 1. Introduction

## 1.1 Purpose

This document specifies the complete functional and non-functional requirements for **ServisApp**, a multi-tenant SaaS platform for the management of school transport (student shuttle) operations.

The document is intended for:

- The product owner, as the definitive statement of what will be built
- Developers (including AI-assisted development via Claude Code), as the implementation contract
- Testers, as the basis for test case derivation
- Future stakeholders evaluating scope changes

Every requirement in Section 4 and 5 carries a unique identifier. No implementation may be considered complete unless every requirement marked **[V1]** is satisfied and verified.

## 1.2 Scope

ServisApp digitises the daily operations of school transport companies. The system covers:

- **Operations** — student registration, vehicle and personnel management, daily route generation, route optimisation, trip execution, attendance recording, and vehicle sweep verification
- **Safety** — live vehicle tracking visible to authorised guardians, boarding/alighting records, and mandatory end-of-trip empty-vehicle confirmation
- **Communication** — automated push notifications to guardians covering trip status and child status events
- **Finance** — student fee plans, instalment schedules, payment recording, receivables tracking, vehicle-level expense recording, and profitability reporting
- **Commercial** — a lightweight enquiry pipeline and a public quote-request page for prospective customers
- **Platform** — multi-tenant isolation, subscription lifecycle management, per-tenant feature flags, and system administration

The system consists of **two frontends** sharing **one backend**:

| Interface | Platform | Roles served |
|---|---|---|
| Mobile application | iOS + Android | Parent, Host, Driver |
| Web application | Desktop browser | Company Admin, System Administrator |

**The system does not** replace accounting software, issue legally valid electronic invoices, manage vehicle telematics hardware, or handle school academic data.

## 1.3 Definitions, Acronyms and Abbreviations

| Term | Definition |
|---|---|
| **Tenant** | A school transport company subscribing to the platform. All operational data is scoped to exactly one tenant. |
| **Company Admin** | A user who manages a single tenant's operations. Referred to as *Admin* throughout. |
| **System Administrator** | A platform operator employed by the SaaS vendor. Referred to as *Sysadmin*. Has no default access to tenant operational data. |
| **Host** | The onboard attendant (TR: *hostes / rehber*) who supervises students during a trip and records attendance. |
| **Guardian** | A person legally responsible for a student. Referred to as *Parent* in the UI. A student may have several. |
| **Student** | A child transported by the service. Not a system user; has no login. |
| **Stop** | A geographic point at which the vehicle halts to collect or discharge one or more students. |
| **Trip** | One execution of one direction of transport on one date by one vehicle (e.g. Vehicle 34ABC123, morning, 2026-09-15). |
| **Route** | The ordered sequence of stops assigned to a trip. |
| **Direction** | `MORNING` (home → school) or `AFTERNOON` (school → home). |
| **Sweep Check** | The mandatory post-trip inspection confirming no student remains aboard. |
| **Cut-off time** | The latest moment at which a guardian may declare an absence for a given direction. |
| **KVKK** | *Kişisel Verilerin Korunması Kanunu* — Turkish Personal Data Protection Law (No. 6698). |
| **FR / NFR** | Functional Requirement / Non-Functional Requirement. |
| **RPO / RTO** | Recovery Point Objective / Recovery Time Objective. |

## 1.4 Requirement Conventions

- **shall** — mandatory. Absence of the behaviour is a defect.
- **should** — recommended. Omission requires justification.
- **may** — optional.
- **[V1]** — required for first production release.
- **[V2]** — second release. Frictionless go-live and operational continuity; scheduled to a V2 phase in `docs/PROJECT_PLAN.md`.
- **[V3]** — deferred beyond V2; the data model and interfaces shall accommodate it without restructuring.

## 1.5 References

- ISO/IEC/IEEE 29148:2018 — Requirements engineering
- Law No. 6698 on the Protection of Personal Data (KVKK)
- Turkish Commercial Code, Article 82 — commercial record retention
- Google Maps Platform — Routes API documentation
- Regulation on School Service Vehicles (*Okul Servis Araçları Yönetmeliği*)

---

# 2. Overall Description

## 2.1 Product Perspective

ServisApp is a new, self-contained, cloud-hosted system. It has no predecessor and does not integrate with any existing customer system in V1.

```
                         ┌─────────────────────────────┐
                         │      External Services      │
                         │  Google Maps Routes API     │
                         │  Push (FCM / APNs)          │
                         │  SMS Gateway         [V2]   │
                         │  Google / Apple SSO  [V2]   │
                         │  İyzico Payments     [V3]   │
                         │  Object Storage             │
                         └──────────────┬──────────────┘
                                        │
   ┌─────────────┐              ┌───────┴────────┐              ┌──────────────┐
   │  Mobile App │◄────────────►│                │◄────────────►│   Web App    │
   │  (Expo RN)  │   REST/WS    │   ServisApp    │   REST/WS    │   (React)    │
   │             │              │    Backend     │              │              │
   │ Parent      │              │   (NestJS)     │              │ Admin        │
   │ Driver      │              │                │              │ Sysadmin     │
   │ Host        │              └───────┬────────┘              └──────────────┘
   └─────────────┘                      │
                              ┌─────────┴──────────┐
                              │ PostgreSQL+PostGIS │
                              │ Redis (cache/queue)│
                              └────────────────────┘
```

## 2.2 Product Functions

| # | Function group | Summary |
|---|---|---|
| F1 | Tenant & subscription management | Sysadmin onboards companies, sets plans, controls feature flags, manages suspension |
| F2 | Company configuration | Admin defines schools, vehicles, drivers, hosts, students, guardians, fee plans |
| F3 | Daily route generation | System builds each day's stop list from attending students and optimises stop order |
| F4 | Trip execution | Driver starts/ends trips; system streams position; host records attendance and sweep |
| F5 | Live tracking | Guardians view vehicle position and ETA during trips carrying their child |
| F6 | Absence declaration | Guardians declare absences before cut-off; routes adapt automatically |
| F7 | Notifications | Event-driven push messages to guardians and staff |
| F8 | Financial management | Fee plans, instalments, payment recording, receivables, expenses, profitability |
| F9 | Commercial pipeline | Public quote-request form and enquiry tracking |
| F10 | Reporting | Operational and financial reports with Excel/PDF export |
| F11 | Compliance | Consent capture, audit logging, data retention enforcement |

## 2.3 User Classes and Characteristics

| Class | Frequency of use | Technical skill | Device | Key needs |
|---|---|---|---|---|
| **Guardian (Parent)** | Twice daily, brief | Low. May be unfamiliar with apps. Assume the least technical user. | Personal smartphone, variable quality, mobile data | Where is my child; did they board; when will they arrive; what do I owe |
| **Driver** | Twice daily, extended, while driving | Low to medium | Company or personal smartphone, mounted | Minimum interaction; large touch targets; must function while moving; must not require reading long text |
| **Host** | Twice daily, extended | Low to medium | Personal smartphone | Fast per-student marking; must work with poor signal; clear sweep confirmation |
| **Company Admin** | Daily, extended | Medium. Familiar with Excel, not with software administration. | Desktop browser | Full operational and financial control; bulk data entry; export |
| **Sysadmin** | As needed | High | Desktop browser | Tenant lifecycle, diagnostics, support intervention |

**Design consequence:** the Driver and Host interfaces are safety-critical and shall be optimised for speed and error resistance over feature richness. The Guardian interface shall be usable without training.

## 2.4 Operating Environment

| Component | Requirement |
|---|---|
| Mobile OS | iOS 15+, Android 9 (API 28)+ |
| Web browsers | Chrome, Edge, Safari, Firefox — latest two major versions |
| Web viewport | 1280×720 minimum; admin panel need not be mobile-responsive in V1, but shall be usable on a tablet in landscape |
| Backend | Linux container runtime; horizontally scalable stateless application nodes |
| Database | PostgreSQL 15+ with PostGIS extension |
| Hosting region | Türkiye or EU, consistent with KVKK cross-border transfer constraints |
| Connectivity | Mobile clients shall assume intermittent connectivity |

## 2.5 Design and Implementation Constraints

| ID | Constraint |
|---|---|
| CON-01 | Development is performed by a single non-specialist operator using AI-assisted coding. Requirements shall therefore favour conventional, well-documented patterns over novel architecture. |
| CON-02 | Recommended stack: React Native (Expo) for mobile, React for web, NestJS (TypeScript) for backend, PostgreSQL + PostGIS, Redis for cache and job queues. |
| CON-03 | Mapping and route optimisation shall use the Google Maps Routes API. Responses shall be cached to control per-request cost. |
| CON-04 | Personal data of minors is processed. All requirements are subordinate to KVKK obligations. |
| CON-05 | The system shall be multi-tenant with row-level tenant isolation from the first commit. Retrofitting tenancy is prohibited. |
| CON-06 | Primary UI language is Turkish. All user-facing strings shall be externalised for translation from the first commit. |
| CON-07 | Financial records shall be immutable once posted; corrections shall be made by reversing entries, never by editing history. |

## 2.6 Assumptions and Dependencies

| ID | Assumption |
|---|---|
| ASM-01 | Every guardian who requires tracking owns a smartphone with data connectivity. Guardians without one are served by SMS in V2. |
| ASM-02 | Drivers keep the mobile device powered and the application in the foreground or with background location permission granted for the trip duration. |
| ASM-03 | A Google Maps Platform billing account is available and funded. |
| ASM-04 | Student home addresses supplied by guardians are geocodable to sufficient accuracy; the Admin can manually correct coordinates. |
| ASM-05 | Each vehicle carries at most one active trip at a time. |
| ASM-06 | Legal responsibility for the physical safety of students remains with the transport company; the system provides records, not supervision. |
| DEP-01 | Push delivery depends on FCM and APNs availability. |
| DEP-02 | Route optimisation depends on Google Maps Routes API availability; a degraded fallback is required (see FR-RTE-090). |

---

# 3. Data Model

## 3.1 Core Entities

```
Tenant ──┬─< School
         ├─< Vehicle ──< VehicleAssignment >── Staff (Driver | Host)
         ├─< Staff
         ├─< Student ──┬─< GuardianLink >── Guardian
         │             ├─< Address (HOME | ALTERNATIVE)
         │             ├─< Enrollment (school, direction, fee plan)
         │             └─< AbsenceDeclaration
         ├─< RouteTemplate ──< RouteTemplateStudent
         ├─< Trip ──┬─< TripStop ──< TripStopStudent (attendance)
         │          ├─< LocationPing
         │          └─< SweepCheck
         ├─< FeePlan ──< Instalment ──< Payment
         ├─< Expense
         ├─< Lead (enquiry)
         └─< AuditLog

Platform ──┬─< SubscriptionPlan ──< Subscription >── Tenant
           ├─< FeatureFlag >── Tenant
           └─< ConsentDocument ──< ConsentAcceptance >── User
```

## 3.2 Entity Notes

| Entity | Key attributes and rules |
|---|---|
| **Tenant** | `id`, `legal_name`, `tax_no`, `status` (TRIAL, ACTIVE, GRACE, READ_ONLY, SUSPENDED), `timezone`, `settings_json`. Every operational row carries `tenant_id`. |
| **User** | `id`, `phone`, `email`, `password_hash`, `status` (PENDING_APPROVAL, ACTIVE, SUSPENDED), `locale`. A User may hold roles in more than one Tenant. |
| **UserTenantRole** | `user_id`, `tenant_id`, `role` (PARENT, DRIVER, HOST, ADMIN), `approved_by`, `approved_at`. Enables one identity across companies (FR-AUTH-070). |
| **Student** | `id`, `tenant_id`, `full_name`, `date_of_birth`, `school_id`, `class`, `photo_url`, `medical_note`, `status`. Never a login holder. |
| **GuardianLink** | `student_id`, `user_id`, `relationship`, `is_primary`, `is_authorised_receiver`, `can_view_location`, `receives_notifications`. |
| **Address** | `student_id`, `type`, `label`, `text`, `geo` (PostGIS `geography(Point,4326)`), `verified_by_admin`. |
| **Vehicle** | `plate`, `capacity`, `make_model`, `inspection_due`, `insurance_due`, `status`. |
| **VehicleAssignment** | `vehicle_id`, `driver_id`, `host_id` (nullable), `valid_from`, `valid_to`. Supports substitutions (FR-CMP-060). |
| **RouteTemplate** | Persistent grouping of students to a vehicle and direction. Source for daily generation. |
| **Trip** | `tenant_id`, `vehicle_id`, `driver_id`, `host_id`, `direction`, `service_date`, `state`, `planned_polyline`, `started_at`, `finished_at`, `distance_m`, `duration_s`. Unique on (`vehicle_id`, `direction`, `service_date`). |
| **TripStop** | `trip_id`, `sequence`, `geo`, `label`, `state`, `eta`, `arrived_at`, `departed_at`. |
| **TripStopStudent** | `trip_stop_id`, `student_id`, `status` (PENDING, BOARDED, NO_SHOW, ABSENT_DECLARED, DROPPED_OFF), `recorded_by`, `recorded_at`, `recorded_offline`, `client_event_id`. |
| **LocationPing** | `trip_id`, `geo`, `speed`, `heading`, `recorded_at`. Subject to 30-day retention (FR-KVK-030). |
| **SweepCheck** | `trip_id`, `performed_by`, `performed_at`, `result`, `geo`, `photo_url` (optional). |
| **AbsenceDeclaration** | `student_id`, `service_date`, `direction`, `declared_by`, `declared_at`, `source` (PARENT, ADMIN), `cancelled_at`. |
| **FeePlan** | `tenant_id`, `name`, `academic_year`, `total_amount`, `currency`, `instalment_count`, `due_day_of_month`, `first_due_month`. |
| **StudentFee** | `student_id`, `fee_plan_id`, `discount_type` (NONE, SIBLING, MANUAL), `discount_percent`, `net_total`. |
| **Instalment** | `student_fee_id`, `sequence`, `due_date`, `amount`, `status` (PENDING, PARTIAL, PAID, OVERDUE, WAIVED). |
| **Payment** | `instalment_id`, `amount`, `paid_at`, `method` (CASH, BANK_TRANSFER, CARD_OFFLINE, ONLINE[V3]), `reference`, `recorded_by`, `reversal_of` (nullable). Immutable (CON-07). |
| **Expense** | `tenant_id`, `vehicle_id` (nullable), `category`, `amount`, `incurred_on`, `description`, `attachment_url`, `recorded_by`. |
| **Lead** | `tenant_id`, `contact_name`, `phone`, `email`, `school`, `address_text`, `student_count`, `status` (NEW, CONTACTED, QUOTED, WON, LOST), `notes`, `source`. |
| **AuditLog** | `tenant_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `ip`, `created_at`, `reason` (for impersonation). Append-only. |

---

# 4. Functional Requirements

Requirement IDs follow the pattern `FR-<MODULE>-<NNN>`.

| Module code | Area |
|---|---|
| AUTH | Authentication, registration, authorisation |
| TEN | Multi-tenancy and isolation |
| SYS | Platform administration and subscriptions |
| CMP | Company configuration |
| RTE | Route generation and optimisation |
| TRP | Trip lifecycle |
| ATT | Attendance and sweep check |
| TRK | Location tracking |
| ABS | Absence declaration |
| NOT | Notifications |
| FIN | Finance |
| MKT | Commercial pipeline |
| RPT | Reporting |
| KVK | Data protection and compliance |
| OFF | Offline operation |
| FLG | Feature flags |

---

## 4.1 AUTH — Authentication, Registration and Authorisation

| ID | Requirement | Rel. |
|---|---|---|
| FR-AUTH-010 | The system shall permit prospective Guardians, Drivers and Hosts to self-register by supplying full name, mobile phone number, email and password, and selecting the company (Tenant) they wish to join. | V1 |
| FR-AUTH-020 | The system shall verify the supplied mobile number by one-time code before creating the account. | V1 |
| FR-AUTH-030 | A self-registered account shall be created in state `PENDING_APPROVAL` and shall have no access to any operational data until approved. | V1 |
| FR-AUTH-040 | The system shall present pending registrations to the Admin of the selected Tenant, who shall approve, assign a role, and — for Guardians — link the account to one or more Student records; or reject with a reason. | V1 |
| FR-AUTH-050 | The system shall notify the applicant of approval or rejection. | V1 |
| FR-AUTH-060 | The Admin shall additionally be able to create accounts directly and dispatch an invitation link, bypassing self-registration. | V1 |
| FR-AUTH-070 | A single user identity shall be able to hold roles in more than one Tenant; the client shall display the associated company alongside each Student or assignment. | V1 |
| FR-AUTH-080 | Mobile roles shall authenticate with mobile phone number and password. Web roles shall authenticate with email address and password. **Amended for V2 Phase 11:** a mobile account created through an invitation (FR-AUTH-180) holds no password and authenticates through an identity provider only (FR-AUTH-160); phone-and-password remains for accounts self-registered under FR-AUTH-010. Web roles gain a second factor (FR-AUTH-150) and gain no alternative credential (FR-AUTH-210). | V1, amended V2 |
| FR-AUTH-090 | The system shall support password reset by one-time code delivered to the registered phone number or email. | V1 |
| FR-AUTH-100 | The system shall lock an account for 15 minutes after 5 consecutive failed authentication attempts and notify the account holder. | V1 |
| FR-AUTH-110 | The system shall issue short-lived access tokens (≤ 30 minutes) with refresh tokens valid no longer than 30 days, revocable per device. | V1 |
| FR-AUTH-120 | The system shall enforce a minimum password length of 8 characters and reject passwords appearing in a common-password deny list. | V1 |
| FR-AUTH-130 | The Admin shall be able to suspend or reactivate any user within their own Tenant. | V1 |
| FR-AUTH-140 | Every API request shall be authorised against the caller's role within the target Tenant; role checks shall be enforced server-side irrespective of client behaviour. | V1 |
| FR-AUTH-150 | The system shall support multi-factor authentication for Admin and Sysadmin accounts. Enrolment shall be mandatory for Sysadmin and enforceable per Tenant for Admin. | V2 — Phase 12 |
| FR-AUTH-160 | The system shall permit B2C users (Guardians, Drivers and Hosts) to authenticate through Google and Apple identity providers on the mobile application, without creating or supplying a password. | V2 — Phase 11 |
| FR-AUTH-170 | On a user's first authentication through an identity provider, the system shall require verification of a mobile phone number by one-time code, and shall use the verified number to match the user automatically against every pending invitation issued to that number. | V2 — Phase 11 |
| FR-AUTH-180 | The Admin shall be able to create a Guardian, Driver or Host from a mobile phone number alone, before that person holds an account. The resulting record shall be assignable to Students, routes and fee plans immediately, and shall hold no access to any data until the invitation is accepted. | V2 — Phase 11 |
| FR-AUTH-190 | The system shall present every matched invitation to the user for explicit acceptance or rejection. Acceptance shall set the role to `ACTIVE`; rejection shall set it to `REJECTED` and record the outcome for the issuing Admin. | V2 — Phase 11 |
| FR-AUTH-200 | The Admin shall be able to re-issue a rejected or unanswered invitation, returning it to `PENDING_APPROVAL` and dispatching a fresh notification, without creating a duplicate record. | V2 — Phase 11 |
| FR-AUTH-210 | Admin and Sysadmin accounts shall not be authenticable through any external identity provider. Web roles shall authenticate by email address, password and second factor only. | V2 — Phase 11 |

## 4.2 TEN — Multi-Tenancy

| ID | Requirement | Rel. |
|---|---|---|
| FR-TEN-010 | Every operational record shall be associated with exactly one Tenant. | V1 |
| FR-TEN-020 | The system shall prevent any user from reading or modifying data belonging to a Tenant in which they hold no role, enforced at the data-access layer and not solely in application code. | V1 |
| FR-TEN-030 | A Guardian holding roles in multiple Tenants shall see a unified list of their children, each labelled with its company, with no visibility of any other data across Tenants. | V1 |
| FR-TEN-040 | The system shall permit a Tenant to serve multiple Schools, and a School to be served by multiple Tenants. | V1 |
| FR-TEN-050 | Cross-tenant queries shall be available exclusively to Sysadmin and only in aggregate, anonymised form except during audited impersonation. | V1 |

## 4.3 SYS — Platform Administration

| ID | Requirement | Rel. |
|---|---|---|
| FR-SYS-010 | The Sysadmin shall be able to create, edit and deactivate Tenants, recording legal name, tax number, contact person, and billing details. | V1 |
| FR-SYS-020 | The Sysadmin shall be able to define Subscription Plans priced per active vehicle per month, with volume tiers (e.g. 1–10, 11–30, 31+ vehicles). | V1 |
| FR-SYS-030 | The system shall support a configurable free trial period per Tenant, defaulting to 30 days. | V1 |
| FR-SYS-040 | The system shall compute each Tenant's monthly subscription charge from the count of vehicles active during that period, and display it to the Sysadmin. | V1 |
| FR-SYS-050 | On non-payment, the system shall transition a Tenant through `GRACE` (configurable, default 14 days), then `READ_ONLY`, then `SUSPENDED`. | V1 |
| FR-SYS-060 | In `READ_ONLY` state, all users of the Tenant shall retain the ability to view existing data and complete in-progress trips, but shall not create or modify records. | V1 |
| FR-SYS-070 | Tenant data shall be retained for a minimum of 90 days after suspension before any deletion, and shall be restorable in full upon reactivation. | V1 |
| FR-SYS-080 | The Sysadmin shall be able to publish global or per-Tenant announcements displayed on login. | V1 |
| FR-SYS-090 | The Sysadmin shall be able to view platform health indicators: error rate, request latency, failed background jobs, push delivery failures, and external API quota consumption. | V1 |
| FR-SYS-100 | The Sysadmin shall be able to impersonate a Company Admin for support purposes. Impersonation shall require entry of a written reason, shall be recorded in the audit log, shall be visibly indicated in the interface throughout, and shall expire automatically after 60 minutes. | V1 |
| FR-SYS-110 | The system shall notify the impersonated Tenant's Admin by email that an impersonation session occurred, including the recorded reason. | V1 |
| FR-SYS-120 | The Sysadmin shall not have direct access to student location history or attendance records outside an audited impersonation session. | V1 |

## 4.4 FLG — Feature Flags

| ID | Requirement | Rel. |
|---|---|---|
| FR-FLG-010 | The system shall support per-Tenant feature flags controlling, at minimum: Parent app access, Driver app access, Host app access, live tracking, online payments, marketing module. | V1 |
| FR-FLG-020 | Disabling a flag shall hide the corresponding functionality from all affected users without requiring a deployment. | V1 |
| FR-FLG-030 | When a role's application access is disabled for a Tenant, users holding that role shall be shown an explanatory message on login rather than an error. | V1 |
| FR-FLG-040 | Flag state shall be evaluated server-side; a modified client shall not be able to access disabled functionality. | V1 |

## 4.5 CMP — Company Configuration

| ID | Requirement | Rel. |
|---|---|---|
| FR-CMP-010 | The Admin shall be able to register Schools with name, address, geographic coordinates, morning bell time and afternoon dismissal time. | V1 |
| FR-CMP-020 | The Admin shall be able to register Vehicles with plate number, seating capacity, make and model, inspection expiry, and insurance expiry. | V1 |
| FR-CMP-030 | The system shall alert the Admin 30 days before, and daily after, the expiry of any vehicle inspection or insurance date. | V1 |
| FR-CMP-040 | The Admin shall be able to register Drivers and Hosts with contact details, licence number and expiry, and criminal record certificate date where applicable. | V1 |
| FR-CMP-050 | The Admin shall be able to register Students with name, date of birth, school, class, photograph, home address, optional alternative address, and free-text medical or behavioural note. | V1 |
| FR-CMP-060 | The system shall support date-bounded assignment of a Driver and an optional Host to a Vehicle, permitting substitution without altering historical records. | V1 |
| FR-CMP-070 | The Host assignment shall be optional; where no Host is assigned, the Driver shall perform attendance duties. | V1 |
| FR-CMP-080 | The Admin shall assign each Student to a Vehicle and Direction via a Route Template; Guardians shall not select vehicles. | V1 |
| FR-CMP-090 | The system shall warn the Admin when the number of Students assigned to a Route Template exceeds the Vehicle's capacity. | V1 |
| FR-CMP-100 | The system shall geocode each Student address on entry and display the resulting point on a map for Admin confirmation; the Admin shall be able to adjust the point manually. | V1 |
| FR-CMP-110 | The Admin shall be able to import Students in bulk from a spreadsheet using a downloadable template, with a validation report identifying rejected rows and reasons. | V1 |
| FR-CMP-120 | The Admin shall be able to link one or more Guardians to a Student, designating for each: primary contact, authorisation to receive the child, permission to view location, and notification preference. | V1 |
| FR-CMP-130 | The Admin shall be able to define non-service days (public holidays, semester breaks) per School; no trips shall be generated on those dates. | V1 |
| FR-CMP-140 | The Admin shall be able to define exception days on which a School's dismissal time differs from the default. | V1 |

## 4.6 ABS — Absence Declaration

| ID | Requirement | Rel. |
|---|---|---|
| FR-ABS-010 | A Guardian shall be able to declare that a Student will not travel, specifying the date and the direction (morning, afternoon, or both). | V1 |
| FR-ABS-020 | A Guardian shall be able to declare absence for a contiguous date range (e.g. an illness lasting several days). | V1 |
| FR-ABS-030 | The system shall enforce a per-Tenant configurable cut-off time per direction, defaulting to 06:00 for morning and 12:00 for afternoon. After the cut-off, the Guardian shall not be able to create or cancel a declaration for that direction on that date. | V1 |
| FR-ABS-040 | The Admin shall be able to create or cancel an absence declaration at any time, including after the cut-off, with the action recorded in the audit log. | V1 |
| FR-ABS-050 | Where an absence is declared after the day's route has been generated but before the vehicle has departed the relevant stop, the system shall mark that Student as `ABSENT_DECLARED`, remove the stop if no other Student remains at it, and re-optimise the remaining unvisited stops. | V1 |
| FR-ABS-060 | The system shall notify the Driver and Host of any change to the active route arising from a late absence declaration. | V1 |
| FR-ABS-070 | The Guardian shall be able to select an alternative registered address for a specific date and direction, in place of the home address. | V1 |
| FR-ABS-080 | The system shall display to the Guardian a confirmation of each declaration, including which trips it affects. | V1 |

## 4.7 RTE — Route Generation and Optimisation

| ID | Requirement | Rel. |
|---|---|---|
| FR-RTE-010 | The system shall generate Trips automatically for each Vehicle, Direction and service date, from the corresponding Route Templates, excluding non-service days. | V1 |
| FR-RTE-020 | Generation shall occur at a per-Tenant configurable time, defaulting to 30 minutes after the morning cut-off, and shall include only Students without an active absence declaration for that date and direction. | V1 |
| FR-RTE-030 | The system shall derive the stop list from the effective address of each attending Student — the alternative address where one has been selected for that date, otherwise the home address. | V1 |
| FR-RTE-040 | The system shall merge Student addresses lying within a configurable radius, defaulting to 100 metres, into a single Stop. | V1 |
| FR-RTE-050 | The system shall compute the stop sequence minimising total travel duration, incorporating predicted traffic for the scheduled departure time. | V1 |
| FR-RTE-060 | For the morning direction the route shall terminate at the School; for the afternoon direction it shall originate at the School. | V1 |
| FR-RTE-070 | The system shall validate that the attending Student count does not exceed Vehicle capacity, and shall block confirmation of the Trip while the constraint is violated, notifying the Admin. | V1 |
| FR-RTE-080 | The system shall validate that the computed morning arrival at the School precedes the School's bell time, and shall warn the Admin where it does not. Arrival time shall be a validated constraint, not an optimisation objective, in V1. | V1 |
| FR-RTE-090 | Where the external routing service is unavailable, the system shall fall back to a nearest-neighbour ordering computed from straight-line distance, shall mark the route as unoptimised, and shall notify the Admin. | V1 |
| FR-RTE-100 | Computed routes shall be cached and shall not be recomputed on repeated viewing; recomputation shall occur only on a material change to the stop set or on explicit request. | V1 |
| FR-RTE-110 | The Admin shall be able to review any generated route, reorder stops manually, and lock the manual order against re-optimisation. | V1 |
| FR-RTE-120 | The Driver shall be able to add an ad-hoc Stop during an active Trip; the system shall insert it into the remaining sequence and re-optimise. Ad-hoc stops shall be recorded and reported to the Admin. | V1 |
| FR-RTE-130 | The Driver shall be able to skip a Stop, recording a reason; affected Guardians shall be notified. | V1 |
| FR-RTE-140 | The system shall display the planned route on a map with numbered stops, estimated arrival time per stop, and total distance and duration. | V1 |
| FR-RTE-150 | The Admin shall be able to print or export a day's route sheet listing stops, times, students and guardian contact numbers, for use where the Driver application is not yet in service. | V1 |
| FR-RTE-160 | Optimisation shall additionally account for per-student time windows and multi-vehicle load balancing. | V3 |

## 4.8 TRP — Trip Lifecycle

| ID | Requirement | Rel. |
|---|---|---|
| FR-TRP-010 | A Trip shall progress through the states `PLANNED → STARTED → SWEEP_PENDING → FINISHED`, with `CANCELLED` reachable from `PLANNED` or `STARTED`. | V1 |
| FR-TRP-020 | Each Stop within a Trip shall progress through `PENDING → ARRIVED → COMPLETED`, or terminate in `SKIPPED` or `CANCELLED`. | V1 |
| FR-TRP-030 | Only the assigned Driver shall be able to transition a Trip to `STARTED`, and only from a position within a configurable radius of the first stop or the depot, defaulting to 500 metres. Where the position check fails, the Driver shall be able to override with a recorded reason. | V1 |
| FR-TRP-040 | The system shall record the Driver, Host, Vehicle, start time, end time, total distance and total duration for every Trip. | V1 |
| FR-TRP-050 | The system shall automatically mark a Stop as `ARRIVED` when the Vehicle enters a configurable radius of it, defaulting to 75 metres; the Driver or Host shall also be able to mark arrival manually. | V1 |
| FR-TRP-060 | The system shall prevent a Trip from being transitioned to `FINISHED` until every Stop has reached a terminal state and the Sweep Check has been recorded. | V1 |
| FR-TRP-070 | The Admin shall be able to cancel a Trip, recording a reason; all affected Guardians shall be notified immediately. | V1 |
| FR-TRP-080 | The Admin shall be able to reassign the Driver, Host or Vehicle of a `PLANNED` Trip. | V1 |
| FR-TRP-090 | Where a Trip remains in `STARTED` beyond a configurable duration after its expected completion, defaulting to 60 minutes, the system shall alert the Admin. | V1 |
| FR-TRP-100 | The Admin shall be able to create attendance and trip records retrospectively for dates on which the mobile applications were not in use. | V1 |
| FR-TRP-110 | The system shall maintain a permanent, queryable history of all completed Trips including attendance outcomes. | V1 |

## 4.9 ATT — Attendance and Sweep Check

| ID | Requirement | Rel. |
|---|---|---|
| FR-ATT-010 | At each Stop the Host — or the Driver where no Host is assigned — shall record, for each expected Student, one of: `BOARDED` or `NO_SHOW`. | V1 |
| FR-ATT-020 | At each drop-off the responsible party shall record `DROPPED_OFF` for each alighting Student. | V1 |
| FR-ATT-030 | Attendance marking shall be achievable in a single tap per Student, with the Student's photograph and name displayed. | V1 |
| FR-ATT-040 | The system shall not require Guardian confirmation or signature for boarding or alighting in V1; Guardians shall be informed by notification only. | V1 |
| FR-ATT-050 | Every attendance record shall capture the recording user, the timestamp, and the device position at the moment of recording. | V1 |
| FR-ATT-060 | The system shall prevent a Stop from being marked `COMPLETED` while any expected Student at that Stop remains unmarked. | V1 |
| FR-ATT-070 | Where a Student is marked `NO_SHOW`, the system shall immediately notify all linked Guardians. | V1 |
| FR-ATT-080 | At the end of every Trip the system shall require the Host, or the Driver where no Host is assigned, to perform and confirm a Sweep Check verifying that no Student remains aboard the Vehicle. | V1 |
| FR-ATT-090 | The Sweep Check shall record the performing user, timestamp and device position, and shall not be dismissible without an explicit affirmative confirmation. | V1 |
| FR-ATT-100 | The system shall block the Trip from reaching `FINISHED` until the Sweep Check is recorded, and shall alert the Admin where a Sweep Check remains outstanding 15 minutes after the final Stop. | V1 |
| FR-ATT-110 | The system shall detect and alert on the inconsistency of a Student recorded as `BOARDED` at pickup without a corresponding `DROPPED_OFF` record before Trip completion, and shall block completion until resolved. | V1 |
| FR-ATT-120 | The Admin shall be able to correct any attendance record, with the original value, the new value, the actor and the timestamp retained in the audit log. | V1 |
| FR-ATT-130 | The Sweep Check may require photographic evidence of the empty vehicle interior, configurable per Tenant. | V2 |
| FR-ATT-140 | Where no authorised receiver is present at a Student's drop-off Stop, the responsible party shall be able to record `GUARDIAN_NO_SHOW`. The Student shall continue to be treated as aboard the Vehicle for the purposes of FR-ATT-110, and the system shall immediately notify all linked Guardians and the Admin. The notification shall not be disableable. | V1 |
| FR-ATT-150 | A Student recorded `GUARDIAN_NO_SHOW` shall be resolved either by `DROPPED_OFF`, where an authorised receiver subsequently attends, or by `RETURNED_TO_SCHOOL`, where the Student is returned to the School. `RETURNED_TO_SCHOOL` is terminal and does not block Trip completion; the resolution shall be notified to all linked Guardians and shall not be disableable. | V1 |

FR-ATT-140 and FR-ATT-150 resolve **OI-03** (§8). They are the escalation procedure that
requirement calls for, and are stated here rather than left to design because the choice of
what the crew may do with a child nobody collected is a safety and liability decision, not an
implementation detail.

## 4.10 TRK — Location Tracking

| ID | Requirement | Rel. |
|---|---|---|
| FR-TRK-010 | The Driver application shall transmit the Vehicle position at intervals not exceeding 15 seconds while a Trip is in the `STARTED` state. | V1 |
| FR-TRK-020 | Position transmission shall continue while the application is in the background, subject to the platform permissions granted. | V1 |
| FR-TRK-030 | The system shall not collect or transmit any position data outside an active Trip. | V1 |
| FR-TRK-040 | A Guardian shall be able to view the live Vehicle position on a map only during a Trip on which one of their linked Students is expected to travel, and only where the `can_view_location` permission is set. | V1 |
| FR-TRK-050 | The Guardian view shall display the Vehicle position, the Guardian's own Stop, and the estimated time of arrival at that Stop. | V1 |
| FR-TRK-060 | The Guardian shall not be able to view the Vehicle position after their Student has been recorded as dropped off, nor before the Trip has started. | V1 |
| FR-TRK-070 | The Guardian shall not be shown the identity, address or stop of any other Student. | V1 |
| FR-TRK-080 | Estimated arrival times shall be recalculated on each position update and shall incorporate current traffic conditions. | V1 |
| FR-TRK-090 | The Admin shall be able to view the live position of all active Vehicles of their Tenant on a single map. | V1 |
| FR-TRK-100 | The Admin shall be able to replay the recorded path of any Trip within the location retention window. | V1 |
| FR-TRK-110 | Where no position update has been received for a Vehicle on an active Trip for more than 3 minutes, the system shall indicate the signal loss to viewing Guardians and alert the Admin. | V1 |

## 4.11 NOT — Notifications

| ID | Requirement | Rel. |
|---|---|---|
| FR-NOT-010 | The system shall despatch a push notification to linked Guardians on each of the following events: trip started; vehicle approaching the Guardian's stop; student boarded; student recorded as no-show; student dropped off; stop skipped; trip cancelled; trip significantly delayed; instalment due; instalment overdue. | V1 |
| FR-NOT-020 | The proximity notification shall be triggered by estimated time of arrival at the Guardian's Stop falling below a per-Tenant configurable threshold, defaulting to 5 minutes, and shall be sent at most once per Stop per Trip. | V1 |
| FR-NOT-030 | The system shall despatch a push notification to Drivers and Hosts on: assignment to a trip; change to an active route; addition or removal of a student; trip cancellation. | V1 |
| FR-NOT-040 | The Guardian shall be able to enable or disable each notification category individually, except those classified as safety-critical (no-show, trip cancellation), which shall not be disableable. | V1 |
| FR-NOT-050 | All notifications shall be retained in an in-application message history for a minimum of 90 days. | V1 |
| FR-NOT-060 | Notification delivery failures shall be recorded and surfaced to the Sysadmin in aggregate. | V1 |
| FR-NOT-070 | The system shall implement an SMS delivery channel as a fallback where push delivery fails or the Guardian has no registered device. The subset of notifications eligible for fallback shall be a property of the notification catalogue, not of the individual message, and shall be bounded by a per-Tenant cost limit. | V2 — Phase 12 |
| FR-NOT-080 | The Admin shall be able to send a free-text broadcast message to all Guardians of a selected Vehicle, School or the entire Tenant. | V1 |

## 4.12 FIN — Financial Management

### 4.12.1 Fee Definition

| ID | Requirement | Rel. |
|---|---|---|
| FR-FIN-010 | The Admin shall be able to define Fee Plans per academic year, specifying total amount, currency, number of instalments, due day of month, and first due month. | V1 |
| FR-FIN-020 | The Admin shall be able to assign a Fee Plan to a Student, generating the corresponding Instalment schedule automatically. | V1 |
| FR-FIN-030 | The system shall apply a configurable sibling discount percentage to the second and each subsequent Student sharing a primary Guardian. | V1 |
| FR-FIN-040 | The Admin shall be able to apply a manual discount or surcharge to an individual Student's fee, recording a reason. | V1 |
| FR-FIN-050 | The Admin shall be able to adjust an individual Instalment's amount or due date prior to payment, with the change recorded in the audit log. | V1 |
| FR-FIN-060 | Where a Student's enrolment is terminated mid-year, the Admin shall be able to cancel unpaid future Instalments and record a refund against paid ones. | V1 |

### 4.12.2 Payment Recording

| ID | Requirement | Rel. |
|---|---|---|
| FR-FIN-070 | The Admin shall be able to record a payment against an Instalment, specifying amount, date, method (cash, bank transfer, offline card) and reference. | V1 |
| FR-FIN-080 | The system shall support partial payment, setting the Instalment status to `PARTIAL` and tracking the outstanding balance. | V1 |
| FR-FIN-090 | Payment records shall be immutable once created. Corrections shall be effected by creating a reversing entry linked to the original, never by modification or deletion. | V1 |
| FR-FIN-100 | The system shall automatically transition an Instalment to `OVERDUE` at the start of the day following its due date where the balance remains unpaid. | V1 |
| FR-FIN-110 | The system shall despatch payment reminder notifications to the primary Guardian at configurable intervals before and after the due date, defaulting to 3 days before and 1, 7 and 14 days after. | V1 |
| FR-FIN-120 | The system shall not apply automatic interest or late-payment charges in V1; overdue Instalments shall be flagged only. | V1 |
| FR-FIN-130 | The Admin shall be able to waive an Instalment, recording a reason. | V1 |
| FR-FIN-140 | The system shall generate a PDF payment receipt per recorded payment, bearing the Tenant's details, and shall make it available to the Guardian in the mobile application. | V1 |
| FR-FIN-150 | The Guardian shall be able to view their own payment schedule, payment history, and outstanding balance for each linked Student. | V1 |
| FR-FIN-160 | The system shall support online card payment by Guardians through a payment service provider, including instalment (*taksit*) options. The data model shall accommodate this from V1 without restructuring. | V3 |
| FR-FIN-170 | The system shall integrate with e-Arşiv / e-Fatura for legally valid electronic invoicing. | V3 |

### 4.12.3 Expenses

| ID | Requirement | Rel. |
|---|---|---|
| FR-FIN-180 | The Admin shall be able to record expenses under the categories: fuel, maintenance, insurance, statutory inspection, tyres, driver salary, host salary, vehicle rental or finance, and other. | V1 |
| FR-FIN-190 | Each expense shall be optionally attributable to a specific Vehicle, enabling per-vehicle cost analysis. | V1 |
| FR-FIN-200 | The Admin shall be able to attach a scanned document or photograph to an expense record. | V1 |
| FR-FIN-210 | The Admin shall be able to define recurring monthly expenses that are generated automatically. | V1 |
| FR-FIN-220 | The system shall provide structured payroll management for Drivers and Hosts, including wage definition, overtime, deductions and payslip generation. Salaries in V1 are recorded as ordinary expenses. | V3 |

### 4.12.4 Financial Reporting

| ID | Requirement | Rel. |
|---|---|---|
| FR-FIN-230 | The system shall produce a monthly income and expense statement per Tenant. | V1 |
| FR-FIN-240 | The system shall produce a receivables report listing all outstanding and overdue Instalments, sortable by amount and age, with Guardian contact details. | V1 |
| FR-FIN-250 | The system shall produce a per-Vehicle profitability report comparing attributed revenue — the fees of Students assigned to that Vehicle, apportioned monthly — against attributed expenses. | V1 |
| FR-FIN-260 | The system shall produce a per-Student payment history statement. | V1 |
| FR-FIN-270 | The system shall produce a Vehicle occupancy report showing assigned Students against capacity, and average actual attendance. | V1 |
| FR-FIN-280 | All financial reports shall be exportable to Excel and PDF. | V1 |
| FR-FIN-290 | All monetary values shall be stored as exact decimal quantities and never as floating-point numbers. | V1 |
| FR-FIN-300 | All financial figures shall be denominated in Turkish Lira in V1, with the schema supporting multiple currencies. | V1 |

## 4.13 MKT — Commercial Pipeline

| ID | Requirement | Rel. |
|---|---|---|
| FR-MKT-010 | The system shall provide each Tenant with a public web page, reachable by a unique link, on which a prospective customer may submit a quote request comprising contact name, telephone number, email, school, home district, and number of children. | V1 |
| FR-MKT-020 | Submissions shall create a Lead record within the Tenant and notify the Admin. | V1 |
| FR-MKT-030 | The Admin shall be able to progress a Lead through the states NEW, CONTACTED, QUOTED, WON and LOST, and record free-text notes and follow-up dates against it. | V1 |
| FR-MKT-040 | The Admin shall be able to create a Lead manually for enquiries received by telephone or in person. | V1 |
| FR-MKT-050 | The system shall convert a WON Lead into a Student and Guardian record, carrying across the captured details. | V1 |
| FR-MKT-060 | The system shall report Lead volume and conversion rate by month and source. | V1 |
| FR-MKT-070 | The public quote page shall include the KVKK notice and shall obtain explicit consent before submission. | V1 |
| FR-MKT-080 | The system shall support outbound campaign messaging to existing Guardians by SMS or email, and referral tracking. | V3 |

## 4.14 RPT — Operational Reporting and Dashboard

| ID | Requirement | Rel. |
|---|---|---|
| FR-RPT-010 | The Admin dashboard shall display for the current day: trips planned, in progress and completed; students expected, boarded and absent; outstanding sweep checks; active alerts. | V1 |
| FR-RPT-020 | The Admin dashboard shall display current-month financial summary: collected, outstanding, overdue, and expenses. | V1 |
| FR-RPT-030 | The system shall produce a per-Student attendance report over a selectable date range. | V1 |
| FR-RPT-040 | The system shall produce a per-Trip punctuality report comparing planned and actual arrival times per stop. | V1 |
| FR-RPT-050 | The system shall produce a Driver and Host activity report covering trips operated and hours in service. | V1 |
| FR-RPT-060 | The system shall produce an exception report listing no-shows, skipped stops, ad-hoc stops, late sweep checks and manual overrides. | V1 |
| FR-RPT-070 | All operational reports shall be exportable to Excel and PDF. | V1 |

## 4.15 OFF — Offline Operation

| ID | Requirement | Rel. |
|---|---|---|
| FR-OFF-010 | The Driver and Host applications shall cache the full day's trip data — stops, students, photographs, guardian contact numbers — before the trip begins, and shall remain fully operable without network connectivity. | V1 |
| FR-OFF-020 | Attendance records, stop state transitions and sweep checks created while offline shall be queued locally and transmitted automatically on restoration of connectivity. | V1 |
| FR-OFF-030 | Each queued event shall carry a client-generated unique identifier; the server shall reject duplicates idempotently. | V1 |
| FR-OFF-040 | Position readings captured while offline shall be queued and transmitted on reconnection, retaining their original timestamps. | V1 |
| FR-OFF-050 | The application shall display a persistent indication of offline status and the count of unsynchronised events. | V1 |
| FR-OFF-060 | Records synchronised from an offline queue shall be flagged as such and shall be identifiable in reports. | V1 |
| FR-OFF-070 | Where a conflicting server-side change has occurred, the server value shall prevail and the conflict shall be recorded in the audit log for Admin review. | V1 |

## 4.16 KVK — Data Protection and Compliance

| ID | Requirement | Rel. |
|---|---|---|
| FR-KVK-010 | The system shall present the KVKK information notice and obtain explicit consent (*açık rıza*) from every user at first login, recording the document version, timestamp and IP address. | V1 |
| FR-KVK-020 | Where the consent document version changes, the system shall obtain fresh consent before permitting further use. | V1 |
| FR-KVK-030 | Raw location readings shall be automatically and permanently deleted 30 days after capture. Aggregate trip records — start and end times, distance, stop times, attendance — shall be retained beyond this period. | V1 |
| FR-KVK-040 | Attendance records shall be retained for the academic year of capture plus one further year. | V1 |
| FR-KVK-050 | Financial records shall be retained for ten years in accordance with the Turkish Commercial Code. | V1 |
| FR-KVK-060 | A Guardian shall be able to request export of all personal data held concerning them and their linked Students, delivered in a machine-readable format. | V1 |
| FR-KVK-070 | The system shall support erasure of a data subject's personal data on request, save where retention is required by law, in which case the record shall be pseudonymised rather than deleted. | V1 |
| FR-KVK-080 | Every creation, modification and deletion of a record shall be written to an append-only audit log capturing actor, action, entity, prior value, new value, IP address and timestamp. | V1 |
| FR-KVK-090 | The audit log shall not be modifiable or deletable by any role, including Sysadmin. | V1 |
| FR-KVK-100 | Student photographs and medical notes shall be visible only to the Admin of the owning Tenant and to the Driver and Host assigned to that Student's active trip. | V1 |
| FR-KVK-110 | Personal data shall be stored within Türkiye or the European Union. | V1 |
| FR-KVK-120 | The system shall provide the Sysadmin with a data breach reporting facility recording affected records and data subjects. | V2 |

---

# 5. Non-Functional Requirements

## 5.1 Performance

| ID | Requirement |
|---|---|
| NFR-PER-010 | The system shall be dimensioned for a first-year load of 100 concurrently operating Vehicles, approximately 1,800 Students, and approximately 3,000 Guardian accounts per deployment. |
| NFR-PER-020 | 95% of API requests shall return within 500 ms, and 99% within 1,500 ms, measured at the server, under peak load. |
| NFR-PER-030 | Peak load is defined as the morning window 07:00–08:30 local time, during which all Vehicles operate simultaneously, position readings arrive at approximately 7 per second, and up to 1,500 Guardian tracking sessions are concurrently active. |
| NFR-PER-040 | A Guardian's map view shall reflect a Vehicle position no more than 20 seconds old. |
| NFR-PER-050 | Daily route generation for 100 Vehicles shall complete within 10 minutes. |
| NFR-PER-060 | Mobile application cold start to usable screen shall not exceed 3 seconds on a mid-range device manufactured within the preceding four years. |
| NFR-PER-070 | Attendance marking shall register in the local interface within 200 ms irrespective of network state. |
| NFR-PER-080 | Reports covering up to one academic year shall render within 10 seconds; longer ranges may be generated asynchronously with notification on completion. |
| NFR-PER-090 | The architecture shall permit horizontal scaling to ten times the stated first-year load without redesign. |

## 5.2 Availability and Reliability

| ID | Requirement |
|---|---|
| NFR-AVA-010 | The system shall achieve 99.5% monthly availability, measured excluding scheduled maintenance. |
| NFR-AVA-020 | Scheduled maintenance shall not take place between 06:00 and 09:00 or between 14:00 and 18:00 local time on school days. |
| NFR-AVA-030 | Failure of the external routing service shall not prevent trip execution, attendance recording or tracking. |
| NFR-AVA-040 | Failure of the push notification service shall not prevent any other function. |
| NFR-AVA-050 | Recovery Point Objective shall not exceed 15 minutes; Recovery Time Objective shall not exceed 4 hours. |
| NFR-AVA-060 | Database backups shall be taken at least daily, retained 30 days, and restore-tested at least quarterly. |
| NFR-AVA-070 | No single component failure shall result in loss of recorded attendance or sweep check data. |

## 5.3 Security

| ID | Requirement |
|---|---|
| NFR-SEC-010 | All network communication shall use TLS 1.2 or higher. |
| NFR-SEC-020 | Passwords shall be stored using bcrypt with a cost factor of at least 12, or Argon2id with equivalent parameters. |
| NFR-SEC-030 | Personal data at rest, including location history, shall be encrypted at the storage layer. |
| NFR-SEC-040 | Authorisation shall be enforced server-side on every request. No client-side check shall be relied upon. |
| NFR-SEC-050 | The system shall rate-limit authentication endpoints to 10 attempts per identifier per 15 minutes, and general API endpoints per authenticated user. |
| NFR-SEC-060 | The system shall be free of the OWASP Top Ten vulnerability classes; dependency scanning shall run on every build. |
| NFR-SEC-070 | Sensitive values shall never be written to application logs. Personal identifiers in logs shall be masked. |
| NFR-SEC-080 | File uploads shall be validated by type and size and shall be stored outside the web root with access mediated by signed, expiring URLs. |
| NFR-SEC-090 | Administrative sessions shall expire after 12 hours of inactivity; mobile sessions after 30 days. |

## 5.4 Usability

| ID | Requirement |
|---|---|
| NFR-USA-010 | A Guardian shall be able to locate their child's vehicle within two interactions from application launch. |
| NFR-USA-020 | A Host shall be able to record attendance for a stop of five students within 15 seconds. |
| NFR-USA-030 | Driver interface controls shall present touch targets of at least 48×48 dp, and shall require no text entry during motion. |
| NFR-USA-040 | The mobile applications shall be usable one-handed on screens of 5 inches and above. |
| NFR-USA-050 | All user-facing text shall be presented in Turkish by default, with all strings externalised for translation. |
| NFR-USA-060 | Error messages shall state the cause and the corrective action in plain language, without technical codes. |
| NFR-USA-070 | Destructive actions shall require confirmation and, where the record is financial or operational history, shall be reversible rather than destructive. |
| NFR-USA-080 | The mobile applications shall meet WCAG 2.1 Level AA contrast requirements and shall support system font scaling. |

## 5.5 Maintainability and Portability

| ID | Requirement |
|---|---|
| NFR-MNT-010 | Business logic shall reside in the backend; clients shall not duplicate validation rules as the sole enforcement point. |
| NFR-MNT-020 | The system shall expose structured logs, request tracing and error aggregation to a monitoring service. |
| NFR-MNT-030 | Database schema changes shall be applied by versioned, reversible migrations held in source control. |
| NFR-MNT-040 | Configuration shall be supplied by environment variables; no credential shall appear in source control. |
| NFR-MNT-050 | The API shall be versioned; a breaking change shall not be introduced within a major version. |
| NFR-MNT-060 | Automated tests shall cover, at minimum, tenant isolation, authorisation rules, financial calculations, route generation, attendance state transitions and offline synchronisation. |
| NFR-MNT-070 | The system shall not depend on any single cloud provider service for which no equivalent alternative exists. |
| NFR-MNT-080 | Mobile applications shall support over-the-air update of JavaScript where the platform permits, to reduce store review dependency. |

---

# 6. External Interface Requirements

## 6.1 User Interfaces

| Screen group | Role | Key screens |
|---|---|---|
| Guardian mobile | Parent | Child list; live tracking map; trip status timeline; absence declaration; message history; payment schedule and receipts; profile and consent |
| Driver mobile | Driver | Today's trips; active trip navigation with stop list; add or skip stop; attendance where no host; trip summary |
| Host mobile | Host | Today's trips; stop list; per-stop student attendance; sweep check; student contact and medical note |
| Admin web | Admin | Dashboard; students; guardians; vehicles; staff; route templates; daily trips and live map; attendance; fees and instalments; payments; expenses; reports; leads; approvals; settings |
| Sysadmin web | Sysadmin | Tenant list and lifecycle; subscription plans; feature flags; announcements; system health; audit and impersonation log |

## 6.2 Software Interfaces

| Interface | Purpose | Requirements |
|---|---|---|
| Google Maps Routes API | Stop sequence optimisation, distance and duration, traffic-aware ETA | Responses cached per FR-RTE-100; graceful degradation per FR-RTE-090; quota consumption monitored per FR-SYS-090 |
| Google Maps Geocoding API | Address to coordinate conversion | Results persisted; re-geocoding only on address change |
| Maps SDK (mobile and web) | Map rendering | — |
| Firebase Cloud Messaging / APNs | Push delivery | Delivery failures recorded per FR-NOT-060 |
| Object storage | Student photographs, expense attachments, generated PDFs | Signed expiring URLs per NFR-SEC-080 |
| SMS gateway — transactional | One-time codes (FR-AUTH-020, FR-AUTH-170) and the invitation deep link (FR-AUTH-180) | **[V2]** — enabled in **Phase 11**. See the note below |
| SMS gateway — notification fallback | Fallback delivery for critical messages | **[V2]** — enabled in Phase 12 per FR-NOT-070; interface defined and disabled until then |
| Google Identity / Apple Sign In | B2C authentication for Guardians, Drivers and Hosts | **[V2]** — Phase 11 per FR-AUTH-160. Not available to Admin or Sysadmin (FR-AUTH-210) |
| İyzico | Online card payment | **[V3]** — interface defined, disabled |

**Note — why the SMS gateway is two rows.** At the opening of V2 this was one row reading
*"enabled in Phase 12 per FR-NOT-070"*, which contradicted SDD §7.4 and §7.5: Phase 11's
invitation *"SMS dispatched with a deep link"* and its six-digit handshake code both need a
transport a phase before FR-NOT-070 supplies one, and Phase 11's exit criterion — *"having
typed nothing but a six-digit code"* — cannot be demonstrated without it.

The conflict was resolved by observing that the two uses are different obligations that
happen to share a carrier. **FR-NOT-070 is a fallback channel inside the notification
pipeline**: it is defined by when a *push* was not acknowledged, it shares that pipeline's
deduplication key, and it is bounded by a per-Tenant cost limit. None of those ideas applies
to a one-time code, which has no push counterpart, must never be deduplicated against one,
and is sent because a user asked for it thirty seconds ago.

Phase 11 therefore supplies a transactional transport only — `SmsProviderPort`, bound behind
`OtpDeliveryPort`, provider-agnostic and disabled by default — and Phase 12 supplies
FR-NOT-070's channel and its cost governance. The two rows above are that boundary. FR-NOT-070
itself is unchanged and remains claimed by Phase 12 alone.

## 6.3 Communication Interfaces

| ID | Requirement |
|---|---|
| FR-INT-010 | Client-server communication shall use a REST/JSON API over HTTPS. |
| FR-INT-020 | Live position and trip state updates shall be delivered over a persistent connection (WebSocket), falling back to polling at 15-second intervals where unavailable. |
| FR-INT-030 | All timestamps shall be transmitted in UTC with explicit offset and rendered in the Tenant's configured timezone. |
| FR-INT-040 | The API shall return conventional HTTP status codes with structured error bodies containing a stable machine-readable code and a human-readable Turkish message. |

---

# 7. Out of Scope

The following are explicitly **not** part of this system. Any request to add them constitutes a scope change requiring re-estimation.

| # | Excluded |
|---|---|
| 1 | Accounting ledger, tax computation, and statutory financial statements |
| 2 | Legally valid electronic invoicing (e-Fatura / e-Arşiv) in V1 and V2 — FR-FIN-170 is `[V3]` |
| 3 | Structured payroll processing and payslip generation in V1 and V2 — FR-FIN-220 is `[V3]` |
| 4 | Online card payment collection in V1 and V2 — FR-FIN-160 is `[V3]` |
| 5 | Telematics hardware, OBD devices, dashcams and their integration |
| 6 | Driver behaviour scoring, harsh-braking detection and fuel telemetry |
| 7 | School academic data: grades, timetables, discipline records |
| 8 | In-application messaging or chat between Guardians and staff |
| 9 | Guardian-initiated selection of vehicle, driver or stop |
| 10 | Public marketplace where Guardians discover and compare transport companies |
| 11 | Multi-language user interface beyond Turkish in V1 |
| 12 | Native tablet-optimised layouts for the administrative web application |
| 13 | Offline operation of the administrative web application |
| 14 | Automatic vehicle-to-route assignment optimisation across the fleet |
| 15 | Integration with any existing customer system |

---

# 8. Open Issues

These require a decision before or during implementation. Each carries a stated default that shall apply unless overridden.

| ID | Issue | Default applied | Needed by |
|---|---|---|---|
| OI-01 | Online card payment was affirmed in the requirements interview but placed outside the first release in the scope decision. This document assumes **manual payment recording**, with the schema accommodating İyzico integration without restructuring. The V2 scope decision moved it further, to `[V3]`. | Manual recording only | Before finance module build |
| OI-02 | Route composition: the interview affirmed both automatic daily generation and driver-entered stops. This document resolves the conflict as **automatic generation from student addresses, with driver-added ad-hoc stops permitted during an active trip** (FR-RTE-010, FR-RTE-120). | As stated | Before route module build |
| OI-03 | Procedure where no one is present to receive a student at drop-off. Guardian confirmation is excluded from V1 (FR-ATT-040), so no escalation was originally specified. A defined procedure is a safety and liability matter and had to be added before live operation. | **Resolved:** the system supports `GUARDIAN_NO_SHOW` escalation and `RETURNED_TO_SCHOOL` as a terminal attendance state (FR-ATT-140, FR-ATT-150). The child stays accounted for as aboard until one of the two resolutions is recorded, so FR-ATT-110 continues to block completion throughout. | Closed before first live trip |
| OI-04 | Whether a School role — permitting school staff to view which students travel on which vehicle — is required. | Not in V1 | **Considered at V2 planning; default upheld.** V2 is Phases 11 and 12 only. Re-open before V3 planning. |
| OI-05 | Whether Admin sub-roles (accountant, dispatcher) with restricted permissions are required. | Single Admin role | **Considered at V2 planning; default upheld.** Sub-roles would multiply the §7.7 MFA policy surface before a customer has asked for them. Re-open before V3 planning. |
| OI-06 | Apportionment basis for per-vehicle revenue in the profitability report where a student changes vehicle mid-year. | Apportioned by month of assignment | Before finance reporting build |
| OI-07 | Whether the subscription charge is based on vehicles registered or vehicles that operated at least one trip in the period. | Vehicles operating at least one trip | Before billing build |
| OI-08 | Retention and deletion procedure for Student records after enrolment ends. | Pseudonymised after retention period per FR-KVK-040 | Before first academic year end |
| OI-09 | Whether the Driver may operate the application on a personal device, and the resulting data-protection position. | Permitted; company policy responsibility | Before pilot |
| OI-10 | Behaviour where a Guardian declares absence for a Student who has already boarded. | Declaration rejected; Admin notified | Before absence module build |

---

# 9. Glossary

See Section 1.3.

---

## Appendix A — Requirement Traceability Template

Every requirement shall be traced through design and verification. The following table shall be maintained and completed during implementation.

| Requirement ID | Design element (SDD ref.) | Implementing module | Test case ID | Status |
|---|---|---|---|---|
| FR-AUTH-010 | | | | |
| FR-AUTH-020 | | | | |
| … | | | | |

**Rule:** no requirement may be closed without an associated passing test case. Any design element with no originating requirement indicates either unrequested work or a gap in this specification, and shall be reconciled.

## Appendix B — Suggested Implementation Sequence

This sequence reflects dependency order, not priority. All items are V1.

| Phase | Contents | Rationale |
|---|---|---|
| 1 | Tenancy, authentication, roles, audit log, feature flags | Everything else depends on these; retrofitting tenancy or audit is not feasible |
| 2 | Company configuration: schools, vehicles, staff, students, guardians, addresses, bulk import | The Admin can begin entering real data |
| 3 | Fee plans, instalments, payment recording, expenses, financial reports | Delivers the business value the customer uses first |
| 4 | Route templates, daily generation, optimisation, route sheet export | Operationally usable on paper before the mobile applications exist |
| 5 | Driver and Host applications: trip lifecycle, attendance, sweep check, offline queue | Safety-critical; requires the most testing |
| 6 | Location tracking and Guardian application | Depends on trips being executed digitally |
| 7 | Notifications | Depends on the events emitted by phases 5 and 6 |
| 8 | Leads, dashboard, remaining reports | Lowest dependency, highest tolerance for late delivery |
| 9 | Sysadmin console, subscription lifecycle | Required before onboarding a second customer |

Phases 2 and 3 constitute the administrative panel the business will use first. Feature flags (FR-FLG-010) permit the mobile roles to remain disabled until phases 5 to 7 are complete.

---

*End of document.*
