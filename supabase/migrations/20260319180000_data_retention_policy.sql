-- ============================================================================
-- Migration: Data retention policy enforcement
-- Automated cleanup of expired data per retention schedule.
-- ============================================================================

-- ─── OTP Cleanup (expired OTPs — 5 minute TTL) ─────────────────────────────

CREATE OR REPLACE FUNCTION fn_cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM patient_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Slot Lock Cleanup (expired locks — 10 minute TTL) ─────────────────────

CREATE OR REPLACE FUNCTION fn_cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM slot_locks
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Audit Log Archival (older than 5 years) ───────────────────────────────

CREATE OR REPLACE FUNCTION fn_archive_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 5 years
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '5 years';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Notification Cleanup (read notifications older than 90 days) ───────────

CREATE OR REPLACE FUNCTION fn_cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
  AND created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Soft-Deleted Records Purge (purge after retention period) ──────────────

CREATE OR REPLACE FUNCTION fn_purge_soft_deleted(
  target_table TEXT,
  retention_interval INTERVAL
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  EXECUTE format(
    'DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - $1',
    target_table
  ) USING retention_interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Master Cleanup Function (call from scheduled job) ──────────────────────

CREATE OR REPLACE FUNCTION fn_run_retention_cleanup()
RETURNS TABLE (
  task TEXT,
  records_cleaned INTEGER
) AS $$
BEGIN
  -- OTPs (immediate cleanup)
  task := 'expired_otps';
  records_cleaned := fn_cleanup_expired_otps();
  RETURN NEXT;

  -- Slot locks (immediate cleanup)
  task := 'expired_locks';
  records_cleaned := fn_cleanup_expired_locks();
  RETURN NEXT;

  -- Old notifications (90 days)
  task := 'old_notifications';
  records_cleaned := fn_cleanup_old_notifications();
  RETURN NEXT;

  -- Audit logs (5 years)
  task := 'old_audit_logs';
  records_cleaned := fn_archive_old_audit_logs();
  RETURN NEXT;

  -- Soft-deleted appointments (3 years after deletion)
  task := 'purged_appointments';
  records_cleaned := fn_purge_soft_deleted('appointments', INTERVAL '3 years');
  RETURN NEXT;

  -- Soft-deleted feedback (2 years after deletion)
  task := 'purged_feedback';
  records_cleaned := fn_purge_soft_deleted('feedback', INTERVAL '2 years');
  RETURN NEXT;

  -- Note: Clinical records (prescriptions, vitals, clinical_notes, lab_orders)
  -- are NEVER auto-purged. They require manual review per DISHA regulations.

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Usage ──────────────────────────────────────────────────────────────────
-- Call from BullMQ cleanup job or pg_cron:
-- SELECT * FROM fn_run_retention_cleanup();
