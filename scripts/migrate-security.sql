-- ============================================================
-- AI-HOS Enterprise Multi-Tenant Security Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PHASE 1A: Add client_id column to ALL data tables
-- ============================================================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE lab_tests_master ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE op_passes ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE date_overrides ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE slot_locks ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE booking_events ADD COLUMN IF NOT EXISTS client_id TEXT;

-- ============================================================
-- PHASE 1B: Backfill client_id from tenants table
-- ============================================================

UPDATE patients p SET client_id = t.client_id FROM tenants t WHERE p.tenant_id = t.tenant_id AND p.client_id IS NULL;
UPDATE doctors d SET client_id = t.client_id FROM tenants t WHERE d.tenant_id = t.tenant_id AND d.client_id IS NULL;
UPDATE appointments a SET client_id = t.client_id FROM tenants t WHERE a.tenant_id = t.tenant_id AND a.client_id IS NULL;
UPDATE queue_entries q SET client_id = t.client_id FROM tenants t WHERE q.tenant_id = t.tenant_id AND q.client_id IS NULL;
UPDATE admissions a SET client_id = t.client_id FROM tenants t WHERE a.tenant_id = t.tenant_id AND a.client_id IS NULL;
UPDATE medicines m SET client_id = t.client_id FROM tenants t WHERE m.tenant_id = t.tenant_id AND m.client_id IS NULL;
UPDATE pharmacy_orders po SET client_id = t.client_id FROM tenants t WHERE po.tenant_id = t.tenant_id AND po.client_id IS NULL;
UPDATE lab_tests_master lt SET client_id = t.client_id FROM tenants t WHERE lt.tenant_id = t.tenant_id AND lt.client_id IS NULL;
UPDATE lab_orders lo SET client_id = t.client_id FROM tenants t WHERE lo.tenant_id = t.tenant_id AND lo.client_id IS NULL;
UPDATE invoices i SET client_id = t.client_id FROM tenants t WHERE i.tenant_id = t.tenant_id AND i.client_id IS NULL;
UPDATE op_passes op SET client_id = t.client_id FROM tenants t WHERE op.tenant_id = t.tenant_id AND op.client_id IS NULL;
UPDATE staff s SET client_id = t.client_id FROM tenants t WHERE s.tenant_id = t.tenant_id AND s.client_id IS NULL;
UPDATE prescriptions pr SET client_id = t.client_id FROM tenants t WHERE pr.tenant_id = t.tenant_id AND pr.client_id IS NULL;
UPDATE notifications n SET client_id = t.client_id FROM tenants t WHERE n.tenant_id = t.tenant_id AND n.client_id IS NULL;
UPDATE user_credentials uc SET client_id = t.client_id FROM tenants t WHERE uc.tenant_id = t.tenant_id AND uc.client_id IS NULL;
UPDATE doctor_schedules ds SET client_id = t.client_id FROM tenants t WHERE ds.tenant_id = t.tenant_id AND ds.client_id IS NULL;
UPDATE date_overrides dov SET client_id = t.client_id FROM tenants t WHERE dov.tenant_id = t.tenant_id AND dov.client_id IS NULL;
UPDATE chat_sessions cs SET client_id = t.client_id FROM tenants t WHERE cs.tenant_id = t.tenant_id AND cs.client_id IS NULL;
UPDATE slot_locks sl SET client_id = t.client_id FROM tenants t WHERE sl.tenant_id = t.tenant_id AND sl.client_id IS NULL;
UPDATE reminders r SET client_id = t.client_id FROM tenants t WHERE r.tenant_id = t.tenant_id AND r.client_id IS NULL;
UPDATE dependents dep SET client_id = t.client_id FROM tenants t WHERE dep.tenant_id = t.tenant_id AND dep.client_id IS NULL;
UPDATE booking_events be SET client_id = t.client_id FROM tenants t WHERE be.tenant_id = t.tenant_id AND be.client_id IS NULL;

-- ============================================================
-- PHASE 1C: Auto-injection trigger (auto-populate client_id)
-- ============================================================

CREATE OR REPLACE FUNCTION auto_set_client_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND (NEW.client_id IS NULL OR NEW.client_id = '') THEN
    SELECT client_id INTO NEW.client_id
    FROM tenants
    WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to all data tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'patients', 'doctors', 'appointments', 'queue_entries', 'admissions',
      'medicines', 'pharmacy_orders', 'lab_tests_master', 'lab_orders',
      'invoices', 'op_passes', 'staff', 'prescriptions', 'notifications',
      'user_credentials', 'doctor_schedules', 'date_overrides', 'chat_sessions',
      'slot_locks', 'reminders', 'dependents', 'booking_events'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_client_id ON %I; CREATE TRIGGER trg_auto_client_id BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION auto_set_client_id();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- PHASE 1D: Indexes for client_id queries
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'patients', 'doctors', 'appointments', 'queue_entries', 'admissions',
      'medicines', 'pharmacy_orders', 'lab_tests_master', 'lab_orders',
      'invoices', 'op_passes', 'staff', 'prescriptions', 'notifications',
      'user_credentials', 'doctor_schedules', 'date_overrides', 'chat_sessions',
      'slot_locks', 'reminders', 'dependents', 'booking_events'
    ])
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_client_id ON %I(client_id)', tbl, tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant_client ON %I(tenant_id, client_id)', tbl, tbl);
  END LOOP;
END;
$$;

-- ============================================================
-- PHASE 1E: WhatsApp config columns on tenants
-- ============================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_display_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_api_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bot_languages TEXT[] DEFAULT ARRAY['en','hi','te'];
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS greeting_message TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_phone_id
  ON tenants(whatsapp_phone_id)
  WHERE whatsapp_phone_id IS NOT NULL AND status = 'active';

-- Unique constraint: no two tenants share the same WhatsApp phone_number_id
DO $$
BEGIN
  ALTER TABLE tenants ADD CONSTRAINT uq_tenants_whatsapp_phone_id UNIQUE (whatsapp_phone_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint uq_tenants_whatsapp_phone_id already exists';
END;
$$;

-- Backfill T001 WhatsApp config
UPDATE tenants SET
  whatsapp_display_name = 'Advera',
  whatsapp_verified = true,
  wa_api_url = 'https://graph.facebook.com/v21.0/991831654013001/messages',
  bot_languages = ARRAY['en','hi','te']
WHERE tenant_id = 'T001'
  AND whatsapp_display_name IS NULL;

-- ============================================================
-- PHASE 2: RLS Policies
-- ============================================================
-- NOTE: RLS uses auth.jwt() claims from custom Supabase JWT.
-- The JWT contains: tenant_id, client_id, user_role
-- service_role key (n8n, server API routes) bypasses RLS automatically.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'patients', 'doctors', 'appointments', 'queue_entries', 'admissions',
      'medicines', 'pharmacy_orders', 'lab_tests_master', 'lab_orders',
      'invoices', 'op_passes', 'staff', 'prescriptions', 'notifications',
      'user_credentials', 'doctor_schedules', 'date_overrides', 'chat_sessions',
      'slot_locks', 'reminders', 'dependents', 'booking_events'
    ])
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policies to avoid conflicts
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "client_admin_select" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_select" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete" ON %I', tbl);

    -- SELECT: Branch staff can see only their tenant's data
    EXECUTE format(
      'CREATE POLICY "tenant_select" ON %I FOR SELECT USING (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::text
      )', tbl
    );

    -- SELECT: Client admin can see all tenants within their client
    EXECUTE format(
      'CREATE POLICY "client_admin_select" ON %I FOR SELECT USING (
        client_id = (auth.jwt() ->> ''client_id'')::text
        AND (auth.jwt() ->> ''user_role'')::text = ''CLIENT_ADMIN''
      )', tbl
    );

    -- SELECT: Super admin sees everything
    EXECUTE format(
      'CREATE POLICY "super_admin_select" ON %I FOR SELECT USING (
        (auth.jwt() ->> ''user_role'')::text = ''SUPER_ADMIN''
      )', tbl
    );

    -- INSERT: Only into own tenant
    EXECUTE format(
      'CREATE POLICY "tenant_insert" ON %I FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::text
        OR (auth.jwt() ->> ''user_role'')::text IN (''SUPER_ADMIN'', ''CLIENT_ADMIN'')
      )', tbl
    );

    -- UPDATE: Only own tenant (or super/client admin)
    EXECUTE format(
      'CREATE POLICY "tenant_update" ON %I FOR UPDATE USING (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::text
        OR (auth.jwt() ->> ''user_role'')::text IN (''SUPER_ADMIN'', ''CLIENT_ADMIN'')
      )', tbl
    );

    -- DELETE: Only super admin or client admin
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON %I FOR DELETE USING (
        (auth.jwt() ->> ''user_role'')::text IN (''SUPER_ADMIN'', ''CLIENT_ADMIN'')
      )', tbl
    );
  END LOOP;
END;
$$;

-- Special RLS for tenants table (config table, not data table)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_own_select" ON tenants;
DROP POLICY IF EXISTS "client_admin_tenant_select" ON tenants;
DROP POLICY IF EXISTS "super_admin_tenant_select" ON tenants;
DROP POLICY IF EXISTS "super_admin_tenant_modify" ON tenants;

CREATE POLICY "tenant_own_select" ON tenants FOR SELECT USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::text
);
CREATE POLICY "client_admin_tenant_select" ON tenants FOR SELECT USING (
  client_id = (auth.jwt() ->> 'client_id')::text
  AND (auth.jwt() ->> 'user_role')::text = 'CLIENT_ADMIN'
);
CREATE POLICY "super_admin_tenant_select" ON tenants FOR SELECT USING (
  (auth.jwt() ->> 'user_role')::text = 'SUPER_ADMIN'
);
CREATE POLICY "super_admin_tenant_modify" ON tenants FOR ALL USING (
  (auth.jwt() ->> 'user_role')::text = 'SUPER_ADMIN'
);

-- Special RLS for clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_admin_own_select" ON clients;
DROP POLICY IF EXISTS "super_admin_clients_all" ON clients;

CREATE POLICY "client_admin_own_select" ON clients FOR SELECT USING (
  client_id = (auth.jwt() ->> 'client_id')::text
);
CREATE POLICY "super_admin_clients_all" ON clients FOR ALL USING (
  (auth.jwt() ->> 'user_role')::text = 'SUPER_ADMIN'
);

-- platform_admins: only super admin
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_platform" ON platform_admins;
CREATE POLICY "super_admin_platform" ON platform_admins FOR ALL USING (
  (auth.jwt() ->> 'user_role')::text = 'SUPER_ADMIN'
);

-- ============================================================
-- VERIFICATION: Check backfill completeness
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  cnt INTEGER;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'patients', 'doctors', 'appointments', 'queue_entries', 'admissions',
      'medicines', 'pharmacy_orders', 'lab_tests_master', 'lab_orders',
      'invoices', 'op_passes', 'staff', 'prescriptions', 'notifications',
      'doctor_schedules', 'date_overrides', 'reminders', 'dependents'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NOT NULL AND client_id IS NULL', tbl)
    INTO cnt;
    IF cnt > 0 THEN
      RAISE WARNING 'Table % has % rows with tenant_id but missing client_id', tbl, cnt;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migration verification complete';
END;
$$;
