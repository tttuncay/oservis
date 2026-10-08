-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 004
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
