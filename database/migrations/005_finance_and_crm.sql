-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Migration 005
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

-- 4. Payments (Tahsilat / Ödemeler - Append Only)
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

-- 5. Expenses (Giderler - Araç, Yakıt, Bakım vb.)
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

-- 6. Leads (CRM - Potansiyel Müşteriler)
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
