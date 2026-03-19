-- ============================================================================
-- Migration: Record versioning for medical data
-- When a prescription, clinical note, or vital is updated,
-- the old version is saved to a history table.
-- ============================================================================

-- Generic record history table
CREATE TABLE IF NOT EXISTS record_versions (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT,
  tenant_id TEXT NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_record_versions_lookup
  ON record_versions (table_name, record_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_tenant
  ON record_versions (tenant_id, changed_at DESC);

-- RLS on record_versions
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY record_versions_tenant_read ON record_versions
  FOR SELECT USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
    OR current_setting('role', true) = 'service_role'
  );

CREATE POLICY record_versions_service_write ON record_versions
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Trigger function to auto-version records on UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_version_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only version if data actually changed (ignore metadata-only updates)
  IF OLD IS DISTINCT FROM NEW THEN
    INSERT INTO record_versions (
      table_name,
      record_id,
      version_number,
      data,
      changed_by,
      tenant_id
    ) VALUES (
      TG_TABLE_NAME,
      -- Use the first column as record_id (typically the PK)
      COALESCE(OLD.booking_id, OLD.prescription_id, OLD.id::text, 'unknown'),
      COALESCE(
        (SELECT MAX(version_number) + 1 FROM record_versions
         WHERE table_name = TG_TABLE_NAME
         AND record_id = COALESCE(OLD.booking_id, OLD.prescription_id, OLD.id::text, 'unknown')
         AND tenant_id = OLD.tenant_id),
        1
      ),
      row_to_json(OLD)::jsonb,
      current_setting('request.jwt.claims', true)::json ->> 'email',
      OLD.tenant_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Attach versioning triggers to medical tables
-- ============================================================================

-- Prescriptions: track all changes
DROP TRIGGER IF EXISTS trg_version_prescriptions ON prescriptions;
CREATE TRIGGER trg_version_prescriptions
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();

-- Clinical notes: track all changes
DROP TRIGGER IF EXISTS trg_version_clinical_notes ON clinical_notes;
CREATE TRIGGER trg_version_clinical_notes
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();

-- Vitals: track corrections
DROP TRIGGER IF EXISTS trg_version_vitals ON vitals;
CREATE TRIGGER trg_version_vitals
  BEFORE UPDATE ON vitals
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();

-- Appointments: track status changes and reschedules
DROP TRIGGER IF EXISTS trg_version_appointments ON appointments;
CREATE TRIGGER trg_version_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();

-- Lab orders: track result updates
DROP TRIGGER IF EXISTS trg_version_lab_orders ON lab_orders;
CREATE TRIGGER trg_version_lab_orders
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();

-- Admissions: track all IPD changes
DROP TRIGGER IF EXISTS trg_version_admissions ON admissions;
CREATE TRIGGER trg_version_admissions
  BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION fn_version_record();
