-- Feedback table for post-consultation ratings
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_name TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  specialty TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  source TEXT DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'portal', 'reception')),
  tenant_id TEXT NOT NULL DEFAULT 'T001',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_doctor ON feedback(doctor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_booking ON feedback(booking_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating, tenant_id);

-- Prevent duplicate feedback for same booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_unique_booking ON feedback(booking_id);
