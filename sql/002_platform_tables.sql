-- =============================================================================
-- AI-HOS Phase 3: Platform Multi-Tenant Tables
-- These tables go in your PLATFORM (master) Supabase database
-- =============================================================================

-- Client configs — feature flags per client (upgrade = update this row)
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

-- WhatsApp phone routing — phone_number_id → client_id lookup
CREATE TABLE IF NOT EXISTS wa_phone_routing (
  phone_number_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(client_id),
  branch_id TEXT REFERENCES tenants(tenant_id),
  wa_access_token TEXT NOT NULL,
  wa_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_routing_client ON wa_phone_routing(client_id);

-- Client billing — track your revenue per client
CREATE TABLE IF NOT EXISTS client_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES clients(client_id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  razorpay_subscription_id TEXT,
  razorpay_payment_id TEXT,
  invoice_url TEXT,
  period_start DATE,
  period_end DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_client ON client_billing(client_id);

-- WhatsApp patient consent — TRAI compliance
CREATE TABLE IF NOT EXISTS wa_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  consented BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phone, tenant_id)
);

-- Audit logs — comprehensive action tracking
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

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_logs(client_id, created_at DESC);

-- Tier feature presets (for reference — used by onboarding script)
COMMENT ON TABLE client_configs IS 'Feature flags per client. Basic/Medium/Enterprise controlled via tier + features JSONB.
Basic: whatsapp_bot, max_doctors=3, max_branches=1
Medium: + lab, pharmacy, multi_branch(2), gpt4_clinical, whisper, predictive_noshow, max_doctors=15
Enterprise: + ipd, abdm, iot, white_label, unlimited branches, ai_agents, max_doctors=unlimited';

-- =============================================================================
-- Phone normalization — fix mixed 10/12-digit formats
-- Run AFTER backing up patients table
-- =============================================================================
-- STEP 1: Check for conflicts first (dry run)
-- SELECT phone, '91' || phone AS new_phone FROM patients WHERE LENGTH(phone) = 10
-- INTERSECT
-- SELECT phone, phone FROM patients WHERE LENGTH(phone) = 12;

-- STEP 2: If no conflicts, normalize
-- UPDATE patients SET phone = '91' || phone WHERE LENGTH(phone) = 10;
-- UPDATE appointments SET patient_phone = '91' || patient_phone WHERE LENGTH(patient_phone) = 10;
-- UPDATE prescriptions SET patient_phone = '91' || patient_phone WHERE LENGTH(patient_phone) = 10;
-- UPDATE dependents SET patient_phone = '91' || patient_phone WHERE LENGTH(patient_phone) = 10;
-- UPDATE op_passes SET patient_phone = '91' || patient_phone WHERE LENGTH(patient_phone) = 10;
-- UPDATE invoices SET patient_phone = '91' || patient_phone WHERE LENGTH(patient_phone) = 10;
