/**
 * Fix TEXT → JSONB columns and other simulation failures
 * Run: node scripts/fix-columns.mjs
 */

import pg from "pg";
const { Client } = pg;

const client = new Client({
  host: "db.pbevoxnglfbtxwgbbncp.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Tejas@#3478",
  ssl: { rejectUnauthorized: false },
});

const fixes = [
  // 1. TEXT → JSONB conversions (critical for frontend .map() to work)
  {
    name: "prescriptions.items TEXT → JSONB",
    sql: `ALTER TABLE prescriptions ALTER COLUMN items TYPE jsonb USING items::jsonb`,
  },
  {
    name: "prescriptions.vitals TEXT → JSONB",
    sql: `ALTER TABLE prescriptions ALTER COLUMN vitals TYPE jsonb USING CASE WHEN vitals IS NULL THEN NULL WHEN vitals = '' THEN NULL ELSE vitals::jsonb END`,
  },
  {
    name: "pharmacy_orders.items TEXT → JSONB",
    sql: `ALTER TABLE pharmacy_orders ALTER COLUMN items TYPE jsonb USING items::jsonb`,
  },
  {
    name: "lab_orders.tests TEXT → JSONB",
    sql: `ALTER TABLE lab_orders ALTER COLUMN tests TYPE jsonb USING tests::jsonb`,
  },
  {
    name: "lab_orders.results TEXT → JSONB",
    sql: `ALTER TABLE lab_orders ALTER COLUMN results TYPE jsonb USING CASE WHEN results IS NULL THEN NULL WHEN results = '' THEN '{}' ELSE results::jsonb END`,
  },

  // 2. Set default values for JSONB columns
  {
    name: "prescriptions.items DEFAULT '[]'",
    sql: `ALTER TABLE prescriptions ALTER COLUMN items SET DEFAULT '[]'::jsonb`,
  },
  {
    name: "prescriptions.vitals DEFAULT '{}'",
    sql: `ALTER TABLE prescriptions ALTER COLUMN vitals SET DEFAULT '{}'::jsonb`,
  },
  {
    name: "pharmacy_orders.items DEFAULT '[]'",
    sql: `ALTER TABLE pharmacy_orders ALTER COLUMN items SET DEFAULT '[]'::jsonb`,
  },
  {
    name: "lab_orders.tests DEFAULT '[]'",
    sql: `ALTER TABLE lab_orders ALTER COLUMN tests SET DEFAULT '[]'::jsonb`,
  },
  {
    name: "lab_orders.results DEFAULT '{}'",
    sql: `ALTER TABLE lab_orders ALTER COLUMN results SET DEFAULT '{}'::jsonb`,
  },

  // 3. Add staff to realtime publication
  {
    name: "Add staff to realtime publication",
    sql: `ALTER PUBLICATION supabase_realtime ADD TABLE staff`,
  },

  // 4. Replica identity FULL on patients
  {
    name: "REPLICA IDENTITY FULL on patients",
    sql: `ALTER TABLE patients REPLICA IDENTITY FULL`,
  },

  // 5. Replica identity FULL on staff
  {
    name: "REPLICA IDENTITY FULL on staff",
    sql: `ALTER TABLE staff REPLICA IDENTITY FULL`,
  },

  // 6. Also fix admissions date columns to DATE type for cleaner comparison
  {
    name: "admissions.actual_discharge → DATE",
    sql: `ALTER TABLE admissions ALTER COLUMN actual_discharge TYPE date USING actual_discharge::date`,
  },
  {
    name: "admissions.expected_discharge → DATE",
    sql: `ALTER TABLE admissions ALTER COLUMN expected_discharge TYPE date USING expected_discharge::date`,
  },
];

async function run() {
  console.log("Connecting to Supabase PostgreSQL...\n");
  await client.connect();

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const fix of fixes) {
    try {
      await client.query(fix.sql);
      ok++;
      console.log(`  ✅ ${fix.name}`);
    } catch (err) {
      const msg = err.message;
      if (
        msg.includes("already member") ||
        msg.includes("already exists") ||
        msg.includes("cannot be cast automatically") ||
        msg.includes("column \"") && msg.includes("\" is already of type")
      ) {
        skipped++;
        console.log(`  ⏭️  ${fix.name} (already done)`);
      } else {
        failed++;
        console.log(`  ❌ ${fix.name}: ${msg.substring(0, 100)}`);
      }
    }
  }

  // Verify: check column types after fix
  console.log("\n--- Verification ---");
  const typeCheck = await client.query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (table_name, column_name) IN (
      ('prescriptions', 'items'),
      ('prescriptions', 'vitals'),
      ('pharmacy_orders', 'items'),
      ('lab_orders', 'tests'),
      ('lab_orders', 'results'),
      ('admissions', 'actual_discharge'),
      ('admissions', 'expected_discharge')
    )
    ORDER BY table_name, column_name
  `);

  for (const row of typeCheck.rows) {
    const expected = row.column_name.includes("discharge") ? "date" : "jsonb";
    const actual = row.udt_name;
    const match = actual === expected;
    console.log(`  ${match ? "✅" : "❌"} ${row.table_name}.${row.column_name}: ${actual} (expected: ${expected})`);
  }

  // Verify realtime
  const pubRes = await client.query(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'staff'
  `);
  console.log(`  ${pubRes.rows.length > 0 ? "✅" : "❌"} staff in realtime: ${pubRes.rows.length > 0}`);

  // Verify replica identity
  const repRes = await client.query(`
    SELECT c.relname, CASE c.relreplident WHEN 'f' THEN 'FULL' ELSE 'OTHER' END AS ri
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('patients', 'staff')
  `);
  for (const row of repRes.rows) {
    console.log(`  ${row.ri === "FULL" ? "✅" : "❌"} ${row.relname} replica identity: ${row.ri}`);
  }

  console.log(`\n  OK: ${ok} | Skipped: ${skipped} | Failed: ${failed}`);
  await client.end();
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
