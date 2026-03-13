/**
 * AI-HOS Database Migration
 * Adds missing columns, indexes, constraints, and enables Realtime
 * Run: node scripts/migrate.mjs
 */

import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || (() => {
    const host = process.env.DB_HOST || "db.pbevoxnglfbtxwgbbncp.supabase.co";
    const port = process.env.DB_PORT || "5432";
    const db = process.env.DB_NAME || "postgres";
    const user = process.env.DB_USER || "postgres";
    const pass = process.env.DB_PASSWORD;
    if (!pass) {
      console.error("ERROR: DB_PASSWORD environment variable is required.\nUsage: DB_PASSWORD=yourpassword node scripts/migrate.mjs");
      process.exit(1);
    }
    return `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}?sslmode=require`;
  })(),
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  // ============================================================
  // 1. ADD MISSING COLUMNS TO EXISTING TABLES
  // ============================================================

  // Prescriptions: add consultation fields
  `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis TEXT`,
  `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS symptoms TEXT`,
  `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS vitals JSONB`,
  `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS follow_up_date TEXT`,

  // Patients: add visit_count
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0`,

  // ============================================================
  // 2. PRIMARY KEY CONSTRAINTS (if missing)
  // ============================================================

  // queue_entries PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'queue_entries_pkey') THEN
      ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_pkey PRIMARY KEY (queue_id);
    END IF;
  END $$`,

  // pharmacy_orders PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_orders_pkey') THEN
      ALTER TABLE pharmacy_orders ADD CONSTRAINT pharmacy_orders_pkey PRIMARY KEY (order_id);
    END IF;
  END $$`,

  // lab_orders PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_pkey') THEN
      ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (order_id);
    END IF;
  END $$`,

  // medicines PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medicines_pkey') THEN
      ALTER TABLE medicines ADD CONSTRAINT medicines_pkey PRIMARY KEY (medicine_id);
    END IF;
  END $$`,

  // admissions PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admissions_pkey') THEN
      ALTER TABLE admissions ADD CONSTRAINT admissions_pkey PRIMARY KEY (admission_id);
    END IF;
  END $$`,

  // staff PK
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_pkey') THEN
      ALTER TABLE staff ADD CONSTRAINT staff_pkey PRIMARY KEY (staff_id);
    END IF;
  END $$`,

  // ============================================================
  // 3. INDEXES FOR PERFORMANCE
  // ============================================================

  // Queue entries: daily queue lookup (most common query)
  `CREATE INDEX IF NOT EXISTS idx_queue_tenant_date ON queue_entries(tenant_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_entries(status) WHERE status IN ('waiting', 'in_consultation')`,
  `CREATE INDEX IF NOT EXISTS idx_queue_doctor_date ON queue_entries(doctor_id, date, status)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_booking ON queue_entries(booking_id)`,

  // Appointments: frequent lookups by date, doctor, patient
  `CREATE INDEX IF NOT EXISTS idx_appt_tenant_date ON appointments(tenant_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_phone, date)`,
  `CREATE INDEX IF NOT EXISTS idx_appt_doctor_date ON appointments(doctor_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status) WHERE status = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS idx_appt_checkin ON appointments(check_in_status) WHERE check_in_status = 'pending'`,

  // Pharmacy orders: status-based queries
  `CREATE INDEX IF NOT EXISTS idx_pharmacy_tenant ON pharmacy_orders(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pharmacy_status ON pharmacy_orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_pharmacy_patient ON pharmacy_orders(patient_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_pharmacy_prescription ON pharmacy_orders(prescription_id)`,

  // Lab orders: status-based queries
  `CREATE INDEX IF NOT EXISTS idx_lab_tenant ON lab_orders(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_status ON lab_orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_patient ON lab_orders(patient_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_doctor ON lab_orders(doctor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_booking ON lab_orders(booking_id)`,

  // Medicines: lookup by tenant + name
  `CREATE INDEX IF NOT EXISTS idx_medicines_tenant ON medicines(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(tenant_id, medicine_name)`,
  `CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(tenant_id, stock) WHERE stock <= 10`,

  // Admissions: active admissions
  `CREATE INDEX IF NOT EXISTS idx_admissions_tenant ON admissions(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(tenant_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_phone)`,

  // Staff: login lookups
  `CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(tenant_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff(tenant_id, pin) WHERE status = 'active'`,

  // Prescriptions: doctor + patient lookups
  `CREATE INDEX IF NOT EXISTS idx_rx_tenant ON prescriptions(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_rx_doctor ON prescriptions(doctor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rx_booking ON prescriptions(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rx_followup ON prescriptions(follow_up_date) WHERE follow_up_date IS NOT NULL`,

  // Patients: search
  `CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name)`,

  // Doctors: tenant lookup
  `CREATE INDEX IF NOT EXISTS idx_doctors_tenant ON doctors(tenant_id)`,

  // ============================================================
  // 4. UNIQUE CONSTRAINTS (prevent duplicates)
  // ============================================================

  // Prevent double queue entries for same booking
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_unique_booking
   ON queue_entries(booking_id)
   WHERE booking_id IS NOT NULL`,

  // Prevent duplicate pharmacy orders for same prescription
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_unique_rx
   ON pharmacy_orders(prescription_id)
   WHERE prescription_id IS NOT NULL`,

  // ============================================================
  // 5. ENABLE REALTIME ON KEY TABLES
  // ============================================================

  // Enable Supabase Realtime publication for the tables we need live updates on
  `DO $$ BEGIN
    -- Remove existing publication if it exists (to recreate cleanly)
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      -- Add tables to the existing publication
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE pharmacy_orders;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE lab_orders;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE admissions;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE patients;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE doctors;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE medicines;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END $$`,

  // ============================================================
  // 6. ENABLE REPLICA IDENTITY (required for Realtime UPDATE/DELETE)
  // ============================================================

  `ALTER TABLE queue_entries REPLICA IDENTITY FULL`,
  `ALTER TABLE appointments REPLICA IDENTITY FULL`,
  `ALTER TABLE pharmacy_orders REPLICA IDENTITY FULL`,
  `ALTER TABLE lab_orders REPLICA IDENTITY FULL`,
  `ALTER TABLE admissions REPLICA IDENTITY FULL`,
  `ALTER TABLE prescriptions REPLICA IDENTITY FULL`,
  `ALTER TABLE medicines REPLICA IDENTITY FULL`,

  // ============================================================
  // 7. DEFAULT VALUES
  // ============================================================

  `ALTER TABLE queue_entries ALTER COLUMN status SET DEFAULT 'waiting'`,
  `ALTER TABLE queue_entries ALTER COLUMN walk_in SET DEFAULT false`,
  `ALTER TABLE queue_entries ALTER COLUMN priority SET DEFAULT 0`,
  `ALTER TABLE queue_entries ALTER COLUMN created_at SET DEFAULT NOW()`,

  `ALTER TABLE pharmacy_orders ALTER COLUMN status SET DEFAULT 'pending'`,
  `ALTER TABLE pharmacy_orders ALTER COLUMN total_amount SET DEFAULT 0`,
  `ALTER TABLE pharmacy_orders ALTER COLUMN created_at SET DEFAULT NOW()`,

  `ALTER TABLE lab_orders ALTER COLUMN status SET DEFAULT 'ordered'`,
  `ALTER TABLE lab_orders ALTER COLUMN created_at SET DEFAULT NOW()`,

  `ALTER TABLE medicines ALTER COLUMN stock SET DEFAULT 0`,
  `ALTER TABLE medicines ALTER COLUMN min_stock SET DEFAULT 10`,
  `ALTER TABLE medicines ALTER COLUMN price SET DEFAULT 0`,
  `ALTER TABLE medicines ALTER COLUMN status SET DEFAULT 'active'`,
  `ALTER TABLE medicines ALTER COLUMN created_at SET DEFAULT NOW()`,

  `ALTER TABLE admissions ALTER COLUMN status SET DEFAULT 'admitted'`,
  `ALTER TABLE admissions ALTER COLUMN created_at SET DEFAULT NOW()`,

  `ALTER TABLE staff ALTER COLUMN status SET DEFAULT 'active'`,
  `ALTER TABLE staff ALTER COLUMN created_at SET DEFAULT NOW()`,
];

async function run() {
  console.log("Connecting to Supabase PostgreSQL...");
  await client.connect();
  console.log("Connected!\n");

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    const label = sql.trim().substring(0, 80).replace(/\n/g, " ");
    try {
      await client.query(sql);
      success++;
      console.log(`  [${i + 1}/${migrations.length}] OK: ${label}...`);
    } catch (err) {
      const msg = err.message || "";
      // Skip benign errors (already exists, duplicate)
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        msg.includes("does not exist") // column already there
      ) {
        skipped++;
        console.log(`  [${i + 1}/${migrations.length}] SKIP: ${label}... (${msg.substring(0, 60)})`);
      } else {
        failed++;
        console.error(`  [${i + 1}/${migrations.length}] FAIL: ${label}...`);
        console.error(`    Error: ${msg}`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Migration complete: ${success} OK, ${skipped} skipped, ${failed} failed`);
  console.log(`========================================`);

  // Verify: list all tables in publication
  try {
    const { rows } = await client.query(`
      SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename
    `);
    console.log(`\nRealtime-enabled tables (${rows.length}):`);
    rows.forEach((r) => console.log(`  - ${r.tablename}`));
  } catch (e) {
    console.log("Could not list realtime tables:", e.message);
  }

  // Verify: count indexes on key tables
  try {
    const { rows } = await client.query(`
      SELECT tablename, COUNT(*) as idx_count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('queue_entries','pharmacy_orders','lab_orders','medicines','admissions','staff','appointments','prescriptions','patients','doctors')
      GROUP BY tablename
      ORDER BY tablename
    `);
    console.log(`\nIndex counts:`);
    rows.forEach((r) => console.log(`  ${r.tablename}: ${r.idx_count} indexes`));
  } catch (e) {
    console.log("Could not list indexes:", e.message);
  }

  await client.end();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
