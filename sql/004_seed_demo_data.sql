-- =============================================================================
-- AI-HOS Demo Seed Data
-- Run AFTER 003_phase6_tables.sql
-- Creates: 1 client (Care Hospital), 1 branch (T001), 2 doctors, demo patients
-- =============================================================================

-- ─── 1. Demo Client ─────────────────────────────────────────────────────────
INSERT INTO clients (client_id, name, slug, subscription_plan, status, max_branches, admin_pin, created_at)
VALUES ('CL001', 'Care Hospital Group', 'care-hospital', 'enterprise', 'active', 5, '1234', NOW())
ON CONFLICT (client_id) DO NOTHING;

-- ─── 2. Client Config (enterprise tier) ─────────────────────────────────────
INSERT INTO client_configs (client_id, tier, features, limits)
VALUES (
  'CL001',
  'enterprise',
  '{
    "whatsapp_bot": true, "multi_language": true, "lab_module": true,
    "pharmacy_module": true, "ipd_module": true, "multi_branch": true,
    "gpt4_clinical": true, "whisper_voice_rx": true, "predictive_noshow": true,
    "revenue_leak_detector": true, "telemedicine": true, "abdm_integration": true,
    "iot_gateway": true, "white_label": true, "ai_agents": true
  }'::jsonb,
  '{
    "max_doctors": 999, "max_branches": 999, "max_staff": 999,
    "max_patients": 999999, "max_appointments_per_day": 9999
  }'::jsonb
) ON CONFLICT (client_id) DO NOTHING;

-- ─── 3. Demo Branch ─────────────────────────────────────────────────────────
INSERT INTO tenants (
  tenant_id, client_id, hospital_name, city, status,
  consultation_fee, admin_pin, reception_pin,
  timezone, currency, created_at
) VALUES (
  'T001', 'CL001', 'Care Hospital — Hyderabad', 'Hyderabad', 'active',
  200, '1234', '0000',
  'Asia/Kolkata', 'INR', NOW()
) ON CONFLICT (tenant_id) DO NOTHING;

-- ─── 4. Demo Doctors ────────────────────────────────────────────────────────
INSERT INTO doctors (doctor_id, name, specialty, email, phone, pin, consultation_fee, status, tenant_id, client_id, is_active)
VALUES
  ('DOC001', 'Dr. Ramesh Kumar', 'General Medicine', 'ramesh@care.com', '9876543210', '1111', 200, 'available', 'T001', 'CL001', true),
  ('DOC002', 'Dr. Priya Sharma', 'Pediatrics', 'priya@care.com', '9876543211', '2222', 300, 'available', 'T001', 'CL001', true)
ON CONFLICT (doctor_id) DO NOTHING;

-- ─── 5. Doctor Schedules ────────────────────────────────────────────────────
-- Dr. Ramesh: Mon-Sat, 10:00 AM - 6:00 PM, 20 min slots
INSERT INTO doctor_schedules (doctor_id, tenant_id, day_of_week, start_time, end_time, slot_duration, buffer_before, buffer_after, is_active)
SELECT 'DOC001', 'T001', d, '10:00', '18:00', 20, 0, 0, true
FROM unnest(ARRAY[1,2,3,4,5,6]) AS d
ON CONFLICT DO NOTHING;

-- Dr. Priya: Mon-Fri, 9:00 AM - 5:00 PM, 15 min slots
INSERT INTO doctor_schedules (doctor_id, tenant_id, day_of_week, start_time, end_time, slot_duration, buffer_before, buffer_after, is_active)
SELECT 'DOC002', 'T001', d, '09:00', '17:00', 15, 0, 0, true
FROM unnest(ARRAY[1,2,3,4,5]) AS d
ON CONFLICT DO NOTHING;

-- ─── 6. Demo Staff ──────────────────────────────────────────────────────────
INSERT INTO staff (staff_id, name, email, phone, role, pin, status, tenant_id, client_id)
VALUES
  ('STF001', 'Admin User', 'admin@care.com', '9876543220', 'ADMIN', '1234', 'active', 'T001', 'CL001'),
  ('STF002', 'Reception Desk', 'reception@care.com', '9876543221', 'RECEPTION', '0000', 'active', 'T001', 'CL001'),
  ('STF003', 'Lab Tech', 'lab@care.com', '9876543222', 'LAB_TECH', '3333', 'active', 'T001', 'CL001'),
  ('STF004', 'Pharmacist', 'pharma@care.com', '9876543223', 'PHARMACIST', '4444', 'active', 'T001', 'CL001')
ON CONFLICT DO NOTHING;

-- ─── 7. User Credentials (for password login) ──────────────────────────────
-- NOTE: You must also create these users in Supabase Auth (Dashboard → Authentication → Users)
-- with matching emails and passwords before they can use password login.
INSERT INTO user_credentials (email, tenant_id, client_id, user_role, user_name)
VALUES
  ('admin@care.com', 'T001', 'CL001', 'ADMIN', 'Admin User'),
  ('reception@care.com', 'T001', 'CL001', 'RECEPTION', 'Reception Desk'),
  ('ramesh@care.com', 'T001', 'CL001', 'DOCTOR', 'Dr. Ramesh Kumar'),
  ('priya@care.com', 'T001', 'CL001', 'DOCTOR', 'Dr. Priya Sharma'),
  ('lab@care.com', 'T001', 'CL001', 'LAB_TECH', 'Lab Tech'),
  ('pharma@care.com', 'T001', 'CL001', 'PHARMACIST', 'Pharmacist')
ON CONFLICT (email) DO NOTHING;

-- ─── 8. Demo Patients ───────────────────────────────────────────────────────
INSERT INTO patients (phone, name, age, gender, email, tenant_id, client_id, visit_count)
VALUES
  ('919876500001', 'Rajesh Patel', 45, 'male', 'rajesh@example.com', 'T001', 'CL001', 3),
  ('919876500002', 'Anita Reddy', 32, 'female', 'anita@example.com', 'T001', 'CL001', 1),
  ('919876500003', 'Suresh Nair', 58, 'male', NULL, 'T001', 'CL001', 5),
  ('919876500004', 'Meena Devi', 28, 'female', 'meena@example.com', 'T001', 'CL001', 0),
  ('919876500005', 'Vikram Singh', 40, 'male', NULL, 'T001', 'CL001', 2)
ON CONFLICT (phone) DO NOTHING;

-- ─── 9. Super Admin credential ──────────────────────────────────────────────
INSERT INTO user_credentials (email, tenant_id, client_id, user_role, user_name)
VALUES ('cherryrock471@gmail.com', NULL, NULL, 'SUPER_ADMIN', 'Platform Admin')
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- DONE. Login with:
-- Super Admin: email=cherryrock471@gmail.com (password login via Supabase Auth)
-- Admin PIN:   tenant=T001, role=ADMIN, PIN=1234
-- Reception:   tenant=T001, role=RECEPTION, PIN=0000
-- Doctor:      tenant=T001, role=DOCTOR, ID=DOC001, PIN=1111
-- =============================================================================
