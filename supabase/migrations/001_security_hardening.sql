-- ============================================
-- SECURITY HARDENING MIGRATION
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================

-- ============================================
-- 1. UNIQUE CONSTRAINT: Prevent duplicate queue numbers
-- ============================================
-- First check for existing duplicates:
-- SELECT tenant_id, date, queue_number, COUNT(*)
-- FROM queue_entries
-- GROUP BY tenant_id, date, queue_number
-- HAVING COUNT(*) > 1;
--
-- If duplicates exist, fix them first by updating queue_numbers,
-- then run the constraint:

CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_number
  ON queue_entries(tenant_id, date, queue_number);

-- ============================================
-- 2. UNIQUE CONSTRAINT: Prevent double bookings
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
  ON appointments(doctor_id, date, time)
  WHERE status = 'confirmed';

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
-- service_role key bypasses RLS by default.
-- The app uses a custom JWT (role: "authenticated") for browser clients,
-- signed with SUPABASE_JWT_SECRET containing tenant_id + user_role claims.
-- Policies below allow both service_role AND authenticated users,
-- with tenant isolation enforced via JWT claims.

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_passes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES
-- ============================================
-- Strategy:
--   - service_role: bypasses RLS automatically (no policy needed)
--   - authenticated (custom JWT): allowed with tenant_id isolation
--   - anon: only allowed on public tables (queue_entries, doctors, tenants)

-- ---- PUBLIC TABLES (anon + authenticated can READ) ----

-- Queue entries: public read for TV displays, write requires auth
CREATE POLICY queue_public_read ON queue_entries
  FOR SELECT USING (true);

CREATE POLICY queue_auth_write ON queue_entries
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY queue_auth_update ON queue_entries
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY queue_auth_delete ON queue_entries
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

-- Doctors: public read (queue pages, booking pages)
CREATE POLICY doctors_public_read ON doctors
  FOR SELECT USING (true);

CREATE POLICY doctors_auth_write ON doctors
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

-- Tenants: public read (login page hospital names)
CREATE POLICY tenants_public_read ON tenants
  FOR SELECT USING (true);

CREATE POLICY tenants_auth_write ON tenants
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- ---- TENANT-ISOLATED TABLES (authenticated with tenant_id match) ----

CREATE POLICY patients_tenant ON patients
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY appointments_tenant ON appointments
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY prescriptions_tenant ON prescriptions
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY lab_orders_tenant ON lab_orders
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY pharmacy_orders_tenant ON pharmacy_orders
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY staff_tenant ON staff
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY admissions_tenant ON admissions
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY notifications_tenant ON notifications
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY doctor_schedules_tenant ON doctor_schedules
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY date_overrides_tenant ON date_overrides
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY doctor_leave_tenant ON doctor_leave
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY reminders_tenant ON reminders
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY slot_locks_tenant ON slot_locks
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY dependents_tenant ON dependents
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

CREATE POLICY op_passes_tenant ON op_passes
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() ->> 'tenant_id')::text = tenant_id
  );

-- OTPs: no browser access needed (server-side only)
CREATE POLICY patient_otps_deny ON patient_otps
  FOR ALL USING (false);
-- service_role bypasses this, so server API routes still work

-- ============================================
-- 5. VERIFY
-- ============================================
-- Run this to confirm RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
