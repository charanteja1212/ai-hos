-- ============================================================================
-- Migration: Soft deletes + data integrity constraints
-- Purpose: Add deleted_at to all medical tables, add validation constraints
-- ============================================================================

-- ─── SOFT DELETES ───────────────────────────────────────────────────────────
-- Add deleted_at column to all medical/operational tables.
-- NULL = active, timestamp = soft-deleted.

-- Core patient data
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Appointments & booking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Clinical records
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Pharmacy
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Financial
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- IPD / Admissions
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Medical history
ALTER TABLE medical_conditions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Feedback
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ─── INDEXES FOR SOFT DELETES ───────────────────────────────────────────────
-- Partial indexes for active-only queries (WHERE deleted_at IS NULL)

CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (tenant_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_active ON appointments (tenant_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_active ON prescriptions (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lab_orders_active ON lab_orders (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_active ON invoices (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admissions_active ON admissions (tenant_id) WHERE deleted_at IS NULL;

-- ─── DATA INTEGRITY CONSTRAINTS ─────────────────────────────────────────────

-- Patients: name must not be empty
DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_name_not_empty
    CHECK (length(trim(COALESCE(name, ''))) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Doctors: name and specialty must not be empty
DO $$ BEGIN
  ALTER TABLE doctors ADD CONSTRAINT chk_doctors_name_not_empty
    CHECK (length(trim(COALESCE(name, ''))) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE doctors ADD CONSTRAINT chk_doctors_specialty_not_empty
    CHECK (length(trim(COALESCE(specialty, ''))) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Appointments: time format validation (HH:MM)
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_time_format
    CHECK (time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Appointments: date format validation (YYYY-MM-DD)
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_date_format
    CHECK (date ~ '^\d{4}-\d{2}-\d{2}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoices: total must be non-negative
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT chk_invoices_total_positive
    CHECK (total >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vitals: reasonable ranges
DO $$ BEGIN
  ALTER TABLE vitals ADD CONSTRAINT chk_vitals_bp_systolic_range
    CHECK (bp_systolic IS NULL OR (bp_systolic >= 50 AND bp_systolic <= 300));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE vitals ADD CONSTRAINT chk_vitals_bp_diastolic_range
    CHECK (bp_diastolic IS NULL OR (bp_diastolic >= 20 AND bp_diastolic <= 200));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE vitals ADD CONSTRAINT chk_vitals_temperature_range
    CHECK (temperature IS NULL OR (temperature >= 30 AND temperature <= 45));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE vitals ADD CONSTRAINT chk_vitals_pulse_range
    CHECK (pulse IS NULL OR (pulse >= 20 AND pulse <= 300));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE vitals ADD CONSTRAINT chk_vitals_spo2_range
    CHECK (spo2 IS NULL OR (spo2 >= 50 AND spo2 <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Staff: name must not be empty
DO $$ BEGIN
  ALTER TABLE staff ADD CONSTRAINT chk_staff_name_not_empty
    CHECK (length(trim(COALESCE(name, ''))) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── HELPER: Soft delete function ───────────────────────────────────────────
-- Instead of DELETE, call: SELECT soft_delete('patients', 'phone = ''1234'' AND tenant_id = ''T001''');

CREATE OR REPLACE FUNCTION soft_delete(
  table_name TEXT,
  condition TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW() WHERE %s AND deleted_at IS NULL',
    table_name, condition
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── HELPER: Restore soft-deleted record ────────────────────────────────────

CREATE OR REPLACE FUNCTION restore_deleted(
  table_name TEXT,
  condition TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE %s AND deleted_at IS NOT NULL',
    table_name, condition
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
