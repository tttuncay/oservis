-- =====================================================================================
-- Oservis — Supabase & PostgreSQL Seed Data
-- Local & Development Initial Seed
-- =====================================================================================

-- 1. Create Default Subscription Plan
INSERT INTO subscription_plans (id, name, tiers, currency)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Standart Plan',
    '[{"minVehicles": 1, "maxVehicles": 10, "pricePerVehicle": "500.00"}]'::jsonb,
    'TRY'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create Demo Tenant
INSERT INTO tenants (id, legal_name, tax_no, status, timezone, plan_id, public_slug)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Güneş Turizm ve Öğrenci Servisleri Ltd. Şti.',
    '1234567890',
    'ACTIVE',
    'Europe/Istanbul',
    '00000000-0000-0000-0000-000000000001',
    'gunes-turizm'
) ON CONFLICT (id) DO NOTHING;

-- 3. Create Users
-- Sysadmin User (password: Password123!)
INSERT INTO users (id, full_name, phone_e164, email, password_hash, phone_verified, status, platform_role)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Sistem Yöneticisi',
    '+905550000001',
    'sysadmin@oservis.com',
    '$argon2id$v=19$m=65536,t=3,p=4$4iUo7Z2...demoHash',
    TRUE,
    'ACTIVE',
    'SYSADMIN'
) ON CONFLICT (id) DO NOTHING;

-- Tenant Admin User
INSERT INTO users (id, full_name, phone_e164, email, password_hash, phone_verified, status)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Ahmet Şirket Yöneticisi',
    '+905550000002',
    'admin@gunesturizm.com',
    '$argon2id$v=19$m=65536,t=3,p=4$4iUo7Z2...demoHash',
    TRUE,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Driver User
INSERT INTO users (id, full_name, phone_e164, email, password_hash, phone_verified, status)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Mehmet Şoför',
    '+905550000003',
    'sofor@gunesturizm.com',
    '$argon2id$v=19$m=65536,t=3,p=4$4iUo7Z2...demoHash',
    TRUE,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Guardian (Parent) User
INSERT INTO users (id, full_name, phone_e164, email, password_hash, phone_verified, status)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Ayşe Veli',
    '+905550000004',
    'ayse.veli@gmail.com',
    '$argon2id$v=19$m=65536,t=3,p=4$4iUo7Z2...demoHash',
    TRUE,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 4. User Tenant Roles (Memberships)
INSERT INTO user_tenant_roles (id, user_id, tenant_id, role, status)
VALUES 
    ('10000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'ADMIN', 'ACTIVE'),
    ('10000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'DRIVER', 'ACTIVE'),
    ('10000000-0000-0000-0000-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'PARENT', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 5. Set Tenant Context to insert Tenant-Scoped Seed Data
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';

-- School (Kadıköy Atatürk İlkokulu)
INSERT INTO schools (id, tenant_id, name, geo, address_text, morning_start_time, afternoon_dismissal_time)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Kadıköy Atatürk İlkokulu',
    ST_SetSRID(ST_MakePoint(29.0250, 40.9900), 4326)::geography,
    'Caferağa Mah. Moda Cad. No:10 Kadıköy/İstanbul',
    '08:30:00',
    '15:30:00'
) ON CONFLICT (id) DO NOTHING;

-- Vehicle (34 ABC 123)
INSERT INTO vehicles (id, tenant_id, plate, capacity, make_model, status)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '34ABC123',
    16,
    'Mercedes-Benz Sprinter 2023',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Staff (Driver)
INSERT INTO staff (id, tenant_id, user_id, kind, full_name, phone_e164, licence_no, status)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'DRIVER',
    'Mehmet Şoför',
    '+905550000003',
    'D1234567',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Vehicle Assignment
INSERT INTO vehicle_assignments (id, tenant_id, vehicle_id, driver_id, valid_from)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '2026-09-01'
) ON CONFLICT (id) DO NOTHING;

-- Student (Can Yılmaz)
INSERT INTO students (id, tenant_id, full_name, date_of_birth, school_id, class_name, status)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'Can Yılmaz',
    '2018-05-15',
    '22222222-2222-2222-2222-222222222222',
    '2-A',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Address (Can Yılmaz Ev Adresi)
INSERT INTO addresses (id, tenant_id, student_id, type, label, address_text, geo, geo_status)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '66666666-6666-6666-6666-666666666666',
    'HOME',
    'Ev',
    'Rasimpaşa Mah. Rıhtım Cad. No:4 Kadıköy/İstanbul',
    ST_SetSRID(ST_MakePoint(29.0230, 40.9950), 4326)::geography,
    'RESOLVED'
) ON CONFLICT (id) DO NOTHING;

-- Guardian Link
INSERT INTO guardian_links (id, tenant_id, student_id, user_id, relationship, is_primary)
VALUES (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    '66666666-6666-6666-6666-666666666666',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'ANNE',
    TRUE
) ON CONFLICT (id) DO NOTHING;
