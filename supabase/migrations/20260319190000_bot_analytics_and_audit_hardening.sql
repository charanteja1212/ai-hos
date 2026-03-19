-- ============================================================================
-- Migration: WhatsApp bot analytics + Audit trail hardening
-- ============================================================================

-- ─── BOT ANALYTICS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_analytics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL, -- 'message_received', 'state_transition', 'action_completed', 'error', 'drop_off'
  from_state TEXT,
  to_state TEXT,
  action TEXT, -- 'book_appointment', 'cancel_appointment', etc.
  language TEXT DEFAULT 'en',
  message_length INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_bot_analytics_tenant_date
  ON bot_analytics (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_event
  ON bot_analytics (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_action
  ON bot_analytics (action, tenant_id) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bot_analytics_drop_off
  ON bot_analytics (event_type, from_state) WHERE event_type = 'drop_off';

-- RLS
ALTER TABLE bot_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_analytics_tenant_read ON bot_analytics
  FOR SELECT USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
    OR current_setting('role', true) = 'service_role'
  );

CREATE POLICY bot_analytics_service_insert ON bot_analytics
  FOR INSERT WITH CHECK (true);

-- ─── BOT ANALYTICS AGGREGATION VIEW ────────────────────────────────────────

CREATE OR REPLACE VIEW bot_analytics_daily AS
SELECT
  tenant_id,
  DATE(created_at AT TIME ZONE 'Asia/Kolkata') as date,
  COUNT(*) FILTER (WHERE event_type = 'message_received') as messages_received,
  COUNT(*) FILTER (WHERE event_type = 'action_completed') as actions_completed,
  COUNT(*) FILTER (WHERE event_type = 'drop_off') as drop_offs,
  COUNT(*) FILTER (WHERE event_type = 'error') as errors,
  COUNT(DISTINCT phone) as unique_users,
  AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_ms,
  -- Most popular actions
  MODE() WITHIN GROUP (ORDER BY action) FILTER (WHERE action IS NOT NULL) as top_action,
  -- Language distribution
  COUNT(*) FILTER (WHERE language = 'en') as english_messages,
  COUNT(*) FILTER (WHERE language = 'hi') as hindi_messages,
  COUNT(*) FILTER (WHERE language = 'te') as telugu_messages
FROM bot_analytics
GROUP BY tenant_id, DATE(created_at AT TIME ZONE 'Asia/Kolkata');

-- ─── DROP-OFF FUNNEL VIEW ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW bot_drop_off_funnel AS
SELECT
  tenant_id,
  from_state,
  to_state,
  COUNT(*) as transitions,
  COUNT(*) FILTER (WHERE event_type = 'drop_off') as drop_offs,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'drop_off')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) as drop_off_rate_pct
FROM bot_analytics
WHERE from_state IS NOT NULL
GROUP BY tenant_id, from_state, to_state
ORDER BY drop_offs DESC;

-- ─── AUDIT TRAIL HARDENING ─────────────────────────────────────────────────
-- Make critical actions fail if audit logging fails.

-- Add NOT NULL constraint on critical audit fields
ALTER TABLE audit_logs ALTER COLUMN action SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN entity_type SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN actor_email SET NOT NULL;

-- Add index for recent audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_recent
  ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id);

-- Function to log audit AND return success/failure
-- Use this instead of fire-and-forget for critical operations
CREATE OR REPLACE FUNCTION fn_audit_critical(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_actor_email TEXT,
  p_actor_role TEXT,
  p_tenant_id TEXT,
  p_details JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO audit_logs (
    action, entity_type, entity_id,
    actor_email, actor_role, tenant_id, details
  ) VALUES (
    p_action, p_entity_type, p_entity_id,
    p_actor_email, p_actor_role, p_tenant_id, p_details
  );
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Critical audit log failed: % - %', SQLERRM, p_action;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
