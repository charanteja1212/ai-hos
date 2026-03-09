/**
 * AI-HOS Seed Data
 * Seeds staff accounts, sample doctors, and test medicines
 * Run: node scripts/seed.mjs
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

const TENANT = "T001";

async function run() {
  console.log("Connecting...");
  await client.connect();
  console.log("Connected!\n");

  // ============================================================
  // 1. STAFF ACCOUNTS
  // ============================================================
  console.log("--- Seeding staff accounts ---");

  const staffData = [
    { staff_id: "STF-ADMIN-001", name: "Admin User", role: "ADMIN", pin: "1234", email: "admin@carehospital.in", phone: "9000000001" },
    { staff_id: "STF-REC-001", name: "Reception Desk 1", role: "RECEPTION", pin: "5678", email: "reception@carehospital.in", phone: "9000000002" },
    { staff_id: "STF-REC-002", name: "Reception Desk 2", role: "RECEPTION", pin: "5679", email: "reception2@carehospital.in", phone: "9000000003" },
    { staff_id: "STF-LAB-001", name: "Lab Technician", role: "LAB_TECH", pin: "3456", email: "lab@carehospital.in", phone: "9000000004" },
    { staff_id: "STF-PHR-001", name: "Pharmacist", role: "PHARMACIST", pin: "7890", email: "pharmacy@carehospital.in", phone: "9000000005" },
  ];

  for (const s of staffData) {
    try {
      await client.query(
        `INSERT INTO staff (staff_id, tenant_id, name, email, phone, role, pin, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         ON CONFLICT (staff_id) DO UPDATE SET name = $3, pin = $7, role = $6`,
        [s.staff_id, TENANT, s.name, s.email, s.phone, s.role, s.pin]
      );
      console.log(`  [OK] ${s.role}: ${s.name} (PIN: ${s.pin})`);
    } catch (err) {
      console.log(`  [SKIP] ${s.name}: ${err.message.substring(0, 80)}`);
    }
  }

  // ============================================================
  // 2. CHECK EXISTING DOCTORS (don't overwrite)
  // ============================================================
  console.log("\n--- Checking doctors ---");
  const { rows: existingDoctors } = await client.query(
    `SELECT doctor_id, name, specialty, pin FROM doctors WHERE tenant_id = $1`,
    [TENANT]
  );

  if (existingDoctors.length > 0) {
    console.log(`  Found ${existingDoctors.length} existing doctors:`);
    existingDoctors.forEach((d) => console.log(`    - ${d.name} (${d.specialty}) PIN: ${d.pin}`));
  } else {
    console.log("  No doctors found — seeding sample doctors...");
    const doctors = [
      { doctor_id: "DOC-001", name: "Dr. Ravi Kumar", specialty: "General Medicine", pin: "1001", fee: 200 },
      { doctor_id: "DOC-002", name: "Dr. Priya Sharma", specialty: "Pediatrics", pin: "1002", fee: 250 },
      { doctor_id: "DOC-003", name: "Dr. Suresh Reddy", specialty: "Orthopedics", pin: "1003", fee: 300 },
      { doctor_id: "DOC-004", name: "Dr. Anita Nair", specialty: "Dermatology", pin: "1004", fee: 200 },
    ];
    for (const d of doctors) {
      await client.query(
        `INSERT INTO doctors (doctor_id, name, specialty, pin, status, tenant_id, consultation_fee)
         VALUES ($1, $2, $3, $4, 'active', $5, $6)
         ON CONFLICT (doctor_id) DO NOTHING`,
        [d.doctor_id, d.name, d.specialty, d.pin, TENANT, d.fee]
      );
      console.log(`  [OK] ${d.name} (${d.specialty}) PIN: ${d.pin}`);
    }
  }

  // ============================================================
  // 3. SAMPLE MEDICINES (if empty)
  // ============================================================
  console.log("\n--- Checking medicines ---");
  const { rows: existingMeds } = await client.query(
    `SELECT COUNT(*) as cnt FROM medicines WHERE tenant_id = $1`,
    [TENANT]
  );

  if (parseInt(existingMeds[0].cnt) > 0) {
    console.log(`  Found ${existingMeds[0].cnt} existing medicines — skipping`);
  } else {
    console.log("  No medicines found — seeding sample inventory...");
    const meds = [
      { id: "MED-001", name: "Paracetamol 500mg", salt: "Paracetamol", dosage: "500mg", form: "Tablet", category: "Tablet", stock: 500, min_stock: 50, price: 2, expiry: "2027-12-31" },
      { id: "MED-002", name: "Amoxicillin 500mg", salt: "Amoxicillin", dosage: "500mg", form: "Capsule", category: "Capsule", stock: 200, min_stock: 30, price: 5, expiry: "2027-06-30" },
      { id: "MED-003", name: "Cetirizine 10mg", salt: "Cetirizine", dosage: "10mg", form: "Tablet", category: "Tablet", stock: 300, min_stock: 40, price: 3, expiry: "2027-09-30" },
      { id: "MED-004", name: "Azithromycin 500mg", salt: "Azithromycin", dosage: "500mg", form: "Tablet", category: "Tablet", stock: 150, min_stock: 20, price: 15, expiry: "2027-03-31" },
      { id: "MED-005", name: "Pantoprazole 40mg", salt: "Pantoprazole", dosage: "40mg", form: "Tablet", category: "Tablet", stock: 250, min_stock: 30, price: 8, expiry: "2027-08-31" },
      { id: "MED-006", name: "Ibuprofen 400mg", salt: "Ibuprofen", dosage: "400mg", form: "Tablet", category: "Tablet", stock: 400, min_stock: 50, price: 3, expiry: "2027-11-30" },
      { id: "MED-007", name: "Metformin 500mg", salt: "Metformin", dosage: "500mg", form: "Tablet", category: "Tablet", stock: 350, min_stock: 40, price: 4, expiry: "2027-10-31" },
      { id: "MED-008", name: "Omeprazole 20mg", salt: "Omeprazole", dosage: "20mg", form: "Capsule", category: "Capsule", stock: 200, min_stock: 25, price: 6, expiry: "2027-07-31" },
      { id: "MED-009", name: "Cough Syrup (Dextromethorphan)", salt: "Dextromethorphan", dosage: "100ml", form: "Syrup", category: "Syrup", stock: 100, min_stock: 15, price: 45, expiry: "2027-05-31" },
      { id: "MED-010", name: "Betadine Ointment", salt: "Povidone Iodine", dosage: "15g", form: "Cream", category: "Cream", stock: 80, min_stock: 10, price: 35, expiry: "2027-04-30" },
      { id: "MED-011", name: "Insulin (Regular)", salt: "Insulin", dosage: "10ml", form: "Injection", category: "Injection", stock: 50, min_stock: 10, price: 120, expiry: "2026-12-31" },
      { id: "MED-012", name: "Eye Drops (Ciprofloxacin)", salt: "Ciprofloxacin", dosage: "5ml", form: "Drops", category: "Drops", stock: 60, min_stock: 10, price: 25, expiry: "2027-02-28" },
    ];
    for (const m of meds) {
      await client.query(
        `INSERT INTO medicines (medicine_id, tenant_id, medicine_name, salt, dosage, form, category, stock, min_stock, price, expiry_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')`,
        [m.id, TENANT, m.name, m.salt, m.dosage, m.form, m.category, m.stock, m.min_stock, m.price, m.expiry]
      );
      console.log(`  [OK] ${m.name} (stock: ${m.stock})`);
    }
  }

  // ============================================================
  // 4. VERIFY TENANT CONFIG
  // ============================================================
  console.log("\n--- Checking tenant T001 ---");
  const { rows: tenant } = await client.query(
    `SELECT tenant_id, hospital_name, reception_pin, admin_pin, consultation_fee FROM tenants WHERE tenant_id = $1`,
    [TENANT]
  );
  if (tenant.length > 0) {
    const t = tenant[0];
    console.log(`  Hospital: ${t.hospital_name}`);
    console.log(`  Admin PIN: ${t.admin_pin}`);
    console.log(`  Reception PIN: ${t.reception_pin || "(not set)"}`);
    console.log(`  Consultation Fee: ${t.consultation_fee}`);

    // Ensure reception_pin is set
    if (!t.reception_pin) {
      await client.query(
        `UPDATE tenants SET reception_pin = '5678' WHERE tenant_id = $1`,
        [TENANT]
      );
      console.log("  -> Set reception_pin to 5678");
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n========================================");
  console.log("Seed complete! Login credentials:");
  console.log("========================================");
  console.log("  ADMIN:      PIN 1234");
  console.log("  RECEPTION:  PIN 5678");
  console.log("  LAB_TECH:   PIN 3456");
  console.log("  PHARMACIST: PIN 7890");
  console.log("");
  console.log("  Doctor PINs:");
  const { rows: docs } = await client.query(
    `SELECT name, pin, specialty FROM doctors WHERE tenant_id = $1 AND status = 'active' ORDER BY name`,
    [TENANT]
  );
  docs.forEach((d) => console.log(`    ${d.name} (${d.specialty}): PIN ${d.pin}`));
  console.log("========================================");

  await client.end();
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
