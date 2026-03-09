-- Audit Logs table for tracking all sensitive operations
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,           -- create, update, delete, login, status_change
  entity_type TEXT NOT NULL,      -- patient, doctor, appointment, staff, tenant, invoice, admission
  entity_id TEXT NOT NULL,        -- ID of the affected entity
  actor_email TEXT NOT NULL,      -- who performed the action
  actor_role TEXT NOT NULL,       -- role of the actor
  tenant_id TEXT,                 -- which tenant this belongs to (NULL for platform-level)
  details JSONB,                  -- additional context (old values, new values, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs(actor_email);
