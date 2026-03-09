-- =============================================================================
-- AI-HOS Phase 1: Security Hardening & Critical Indexes
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- 1. UNIQUE INDEX: Prevent double-booking (same doctor, same date+time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
ON appointments (doctor_id, date, time)
WHERE status = 'confirmed';

-- 2. UNIQUE INDEX: Prevent duplicate queue numbers per tenant per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_number
ON queue_entries (tenant_id, date, queue_number);

-- 3. UNIQUE INDEX: Prevent duplicate slot locks
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_lock
ON slot_locks (doctor_id, date, time);

-- 4. INDEX: Fast appointment lookups by patient phone
CREATE INDEX IF NOT EXISTS idx_appointments_patient_phone
ON appointments (patient_phone);

-- 5. INDEX: Fast appointment lookups by date + tenant
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date
ON appointments (tenant_id, date);

-- 6. INDEX: Fast queue lookups by date + tenant
CREATE INDEX IF NOT EXISTS idx_queue_tenant_date
ON queue_entries (tenant_id, date);

-- 7. INDEX: OTP cleanup/lookup
CREATE INDEX IF NOT EXISTS idx_patient_otps_phone_created
ON patient_otps (phone, created_at);

-- 8. INDEX: Doctor schedule lookups
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor
ON doctor_schedules (doctor_id, tenant_id);

-- 9. INDEX: Date overrides lookups
CREATE INDEX IF NOT EXISTS idx_date_overrides_doctor_date
ON date_overrides (doctor_id, date);

-- =============================================================================
-- RLS POLICIES — Enable Row Level Security on all tables
-- =============================================================================

-- Enable RLS on all tables (safe to run multiple times)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- These policies are for anon/authenticated roles (browser-side queries).

-- POLICY: Patients — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_patients" ON patients;
CREATE POLICY "tenant_isolation_patients" ON patients
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Appointments — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_appointments" ON appointments;
CREATE POLICY "tenant_isolation_appointments" ON appointments
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Doctors — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_doctors" ON doctors;
CREATE POLICY "tenant_isolation_doctors" ON doctors
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Queue entries — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_queue" ON queue_entries;
CREATE POLICY "tenant_isolation_queue" ON queue_entries
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Prescriptions — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_prescriptions" ON prescriptions;
CREATE POLICY "tenant_isolation_prescriptions" ON prescriptions
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Invoices — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_invoices" ON invoices;
CREATE POLICY "tenant_isolation_invoices" ON invoices
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Pharmacy orders — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_pharmacy" ON pharmacy_orders;
CREATE POLICY "tenant_isolation_pharmacy" ON pharmacy_orders
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Lab orders — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_lab" ON lab_orders;
CREATE POLICY "tenant_isolation_lab" ON lab_orders
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Admissions — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_admissions" ON admissions;
CREATE POLICY "tenant_isolation_admissions" ON admissions
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Staff — tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_staff" ON staff;
CREATE POLICY "tenant_isolation_staff" ON staff
  FOR ALL USING (
    tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- POLICY: Tenants — visible to all authenticated users (for branch switching)
DROP POLICY IF EXISTS "tenants_visible" ON tenants;
CREATE POLICY "tenants_visible" ON tenants
  FOR SELECT USING (true);

-- POLICY: Tenants — only service role can modify
DROP POLICY IF EXISTS "tenants_modify" ON tenants;
CREATE POLICY "tenants_modify" ON tenants
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  ) WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =============================================================================
-- pg_cron: Slot Lock Cleanup (every 2 minutes)
-- =============================================================================
-- Requires pg_cron extension enabled in Supabase Dashboard → Database → Extensions
SELECT cron.schedule(
  'cleanup-expired-slot-locks',
  '*/2 * * * *',
  $$DELETE FROM slot_locks WHERE locked_until < NOW()$$
);

-- =============================================================================
-- pg_cron: OP Pass Expiry Check (daily midnight IST = 18:30 UTC)
-- =============================================================================
SELECT cron.schedule(
  'expire-op-passes',
  '30 18 * * *',
  $$UPDATE op_passes SET status = 'expired' WHERE valid_until < NOW() AND status = 'active'$$
);

-- =============================================================================
-- pg_cron: Cleanup Expired Unpaid Bookings (every hour)
-- =============================================================================
SELECT cron.schedule(
  'cleanup-expired-unpaid',
  '0 * * * *',
  $$UPDATE appointments SET status = 'cancelled' WHERE status = 'pending_payment' AND created_at < NOW() - INTERVAL '2 hours'$$
);

-- =============================================================================
-- pg_cron: Cleanup Old OTPs (daily)
-- =============================================================================
SELECT cron.schedule(
  'cleanup-old-otps',
  '0 0 * * *',
  $$DELETE FROM patient_otps WHERE created_at < NOW() - INTERVAL '24 hours'$$
);
