-- Live Agent Handoff Chat Sessions
-- Tracks conversations escalated from WhatsApp bot to human reception staff

CREATE TABLE IF NOT EXISTS live_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  patient_name TEXT,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  assigned_to TEXT,  -- staff user who picked up the chat
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_chats_tenant_status ON live_chats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_live_chats_phone ON live_chats(phone, tenant_id);

-- RLS
ALTER TABLE live_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON live_chats
  USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id')
  WITH CHECK (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');
CREATE POLICY "Service role full access" ON live_chats
  USING (current_setting('role', true) = 'service_role');

-- Enable realtime for live_chats
ALTER PUBLICATION supabase_realtime ADD TABLE live_chats;
