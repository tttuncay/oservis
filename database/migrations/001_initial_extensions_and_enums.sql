-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 001
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
