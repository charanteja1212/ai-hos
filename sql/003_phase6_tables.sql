-- =============================================================================
-- AI-HOS Phase 6: Missing Tables + Seed Data
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- ─── 1. Platform Settings (key-value global config) ──────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_settings IS 'Global platform config. key="global" stores all settings as JSONB.';

-- Insert default settings
INSERT INTO platform_settings (key, value) VALUES (
  'global',
  '{
    "platform_name": "AI-HOS",
    "support_email": "",
    "default_timezone": "Asia/Kolkata",
    "default_currency": "INR",
    "default_consultation_fee": 200,
    "max_booking_days_ahead": 7,
    "slot_lock_minutes": 5,
    "require_payment_before_confirm": true,
    "enable_whatsapp_reminders": true,
    "enable_email_reminders": false,
    "reminder_hours_before": 2,
    "maintenance_mode": false
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ─── 2. User Credentials (auth mapping for password/email login) ─────────────
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  tenant_id TEXT REFERENCES tenants(tenant_id),
  client_id TEXT REFERENCES clients(client_id),
  user_role TEXT NOT NULL,
  user_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_creds_email ON user_credentials(email);
CREATE INDEX IF NOT EXISTS idx_user_creds_tenant ON user_credentials(tenant_id);

COMMENT ON TABLE user_credentials IS 'Maps email → tenant/role/name for NextAuth password login. Password stored in Supabase Auth.';

-- ─── 3. Prescription Templates (doctor reusable templates) ───────────────────
CREATE TABLE IF NOT EXISTS prescription_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  diagnosis TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rx_templates_doctor ON prescription_templates(doctor_id, tenant_id);

COMMENT ON TABLE prescription_templates IS 'Doctor-saved prescription templates with medicine items JSONB.';

-- ─── 4. Lab Tests (master catalog — if not already created) ──────────────────
CREATE TABLE IF NOT EXISTS lab_tests (
  test_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  normal_range TEXT,
  unit TEXT,
  sample_type TEXT,
  turnaround_hours INTEGER DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_tests_tenant ON lab_tests(tenant_id);

-- ─── 5. Notifications table (if not already created) ─────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  target_role TEXT,
  target_user_id TEXT,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_id TEXT,
  reference_type TEXT,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_role ON notifications(tenant_id, target_role, is_read, created_at DESC);

-- ─── 6. Ensure client_configs exists (from 002 migration) ───────────────────
-- This is idempotent — will skip if already created
CREATE TABLE IF NOT EXISTS client_configs (
  client_id TEXT PRIMARY KEY REFERENCES clients(client_id),
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'medium', 'enterprise')),
  subdomain TEXT UNIQUE,
  features JSONB NOT NULL DEFAULT '{
    "whatsapp_bot": true,
    "multi_language": false,
    "lab_module": false,
    "pharmacy_module": false,
    "ipd_module": false,
    "multi_branch": false,
    "gpt4_clinical": false,
    "whisper_voice_rx": false,
    "predictive_noshow": false,
    "revenue_leak_detector": false,
    "telemedicine": false,
    "abdm_integration": false,
    "iot_gateway": false,
    "white_label": false,
    "ai_agents": false
  }'::jsonb,
  limits JSONB NOT NULL DEFAULT '{
    "max_doctors": 3,
    "max_branches": 1,
    "max_staff": 5,
    "max_patients": 500,
    "max_appointments_per_day": 50
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. Ensure audit_logs exists ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  client_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_email TEXT,
  actor_role TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- ─── 8. Add missing columns to existing tables (safe — uses IF NOT EXISTS) ──

-- Tenants: ensure ward_beds column exists
DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ward_beds JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Tenants: ensure logo_url column exists
DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Clients: ensure client_id column exists for FK
DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_pin TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── 9. Disable RLS on new tables (matching existing convention) ─────────────
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_public" ON platform_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_credentials_public" ON user_credentials FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE prescription_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_templates_public" ON prescription_templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_public" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ─── 10. Storage bucket for logos ────────────────────────────────────────────
-- Run this in Supabase Dashboard → Storage → New Bucket:
-- Name: logos
-- Public: true
-- Allowed MIME types: image/png, image/jpeg, image/webp, image/svg+xml
-- Max file size: 2MB

-- =============================================================================
-- VERIFICATION: Run these queries to confirm all tables exist
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
