-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 001
-- Extensions and Global Enums
-- =====================================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Tenant & User Enums
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'READ_ONLY', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE role_type AS ENUM ('PARENT', 'DRIVER', 'HOST', 'ADMIN', 'SYSADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE otp_purpose AS ENUM ('PHONE_VERIFICATION', 'PASSWORD_RESET', 'HANDSHAKE_PHONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Geography & Routing Enums
DO $$ BEGIN
    CREATE TYPE address_type AS ENUM ('HOME', 'ALTERNATIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE geo_status AS ENUM ('PENDING', 'RESOLVED', 'FAILED', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE direction AS ENUM ('MORNING', 'AFTERNOON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Trip & Attendance Enums
DO $$ BEGIN
    CREATE TYPE trip_state AS ENUM ('PLANNED', 'STARTED', 'SWEEP_PENDING', 'FINISHED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stop_state AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE att_state AS ENUM (
        'PENDING', 
        'BOARDED', 
        'NO_SHOW', 
        'ABSENT_DECLARED', 
        'DROPPED_OFF', 
        'GUARDIAN_NO_SHOW', 
        'RETURNED_TO_SCHOOL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Finance Enums
DO $$ BEGIN
    CREATE TYPE inst_status AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 002
-- Platform and Identity Schema
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS "citext";

-- 1. Subscription Plans (Platform Scope)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tiers JSONB NOT NULL DEFAULT '[]',
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    archived_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

-- 2. Tenants (Platform Scope)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    tax_no VARCHAR(50),
    status tenant_status NOT NULL DEFAULT 'TRIAL',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/Istanbul',
    trial_ends_at TIMESTAMPTZ(6),
    grace_ends_at TIMESTAMPTZ(6),
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    read_only_since TIMESTAMPTZ(6),
    suspended_at TIMESTAMPTZ(6),
    settings JSONB NOT NULL DEFAULT '{}',
    public_slug VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 3. Users (Platform Scope Identity)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone_e164 VARCHAR(30) UNIQUE,
    email CITEXT UNIQUE,
    password_hash TEXT,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    locale VARCHAR(10) NOT NULL DEFAULT 'tr',
    platform_role role_type,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

-- 4. User Tenant Roles / Memberships
CREATE TABLE IF NOT EXISTS user_tenant_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role role_type NOT NULL,
    status user_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ(6),
    rejected_reason TEXT,
    rejected_at TIMESTAMPTZ(6),
    invited_at TIMESTAMPTZ(6),
    invite_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_user_tenant_role UNIQUE (user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_utr_tenant_status ON user_tenant_roles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_utr_user ON user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_utr_tenant_rejected ON user_tenant_roles(tenant_id, rejected_at);

-- 5. Social Identities (OAuth Google / Apple)
CREATE TABLE IF NOT EXISTS social_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('GOOGLE', 'APPLE')),
    provider_subject VARCHAR(255) NOT NULL,
    email_at_signup CITEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_social_provider_subject UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user ON social_identities(user_id);

-- 6. Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ(6) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_ip VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 7. OTP Challenges
CREATE TABLE IF NOT EXISTS otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone_e164 VARCHAR(30) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    purpose otp_purpose NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ(6) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_challenges(phone_e164, purpose);

-- 8. Feature Flags (Per-Tenant or Platform-Wide)
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_flag_key UNIQUE (tenant_id, key)
);
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 003
-- Company and Fleet Schema
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Schools
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    geo GEOGRAPHY(Point, 4326),
    address_text TEXT,
    morning_start_time TIME,
    afternoon_dismissal_time TIME,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_schools_tenant ON schools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schools_geo ON schools USING GIST(geo);

-- 2. School Calendar Exceptions (Holidays, Special Days)
CREATE TABLE IF NOT EXISTS school_calendar_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_school_exception_date UNIQUE (tenant_id, school_id, date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_tenant_date ON school_calendar_exceptions(tenant_id, date);

-- 3. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    capacity INT NOT NULL,
    make_model VARCHAR(100),
    inspection_due DATE,
    insurance_due DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6),
    CONSTRAINT uq_vehicle_plate UNIQUE (tenant_id, plate)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);

-- 4. Staff (Drivers & Hostesses)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    kind role_type NOT NULL CHECK (kind IN ('DRIVER', 'HOST')),
    full_name VARCHAR(255) NOT NULL,
    phone_e164 VARCHAR(30),
    licence_no VARCHAR(50),
    licence_expiry DATE,
    record_cert_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_staff_tenant_kind ON staff(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);

-- 5. Vehicle Assignments (Historical & Date Bounded)
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    host_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant_driver ON vehicle_assignments(tenant_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tenant_vehicle_dates ON vehicle_assignments(tenant_id, vehicle_id, valid_from);

-- 6. Students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    class_name VARCHAR(50),
    photo_key VARCHAR(500),
    medical_note TEXT,
    external_ref VARCHAR(100),
    import_dedupe_key VARCHAR(255),
    import_batch_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    lead_id UUID,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_students_tenant_school ON students(tenant_id, school_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON students(tenant_id, status);

-- 7. Addresses
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type address_type NOT NULL DEFAULT 'HOME',
    label VARCHAR(100),
    address_text TEXT NOT NULL,
    geo GEOGRAPHY(Point, 4326),
    geo_status geo_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_addresses_tenant_student ON addresses(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_addresses_geo ON addresses USING GIST(geo);

-- 8. Guardian Links
CREATE TABLE IF NOT EXISTS guardian_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_emergency_contact BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_guardian_student_user UNIQUE (tenant_id, student_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_user ON guardian_links(user_id);

-- 9. Route Templates
CREATE TABLE IF NOT EXISTS route_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    host_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    direction direction NOT NULL,
    planned_start_time TIME,
    planned_end_time TIME,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_route_templates_tenant ON route_templates(tenant_id);

-- 10. Route Template Students (Stop Sequence)
CREATE TABLE IF NOT EXISTS route_template_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    route_template_id UUID NOT NULL REFERENCES route_templates(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    stop_order INT NOT NULL,
    estimated_pickup_time TIME,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_template_student UNIQUE (route_template_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_rts_tenant ON route_template_students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rts_template_order ON route_template_students(route_template_id, stop_order);
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 004
-- Routing, Absence and Trip Execution Schema
-- =====================================================================================

-- 1. Absence Declarations
CREATE TABLE IF NOT EXISTS absence_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    declared_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    direction direction,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_absences_tenant_dates ON absence_declarations(tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_student ON absence_declarations(student_id);

-- 2. Trips
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES route_templates(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    host_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL,
    direction direction NOT NULL,
    state trip_state NOT NULL DEFAULT 'PLANNED',
    planned_start_time TIME,
    planned_end_time TIME,
    started_at TIMESTAMPTZ(6),
    started_by UUID,
    start_geo GEOGRAPHY(Point, 4326),
    start_override_reason TEXT,
    finished_at TIMESTAMPTZ(6),
    finished_by UUID,
    cancelled_at TIMESTAMPTZ(6),
    cancelled_by UUID,
    cancel_reason TEXT,
    sweep_pending_at TIMESTAMPTZ(6),
    sweep_alerted_at TIMESTAMPTZ(6),
    overdue_alerted_at TIMESTAMPTZ(6),
    signal_lost_alerted_at TIMESTAMPTZ(6),
    attendance_purged_at TIMESTAMPTZ(6),
    actual_distance_m INT,
    retrospective BOOLEAN NOT NULL DEFAULT FALSE,
    order_locked BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason VARCHAR(100),
    warnings JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_trip_template_date UNIQUE (template_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_trips_tenant_date_state ON trips(tenant_id, service_date DESC, state);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_direction_date ON trips(vehicle_id, direction, service_date);
CREATE INDEX IF NOT EXISTS idx_trips_tenant_vehicle_date ON trips(tenant_id, vehicle_id, service_date DESC);

-- 3. Trip Stops
CREATE TABLE IF NOT EXISTS trip_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    geo GEOGRAPHY(Point, 4326) NOT NULL,
    label VARCHAR(255),
    anchor_key VARCHAR(100),
    is_school BOOLEAN NOT NULL DEFAULT FALSE,
    is_adhoc BOOLEAN NOT NULL DEFAULT FALSE,
    state stop_state NOT NULL DEFAULT 'PENDING',
    eta TIMESTAMPTZ(6),
    leg_distance_m INT,
    leg_duration_s INT,
    dwell_s INT NOT NULL DEFAULT 0,
    arrived_at TIMESTAMPTZ(6),
    arrived_by UUID,
    arrival_source VARCHAR(50),
    departed_at TIMESTAMPTZ(6),
    completed_at TIMESTAMPTZ(6),
    completed_by UUID,
    skipped_by UUID,
    skip_reason VARCHAR(255),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_trip_stop_seq UNIQUE (trip_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_tenant_trip ON trip_stops(tenant_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_geo ON trip_stops USING GIST(geo);

-- 4. Trip Stop Students (Attendance Records)
CREATE TABLE IF NOT EXISTS trip_stop_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    status att_state NOT NULL DEFAULT 'PENDING',
    recorded_by UUID,
    recorded_at TIMESTAMPTZ(6),
    recorded_geo GEOGRAPHY(Point, 4326),
    recorded_offline BOOLEAN NOT NULL DEFAULT FALSE,
    client_event_id VARCHAR(100),
    boarded_at TIMESTAMPTZ(6),
    dropped_off_at TIMESTAMPTZ(6),
    undelivered_at TIMESTAMPTZ(6),
    returned_to_school_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_trip_stop_student UNIQUE (trip_stop_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tss_tenant_stop ON trip_stop_students(tenant_id, trip_stop_id);
CREATE INDEX IF NOT EXISTS idx_tss_tenant_student ON trip_stop_students(tenant_id, student_id);

-- 5. Sweep Checks (Child Safety Check - Append Only)
CREATE TABLE IF NOT EXISTS sweep_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geo GEOGRAPHY(Point, 4326),
    confirmed BOOLEAN NOT NULL CHECK (confirmed = TRUE),
    result VARCHAR(50) NOT NULL DEFAULT 'CLEAR',
    photo_key VARCHAR(500),
    recorded_offline BOOLEAN NOT NULL DEFAULT FALSE,
    client_event_id VARCHAR(100),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sweep_tenant ON sweep_checks(tenant_id);

-- 6. Trip Events (Audit & Offline Replay Log)
CREATE TABLE IF NOT EXISTS trip_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    client_event_id VARCHAR(100),
    occurred_at TIMESTAMPTZ(6) NOT NULL,
    received_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_trip_events_tenant_trip ON trip_events(tenant_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_events_client_event ON trip_events(client_event_id);

-- 7. Location Pings (Live GPS Tracking)
CREATE TABLE IF NOT EXISTS location_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geo GEOGRAPHY(Point, 4326) NOT NULL,
    speed_kmh NUMERIC(5,2),
    bearing NUMERIC(5,2),
    accuracy_m NUMERIC(6,2),
    recorded_at TIMESTAMPTZ(6) NOT NULL,
    received_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pings_tenant_trip_time ON location_pings(tenant_id, trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pings_geo ON location_pings USING GIST(geo);
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 005
-- Finance, Accounting (Append-Only) and CRM Schema
-- =====================================================================================

-- 1. Fee Plans (Pricing Templates)
CREATE TABLE IF NOT EXISTS fee_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    base_amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    instalment_count INT NOT NULL DEFAULT 1,
    sibling_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    one_way_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_fee_plans_tenant ON fee_plans(tenant_id);

-- 2. Student Fees (Contract & Agreed Price)
CREATE TABLE IF NOT EXISTS student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_plan_id UUID REFERENCES fee_plans(id) ON DELETE RESTRICT,
    agreed_amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    academic_year VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_student_academic_year UNIQUE (tenant_id, student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_fees_tenant ON student_fees(tenant_id);

-- 3. Instalments (Taksitler)
CREATE TABLE IF NOT EXISTS instalments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    status inst_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_instalment_seq UNIQUE (student_fee_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_instalments_tenant_due ON instalments(tenant_id, due_date, status);

-- 4. Payments (Tahsilat / Ã–demeler - Append Only)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instalment_id UUID REFERENCES instalments(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    payment_method VARCHAR(50) NOT NULL,
    reference_no VARCHAR(100),
    paid_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receipt_no VARCHAR(50),
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_of_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    reversal_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_student ON payments(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, paid_at DESC);

-- 5. Expenses (Giderler - AraÃ§, YakÄ±t, BakÄ±m vb.)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'TRY',
    expense_date DATE NOT NULL,
    invoice_no VARCHAR(100),
    description TEXT,
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_of_id UUID REFERENCES expenses(id) ON DELETE RESTRICT,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);

-- 6. Leads (CRM - Potansiyel MÃ¼ÅŸteriler)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_name VARCHAR(255) NOT NULL,
    phone_e164 VARCHAR(30) NOT NULL,
    student_name VARCHAR(255),
    school_name VARCHAR(255),
    address_text TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    source VARCHAR(50) NOT NULL DEFAULT 'WEB_FORM',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 006
-- Notifications, Device Tokens and Audit Logs
-- =====================================================================================

-- 1. Device Tokens (FCM & APNs Push Tokens)
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
    last_seen_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_device_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- 2. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_notification_pref UNIQUE (user_id, tenant_id, category)
);

-- 3. Notification Messages (Push, SMS, Email Dispatch History)
CREATE TABLE IF NOT EXISTS notification_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('PUSH', 'SMS', 'EMAIL')),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notification_messages(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notification_messages(tenant_id);

-- 4. Audit Logs (Immutable Security and Operational Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    changes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 5. Consent Acceptances (KVKK / Privacy Consents)
CREATE TABLE IF NOT EXISTS consent_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version VARCHAR(50) NOT NULL,
    accepted_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent TEXT,
    CONSTRAINT uq_user_policy_version UNIQUE (user_id, policy_version)
);
-- =====================================================================================
-- Oservis â€” Supabase & PostgreSQL Migration 007
-- Row-Level Security (RLS) Policies
-- =====================================================================================

-- 1. Unified Tenant Context Helper Function
-- Supports both:
--   a) .NET Backend EF Core: SET LOCAL app.tenant_id = '<uuid>'
--   b) Direct Supabase client: JWT app_metadata -> tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('app.tenant_id', true), '')::UUID,
        NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::UUID,
        NULLIF(auth.jwt() ->> 'tenant_id', '')::UUID
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Apply RLS & FORCE RLS to All Tenant-Scoped Tables

-- Schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_schools ON schools;
CREATE POLICY tenant_isolation_schools ON schools
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- School Calendar Exceptions
ALTER TABLE school_calendar_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_calendar_exceptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_exceptions ON school_calendar_exceptions;
CREATE POLICY tenant_isolation_exceptions ON school_calendar_exceptions
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_vehicles ON vehicles;
CREATE POLICY tenant_isolation_vehicles ON vehicles
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_staff ON staff;
CREATE POLICY tenant_isolation_staff ON staff
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Vehicle Assignments
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_assignments ON vehicle_assignments;
CREATE POLICY tenant_isolation_assignments ON vehicle_assignments
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_students ON students;
CREATE POLICY tenant_isolation_students ON students
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_addresses ON addresses;
CREATE POLICY tenant_isolation_addresses ON addresses
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Guardian Links
ALTER TABLE guardian_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_guardian_links ON guardian_links;
CREATE POLICY tenant_isolation_guardian_links ON guardian_links
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Route Templates
ALTER TABLE route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_route_templates ON route_templates;
CREATE POLICY tenant_isolation_route_templates ON route_templates
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Route Template Students
ALTER TABLE route_template_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_template_students FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_rts ON route_template_students;
CREATE POLICY tenant_isolation_rts ON route_template_students
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Absence Declarations
ALTER TABLE absence_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_declarations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_absences ON absence_declarations;
CREATE POLICY tenant_isolation_absences ON absence_declarations
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trips ON trips;
CREATE POLICY tenant_isolation_trips ON trips
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Trip Stops
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trip_stops ON trip_stops;
CREATE POLICY tenant_isolation_trip_stops ON trip_stops
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Trip Stop Students
ALTER TABLE trip_stop_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stop_students FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trip_stop_students ON trip_stop_students;
CREATE POLICY tenant_isolation_trip_stop_students ON trip_stop_students
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Sweep Checks
ALTER TABLE sweep_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sweep_checks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_sweep_checks ON sweep_checks;
CREATE POLICY tenant_isolation_sweep_checks ON sweep_checks
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Trip Events
ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trip_events ON trip_events;
CREATE POLICY tenant_isolation_trip_events ON trip_events
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Location Pings
ALTER TABLE location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_location_pings ON location_pings;
CREATE POLICY tenant_isolation_location_pings ON location_pings
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Fee Plans
ALTER TABLE fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fee_plans ON fee_plans;
CREATE POLICY tenant_isolation_fee_plans ON fee_plans
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Student Fees
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_student_fees ON student_fees;
CREATE POLICY tenant_isolation_student_fees ON student_fees
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Instalments
ALTER TABLE instalments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instalments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_instalments ON instalments;
CREATE POLICY tenant_isolation_instalments ON instalments
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_expenses ON expenses;
CREATE POLICY tenant_isolation_expenses ON expenses
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Notification Preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_notif_pref ON notification_preferences;
CREATE POLICY tenant_isolation_notif_pref ON notification_preferences
    FOR ALL USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
