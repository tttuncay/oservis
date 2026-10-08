-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 007
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
