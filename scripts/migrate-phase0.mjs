import pg from 'pg';
const { Client } = pg;

// Use Supabase connection pooler (IPv4) — session mode on port 5432
const client = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.pbevoxnglfbtxwgbbncp',
  password: 'Tejas@#3478',
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  `CREATE TABLE IF NOT EXISTS queue_entries (
    queue_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    booking_id TEXT,
    patient_phone TEXT,
    patient_name TEXT,
    doctor_id TEXT,
    doctor_name TEXT,
    queue_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting',
    check_in_time TIMESTAMPTZ,
    consultation_start TIMESTAMPTZ,
    consultation_end TIMESTAMPTZ,
    estimated_wait_minutes INTEGER,
    walk_in BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    staff_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    pin TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_status TEXT DEFAULT 'pending'`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ`,
  `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reception_pin TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_queue_tenant_date ON queue_entries(tenant_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_entries(status)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_doctor_date ON queue_entries(doctor_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id)`,
  `UPDATE tenants SET reception_pin = admin_pin WHERE tenant_id = 'T001' AND reception_pin IS NULL`,
];

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL via pooler');

  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    const preview = sql.substring(0, 80).replace(/\n/g, ' ');
    try {
      await client.query(sql);
      console.log(`[${i + 1}/${migrations.length}] OK: ${preview}...`);
    } catch (err) {
      console.error(`[${i + 1}/${migrations.length}] FAIL: ${preview}...`);
      console.error(`  Error: ${err.message}`);
    }
  }

  await client.end();
  console.log('\nMigration complete!');
}

run().catch(console.error);
