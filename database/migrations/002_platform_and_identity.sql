-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 002
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
