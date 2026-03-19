-- ============================================================================
-- Transaction Functions for Atomic Multi-Step Operations
-- Fixes HIGH severity data consistency issues identified in Phase 3 audit
-- ============================================================================

-- ─── 1. increment_visit_count (missing function called by booking service) ──

CREATE OR REPLACE FUNCTION increment_visit_count(p_phone TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE patients
  SET visit_count = COALESCE(visit_count, 0) + 1
  WHERE phone = p_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. fn_confirm_payment ─────────────────────────────────────────────────
-- Atomically: create OP pass + update appointment to paid + release slot lock
-- Called from payment/verify-checkout and payment/webhook routes

CREATE OR REPLACE FUNCTION fn_confirm_payment(
  p_booking_id      TEXT,
  p_payment_id      TEXT,
  p_op_pass_id      TEXT,
  p_patient_phone   TEXT,
  p_patient_name    TEXT,
  p_patient_type    TEXT DEFAULT 'SELF',
  p_dependent_id    TEXT DEFAULT NULL,
  p_issue_date      TEXT DEFAULT NULL,
  p_expiry_date     TEXT DEFAULT NULL,
  p_qr_code         TEXT DEFAULT NULL,
  p_booked_by       TEXT DEFAULT NULL,
  p_tenant_id       TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_appt RECORD;
  v_result JSONB;
BEGIN
  -- Check appointment exists and is not already paid
  SELECT booking_id, status, payment_status, tenant_id
  INTO v_appt
  FROM appointments
  WHERE booking_id = p_booking_id
  FOR UPDATE;  -- Row lock to prevent concurrent processing

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_appt.status = 'confirmed' AND v_appt.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Check OP pass doesn't already exist
  IF EXISTS (
    SELECT 1 FROM op_passes
    WHERE booking_id = p_booking_id AND status = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Step 1: Create OP Pass
  INSERT INTO op_passes (
    op_pass_id, booking_id, patient_phone, patient_name,
    patient_type, dependent_id, issue_date, expiry_date,
    status, qr_code, booked_by_whatsapp_number, tenant_id
  ) VALUES (
    p_op_pass_id, p_booking_id, p_patient_phone, p_patient_name,
    p_patient_type, p_dependent_id, p_issue_date, p_expiry_date,
    'ACTIVE', p_qr_code, p_booked_by, COALESCE(p_tenant_id, v_appt.tenant_id)
  );

  -- Step 2: Update appointment to confirmed + paid
  UPDATE appointments
  SET status = 'confirmed',
      payment_status = 'paid',
      payment_id = p_payment_id,
      razorpay_payment_id = p_payment_id,
      op_pass_id = p_op_pass_id
  WHERE booking_id = p_booking_id;

  -- Step 3: Release slot lock
  DELETE FROM slot_locks
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'op_pass_id', p_op_pass_id,
    'booking_id', p_booking_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Transaction auto-rolls back on exception
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 3. fn_book_appointment ────────────────────────────────────────────────
-- Atomically: upsert patient + insert appointment + release slot lock
-- The slot_lock is acquired separately (before this function) to hold the slot

CREATE OR REPLACE FUNCTION fn_book_appointment(
  p_booking_id        TEXT,
  p_tenant_id         TEXT,
  p_patient_phone     TEXT,
  p_patient_name      TEXT,
  p_patient_type      TEXT DEFAULT 'SELF',
  p_patient_age       INT DEFAULT NULL,
  p_patient_gender    TEXT DEFAULT NULL,
  p_doctor_id         TEXT DEFAULT NULL,
  p_doctor_name       TEXT DEFAULT NULL,
  p_specialty         TEXT DEFAULT NULL,
  p_date              TEXT DEFAULT NULL,
  p_time              TEXT DEFAULT NULL,
  p_source            TEXT DEFAULT 'dashboard',
  p_booked_by         TEXT DEFAULT NULL,
  p_dependent_id      TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_normalized_phone TEXT;
BEGIN
  v_normalized_phone := regexp_replace(p_patient_phone, '\D', '', 'g');

  -- Step 1: Upsert patient
  INSERT INTO patients (phone, name, tenant_id)
  VALUES (v_normalized_phone, p_patient_name, p_tenant_id)
  ON CONFLICT (phone) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, patients.name);

  -- Step 2: Insert appointment
  INSERT INTO appointments (
    booking_id, tenant_id, patient_phone, patient_name,
    patient_type, patient_age, doctor_id, doctor_name,
    specialty, date, time, status, source,
    booked_by_whatsapp_number, dependent_id
  ) VALUES (
    p_booking_id, p_tenant_id, v_normalized_phone, p_patient_name,
    p_patient_type, p_patient_age, p_doctor_id, p_doctor_name,
    p_specialty, p_date, p_time, 'confirmed', p_source,
    p_booked_by, p_dependent_id
  );

  -- Step 3: Release slot lock
  DELETE FROM slot_locks
  WHERE doctor_id = p_doctor_id
    AND slot_date = p_date
    AND slot_time = p_time;

  -- Step 4: Increment visit count (non-critical, still inside transaction)
  UPDATE patients
  SET visit_count = COALESCE(visit_count, 0) + 1
  WHERE phone = v_normalized_phone;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Double booking prevented. This slot is taken.',
    'code', '23505'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. fn_doctor_leave_cancel ─────────────────────────────────────────────
-- Atomically: insert date_override + cancel affected appointments
-- Returns list of affected booking IDs for notification (done outside DB)

CREATE OR REPLACE FUNCTION fn_doctor_leave_cancel(
  p_override_id   TEXT,
  p_doctor_id     TEXT,
  p_tenant_id     TEXT,
  p_date          TEXT,
  p_type          TEXT,       -- 'leave' or 'custom_hours'
  p_reason        TEXT DEFAULT NULL,
  p_start_time    TEXT DEFAULT NULL,
  p_end_time      TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cancelled_ids TEXT[];
  v_override RECORD;
BEGIN
  -- Step 1: Insert date override
  INSERT INTO date_overrides (
    override_id, doctor_id, tenant_id, override_date,
    reason, is_available, start_time, end_time
  ) VALUES (
    p_override_id, p_doctor_id, p_tenant_id, p_date,
    COALESCE(p_reason, CASE WHEN p_type = 'leave' THEN 'Personal' ELSE 'Custom hours' END),
    CASE WHEN p_type = 'custom_hours' THEN true ELSE false END,
    p_start_time, p_end_time
  );

  -- Step 2: Cancel affected appointments
  IF p_type = 'custom_hours' AND p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
    -- Only cancel appointments outside the custom hours window
    UPDATE appointments
    SET status = 'cancelled'
    WHERE doctor_id = p_doctor_id
      AND date = p_date
      AND tenant_id = p_tenant_id
      AND status = 'confirmed'
      AND (time < p_start_time OR time >= p_end_time)
    RETURNING booking_id INTO v_cancelled_ids;
  ELSE
    -- Full day leave — cancel all confirmed appointments
    UPDATE appointments
    SET status = 'cancelled'
    WHERE doctor_id = p_doctor_id
      AND date = p_date
      AND tenant_id = p_tenant_id
      AND status = 'confirmed'
    RETURNING booking_id INTO v_cancelled_ids;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'override_id', p_override_id,
    'cancelled_ids', COALESCE(to_jsonb(v_cancelled_ids), '[]'::jsonb),
    'cancelled_count', COALESCE(array_length(v_cancelled_ids, 1), 0)
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Leave already exists for this date'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. fn_create_client_with_config ───────────────────────────────────────
-- Atomically: insert client + upsert client_configs (MEDIUM severity fix)

CREATE OR REPLACE FUNCTION fn_create_client_with_config(
  p_client_id   TEXT,
  p_name        TEXT,
  p_slug        TEXT,
  p_tier        TEXT DEFAULT 'basic',
  p_status      TEXT DEFAULT 'active'
)
RETURNS JSONB AS $$
BEGIN
  -- Step 1: Insert client
  INSERT INTO clients (client_id, name, slug, status)
  VALUES (p_client_id, p_name, p_slug, p_status);

  -- Step 2: Insert client config
  INSERT INTO client_configs (client_id, tier)
  VALUES (p_client_id, p_tier)
  ON CONFLICT (client_id) DO UPDATE
  SET tier = EXCLUDED.tier;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', p_client_id
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Client with this ID or slug already exists'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 6. fn_close_live_chat ─────────────────────────────────────────────────
-- Atomically: close live_chat + reset chat_session state (MEDIUM severity fix)

CREATE OR REPLACE FUNCTION fn_close_live_chat(
  p_chat_id     TEXT,
  p_tenant_id   TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- Step 1: Close live chat
  UPDATE live_chats
  SET status = 'closed', closed_at = NOW()
  WHERE chat_id = p_chat_id
    AND tenant_id = p_tenant_id;

  -- Step 2: Reset chat session to main menu
  UPDATE chat_sessions
  SET booking_state = 'MAIN_MENU'
  WHERE chat_id = p_chat_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_visit_count(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_confirm_payment(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_book_appointment(TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_doctor_leave_cancel(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_create_client_with_config(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_close_live_chat(TEXT, TEXT) TO service_role;
