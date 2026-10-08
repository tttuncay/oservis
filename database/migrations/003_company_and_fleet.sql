-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 003
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
