-- Fix notifications table: rename 'read' to 'is_read' (code expects is_read)
-- Also add missing columns that the TypeScript type expects

-- Rename read -> is_read
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Recreate index with correct column name
DROP INDEX IF EXISTS idx_notifications_tenant_role;
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_role
  ON notifications(tenant_id, target_role, is_read, created_at DESC);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- RLS policies (idempotent)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Tenant isolation'
  ) THEN
    CREATE POLICY "Tenant isolation" ON notifications
      USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id')
      WITH CHECK (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON notifications
      USING (current_setting('role', true) = 'service_role');
  END IF;
END $$;
