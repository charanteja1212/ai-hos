/**
 * Comprehensive Hospital Test Data Seeder
 * Simulates realistic hospital operations with correct DB schema
 */

const { Client } = require("pg");

const DB_URL = "postgresql://postgres:Tejas%40%233478@db.pbevoxnglfbtxwgbbncp.supabase.co:5432/postgres";
const TENANT_ID = "T001";
const CLIENT_ID = "CL001";

// ── Data ────────────────────────────────────────────────────────────────────

const PATIENTS = [];
const firstNames = ["Aarav","Priya","Rohan","Sneha","Vikram","Ananya","Arjun","Kavitha","Rajesh","Meera","Suresh","Deepa","Karthik","Lakshmi","Anil","Pooja","Ganesh","Sunita","Manoj","Rekha","Amit","Divya","Prasad","Sujata","Ravi","Nisha","Srinivas","Padma","Rahul","Swati","Naveen","Asha","Venkat","Geeta","Harish","Usha","Deepak","Sangeeta","Prakash","Kamala","Ajay","Radha","Mohan","Bhavani","Sunil","Manjula","Raghu","Savitri","Krishna","Vijaya"];
const lastNames = ["Sharma","Verma","Gupta","Patel","Reddy","Iyer","Nair","Rao","Kumar","Joshi","Babu","Menon","Pillai","Devi","Shetty","Kulkarni","Hegde","Desai","Tiwari","Saxena","Mishra","Chauhan","Mane","Bhat","Shankar","Agarwal","Raman","Deshpande","Jain","Patil","Gowda","Mukherjee","Pandey","Chandra","Rani","Choudhary","Mohan","Sinha","Sundaram","Thakur","Das","Kapoor","Veer","Bai","Murthy","Lakshmi","Singh","Khan","Thomas","Nambiar"];
for (let i = 0; i < 50; i++) {
  PATIENTS.push({
    phone: `91000000${String(i + 1).padStart(2, "0")}`,
    name: `${firstNames[i]} ${lastNames[i]}`,
    age: 24 + (i * 37 % 45),
    gender: i % 2 === 0 ? "Male" : "Female",
  });
}

const DOCTORS = [
  { id: "DOC001", name: "Dr. Rajesh sharma", specialty: "Cardiology" },
  { id: "DOC002", name: "Dr. Priya Patel", specialty: "Orthopedics" },
  { id: "DOC003", name: "Dr. Ananya Reddy", specialty: "Dermatology" },
  { id: "DOC004", name: "Dr. Vikram Singh", specialty: "General Medicine" },
  { id: "DOC005", name: "Dr. Meera Krishnan", specialty: "Pediatrics" },
  { id: "DOC006", name: "Dr. Arjun Nair", specialty: "ENT" },
  { id: "DOC007", name: "Dr. Sonia Gupta", specialty: "Gynecology" },
];

const MEDICINE_IDS = ["MED-001","MED-002","MED-003","MED-004","MED-005","MED-006","MED-007","MED-008","MED-009","MED-010"];
const MEDICINE_NAMES = ["Paracetamol 500mg","Amoxicillin 500mg","Cetirizine 10mg","Azithromycin 500mg","Omeprazole 20mg","Metformin 500mg","Amlodipine 5mg","Ibuprofen 400mg","Cough Syrup","Betadine Ointment"];
const DOSAGES = ["1 tab 3x/day","1 cap 2x/day","1 tab at night","1 tab once daily 3 days","1 cap before breakfast","1 tab 2x after meals","1 tab once daily","1 tab as needed","10ml 3x/day","Apply 2x/day"];

const LAB_TESTS = ["CBC","Lipid Profile","Blood Sugar Fasting","Blood Sugar PP","Thyroid Profile","LFT","KFT","Urine Routine","HbA1c","Vitamin D","Vitamin B12","ECG","Chest X-Ray","Serum Creatinine","Serum Uric Acid"];

const DIAGNOSES = ["URTI","Hypertension Stage 1","Type 2 Diabetes","Acute Gastritis","Allergic Rhinitis","Lower Back Pain","Migraine","UTI","Iron Deficiency Anemia","Vitamin D Deficiency","Hypothyroidism","Osteoarthritis Knee","Dermatitis","Viral Fever","Bronchitis","GERD","Cervical Spondylosis","Anxiety Disorder","Conjunctivitis","Otitis Media"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getISTDate(offset = 0) {
  const d = new Date(Date.now() + 5.5 * 3600000 + offset * 86400000);
  return d.toISOString().split("T")[0];
}
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function genSlots(startH, endH, dur) {
  const s = [];
  for (let m = startH * 60; m + dur <= endH * 60; m += dur)
    s.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`);
  return s;
}

async function q(client, sql, params) {
  try { await client.query(sql, params); return true; }
  catch (e) { return false; }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connected to Supabase DB\n");

  // 1. PATIENTS
  console.log("1/10 Inserting 50 patients...");
  let ct = 0;
  for (const p of PATIENTS) {
    if (await q(client,
      `INSERT INTO patients (phone, name, age, gender, tenant_id, client_id, visit_count, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,0,NOW()) ON CONFLICT (phone, tenant_id) DO UPDATE SET name=$2, age=$3, gender=$4`,
      [p.phone, p.name, p.age, p.gender, TENANT_ID, CLIENT_ID])) ct++;
  }
  console.log(`   ${ct} patients`);

  // 2. DEPENDENTS
  console.log("2/10 Adding dependents...");
  ct = 0;
  const deps = [
    ["9100000001","Aarti Sharma",30], ["9100000001","Aryan Sharma",5],
    ["9100000003","Kavita Gupta",42], ["9100000005","Sudha Reddy",78],
    ["9100000009","Sita Kumar",52],   ["9100000012","Arun Menon",36],
    ["9100000014","Ram Devi",68],     ["9100000020","Alok Saxena",60],
    ["9100000030","Baby Patil",8],    ["9100000040","Raju Sundaram",66],
  ];
  for (const [ph, nm, age] of deps) {
    if (await q(client,
      `INSERT INTO dependents (dependent_id, linked_phone, name, age, tenant_id, client_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [`DEP${Date.now()}${randInt(100,999)}`, ph, nm, age, TENANT_ID, CLIENT_ID])) ct++;
  }
  console.log(`   ${ct} dependents`);

  // 3. APPOINTMENTS (200+ across 7 days)
  console.log("3/10 Creating appointments...");
  const allSlots = [...genSlots(9,13,20), ...genSlots(14,18,20)];
  const SOURCES = ["dashboard","whatsapp","patient_portal"];
  const appts = [];

  for (let day = -3; day <= 3; day++) {
    const date = getISTDate(day);
    const isPast = day < 0;
    const isToday = day === 0;

    for (const doc of DOCTORS) {
      const n = isPast ? randInt(6,12) : isToday ? randInt(8,15) : randInt(4,8);
      const used = new Set();
      for (let i = 0; i < n; i++) {
        let slot; do { slot = rand(allSlots); } while (used.has(slot));
        used.add(slot);
        const pat = rand(PATIENTS);

        let status;
        if (isPast) status = Math.random() < 0.7 ? "completed" : (Math.random() < 0.5 ? "cancelled" : "no_show");
        else if (isToday) status = Math.random() < 0.4 ? "completed" : "confirmed";
        else status = "confirmed";

        const payStatus = status === "completed" ? "paid" : (Math.random() < 0.3 ? "paid" : "pending");
        const bk = `BK${Date.now()}${randInt(1000,9999)}`;

        appts.push({ booking_id: bk, patient_phone: pat.phone, patient_name: pat.name, patient_age: pat.age,
          doctor_id: doc.id, doctor_name: doc.name, specialty: doc.specialty, date, time: slot,
          status, source: rand(SOURCES), payment_status: payStatus });
      }
    }
  }

  ct = 0;
  for (const a of appts) {
    if (await q(client,
      `INSERT INTO appointments (booking_id, tenant_id, client_id, patient_phone, patient_name, patient_type, patient_age,
       doctor_id, doctor_name, specialty, date, time, status, source, payment_status, booked_at)
       VALUES ($1,$2,$3,$4,$5,'SELF',$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
      [a.booking_id, TENANT_ID, CLIENT_ID, a.patient_phone, a.patient_name, a.patient_age,
       a.doctor_id, a.doctor_name, a.specialty, a.date, a.time, a.status, a.source, a.payment_status])) ct++;
  }
  console.log(`   ${ct} appointments`);

  // 4. QUEUE ENTRIES (today's appointments)
  console.log("4/10 Queue entries...");
  ct = 0;
  const today = getISTDate();
  let qNum = 1;
  for (const a of appts.filter(a => a.date === today && a.status !== "cancelled")) {
    const qs = a.status === "completed" ? "completed" : rand(["waiting","in_consultation","vitals_done"]);
    if (await q(client,
      `INSERT INTO queue_entries (queue_id, tenant_id, client_id, booking_id, patient_phone, patient_name,
       doctor_id, doctor_name, queue_number, status, date, check_in_time, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
      [`Q${Date.now()}${randInt(100,999)}`, TENANT_ID, CLIENT_ID, a.booking_id, a.patient_phone, a.patient_name,
       a.doctor_id, a.doctor_name, qNum++, qs, today])) ct++;
  }
  console.log(`   ${ct} queue entries`);

  // 5. VITALS
  console.log("5/10 Vitals...");
  ct = 0;
  for (const a of appts.filter(a => a.status === "completed" || a.date === today)) {
    if (Math.random() < 0.15) continue;
    if (await q(client,
      `INSERT INTO vitals (patient_phone, booking_id, tenant_id, client_id,
       bp_systolic, bp_diastolic, pulse, temperature, spo2, weight, height, respiratory_rate, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [a.patient_phone, a.booking_id, TENANT_ID, CLIENT_ID,
       randInt(110,160), randInt(70,100), randInt(60,100),
       +(36 + Math.random()*2.5).toFixed(1), randInt(94,100),
       randInt(45,110), randInt(150,185), randInt(14,22)])) ct++;
  }
  console.log(`   ${ct} vitals`);

  // 6. PRESCRIPTIONS + PHARMACY + LAB + CLINICAL NOTES
  console.log("6/10 Prescriptions, pharmacy, lab, clinical notes...");
  let rxCt=0, phCt=0, labCt=0, cnCt=0;
  const completed = appts.filter(a => a.status === "completed");

  for (const a of completed) {
    const diag = rand(DIAGNOSES);
    const nMeds = randInt(1,4);
    const items = [];
    const usedM = new Set();
    for (let i = 0; i < nMeds; i++) {
      let idx; do { idx = randInt(0,9); } while (usedM.has(idx));
      usedM.add(idx);
      items.push({ medicine_id: MEDICINE_IDS[idx], medicine_name: MEDICINE_NAMES[idx], dosage: DOSAGES[idx], duration: `${randInt(3,14)} days`, quantity: randInt(5,30) });
    }

    const tests = [];
    if (Math.random() < 0.4) {
      const nT = randInt(1,3); const usedT = new Set();
      for (let i = 0; i < nT; i++) { let t; do { t = rand(LAB_TESTS); } while (usedT.has(t)); usedT.add(t); tests.push({ test_name: t }); }
    }

    const rxId = `RX${Date.now()}${randInt(1000,9999)}`;
    const followUp = Math.random() < 0.3 ? getISTDate(randInt(7,30)) : null;

    if (await q(client,
      `INSERT INTO prescriptions (prescription_id, booking_id, tenant_id, client_id, patient_phone, patient_name,
       doctor_id, doctor_name, diagnosis, items, follow_up_date, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [rxId, a.booking_id, TENANT_ID, CLIENT_ID, a.patient_phone, a.patient_name,
       a.doctor_id, a.doctor_name, diag, JSON.stringify(items), followUp])) rxCt++;

    // Pharmacy
    const phSt = rand(["dispensed","dispensed","dispensed","preparing","pending"]);
    const totalAmt = items.reduce((s,it) => s + it.quantity * randInt(2,20), 0);
    if (await q(client,
      `INSERT INTO pharmacy_orders (order_id, tenant_id, client_id, prescription_id, patient_phone, patient_name,
       doctor_name, items, total_amount, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [`PO${Date.now()}${randInt(1000,9999)}`, TENANT_ID, CLIENT_ID, rxId, a.patient_phone, a.patient_name,
       a.doctor_name, JSON.stringify(items), totalAmt, phSt])) phCt++;

    // Lab
    if (tests.length > 0) {
      const labSt = rand(["completed","completed","sample_collected","ordered"]);
      if (await q(client,
        `INSERT INTO lab_orders (order_id, tenant_id, client_id, patient_phone, patient_name, doctor_id, doctor_name,
         booking_id, tests, status, total_amount, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
        [`LO${Date.now()}${randInt(1000,9999)}`, TENANT_ID, CLIENT_ID, a.patient_phone, a.patient_name,
         a.doctor_id, a.doctor_name, a.booking_id, JSON.stringify(tests), labSt, tests.length * randInt(200,800)])) labCt++;
    }

    // Clinical Notes (SOAP format)
    if (await q(client,
      `INSERT INTO clinical_notes (patient_phone, booking_id, tenant_id, client_id, doctor_id, doctor_name,
       note_type, subjective, objective, assessment, plan, chief_complaint, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'soap',$7,$8,$9,$10,$11,NOW())`,
      [a.patient_phone, a.booking_id, TENANT_ID, CLIENT_ID, a.doctor_id, a.doctor_name,
       `Patient complains of symptoms related to ${diag.toLowerCase()}`,
       `Vitals stable. Examination findings within normal limits.`,
       diag,
       `Prescribed ${nMeds} medications.${tests.length ? ` Ordered ${tests.length} lab test(s).` : ""}${followUp ? ` Follow-up on ${followUp}.` : ""}`,
       diag])) cnCt++;
  }
  console.log(`   ${rxCt} prescriptions, ${phCt} pharmacy, ${labCt} lab, ${cnCt} clinical notes`);

  // 7. INVOICES
  console.log("7/10 Invoices...");
  ct = 0;
  for (const a of appts.filter(a => a.payment_status === "paid")) {
    const fee = randInt(300,1500);
    const tax = Math.round(fee * 0.18);
    if (await q(client,
      `INSERT INTO invoices (invoice_id, tenant_id, client_id, booking_id, patient_phone, patient_name,
       type, items, subtotal, tax, total, payment_status, payment_method, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'consultation',$7,$8,$9,$10,'paid',$11,NOW())`,
      [`INV${Date.now()}${randInt(1000,9999)}`, TENANT_ID, CLIENT_ID, a.booking_id, a.patient_phone, a.patient_name,
       JSON.stringify([{description: `Consultation - ${a.doctor_name}`, amount: fee}]),
       fee, tax, fee + tax, rand(["cash","upi","card","razorpay"])])) ct++;
  }
  console.log(`   ${ct} invoices`);

  // 8. OP PASSES
  console.log("8/10 OP passes...");
  ct = 0;
  for (const a of completed.filter(() => Math.random() < 0.3)) {
    if (await q(client,
      `INSERT INTO op_passes (op_pass_id, booking_id, tenant_id, client_id, patient_phone, patient_name,
       patient_type, issue_date, expiry_date, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'SELF',$7,$8,'ACTIVE',NOW())`,
      [`OP${Date.now()}${randInt(1000,9999)}`, a.booking_id, TENANT_ID, CLIENT_ID, a.patient_phone, a.patient_name,
       a.date, getISTDate(30)])) ct++;
  }
  console.log(`   ${ct} OP passes`);

  // 9. FEEDBACK
  console.log("9/10 Feedback...");
  ct = 0;
  const comments = ["Very good experience","Good treatment","Excellent care","Average experience","Doctor was knowledgeable","Pharmacy was efficient","Clean facility","Could improve timing","Very satisfied","Quick and professional"];
  for (const a of completed.filter(() => Math.random() < 0.25)) {
    if (await q(client,
      `INSERT INTO feedback (booking_id, patient_phone, patient_name, doctor_id, doctor_name, specialty,
       rating, comment, source, tenant_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [a.booking_id, a.patient_phone, a.patient_name, a.doctor_id, a.doctor_name, a.specialty,
       randInt(3,5), rand(comments), a.source, TENANT_ID])) ct++;
  }
  console.log(`   ${ct} feedback`);

  // 10. MEDICAL CONDITIONS + ALLERGIES + NOTIFICATIONS
  console.log("10/10 Conditions, allergies, notifications...");
  let condCt=0, allCt=0, notCt=0;
  const conds = ["Hypertension","Type 2 Diabetes","Asthma","Hypothyroidism","Hyperlipidemia","GERD","Osteoarthritis","Migraine","CKD","Anemia"];
  const allergens = ["Penicillin","Aspirin","Sulfonamides","NSAIDs","Dust","Pollen","Shellfish","Peanuts","Latex","Iodine"];

  for (const p of PATIENTS) {
    if (Math.random() < 0.4) {
      for (let i = 0; i < randInt(1,3); i++) {
        if (await q(client,
          `INSERT INTO medical_conditions (patient_phone, tenant_id, client_id, condition_name, severity, onset_date, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'active',NOW())`,
          [p.phone, TENANT_ID, CLIENT_ID, rand(conds), rand(["mild","moderate","severe"]), getISTDate(-randInt(30,365))])) condCt++;
      }
    }
    if (Math.random() < 0.25) {
      if (await q(client,
        `INSERT INTO allergies (patient_phone, tenant_id, client_id, allergen, allergy_type, severity, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'active',NOW())`,
        [p.phone, TENANT_ID, CLIENT_ID, rand(allergens), rand(["drug","food","environmental"]), rand(["mild","moderate","severe"])])) allCt++;
    }
  }

  // Notifications
  for (let i = 0; i < 40; i++) {
    const a = rand(appts);
    const type = rand(["appointment_booked","prescription_created","lab_result_ready","payment_received"]);
    if (await q(client,
      `INSERT INTO notifications (type, title, message, severity, is_read, target_role, tenant_id, created_at)
       VALUES ($1,$2,$3,'info',$4,$5,$6,NOW())`,
      [type,
       type.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()),
       `${a.patient_name} - ${a.doctor_name}`,
       Math.random() < 0.5,
       rand(["RECEPTION","PHARMACY","LAB","ADMIN"]),
       TENANT_ID])) notCt++;
  }
  console.log(`   ${condCt} conditions, ${allCt} allergies, ${notCt} notifications`);

  // Update visit counts
  await q(client, `
    UPDATE patients SET visit_count = sub.cnt
    FROM (SELECT patient_phone, COUNT(*) as cnt FROM appointments WHERE tenant_id=$1 AND status IN ('completed','confirmed') GROUP BY patient_phone) sub
    WHERE patients.phone = sub.patient_phone AND patients.tenant_id = $1
  `, [TENANT_ID]);

  // Final counts
  const res = await client.query(`
    SELECT
      (SELECT count(*) FROM patients WHERE tenant_id=$1) as patients,
      (SELECT count(*) FROM appointments WHERE tenant_id=$1) as appointments,
      (SELECT count(*) FROM prescriptions WHERE tenant_id=$1) as prescriptions,
      (SELECT count(*) FROM lab_orders WHERE tenant_id=$1) as lab_orders,
      (SELECT count(*) FROM pharmacy_orders WHERE tenant_id=$1) as pharmacy_orders,
      (SELECT count(*) FROM invoices WHERE tenant_id=$1) as invoices,
      (SELECT count(*) FROM vitals WHERE tenant_id=$1) as vitals,
      (SELECT count(*) FROM clinical_notes WHERE tenant_id=$1) as clinical_notes,
      (SELECT count(*) FROM queue_entries WHERE tenant_id=$1) as queue_entries,
      (SELECT count(*) FROM op_passes WHERE tenant_id=$1) as op_passes,
      (SELECT count(*) FROM feedback WHERE tenant_id=$1) as feedback,
      (SELECT count(*) FROM medical_conditions WHERE tenant_id=$1) as conditions,
      (SELECT count(*) FROM allergies WHERE tenant_id=$1) as allergies,
      (SELECT count(*) FROM notifications WHERE tenant_id=$1) as notifications,
      (SELECT count(*) FROM dependents WHERE tenant_id=$1) as dependents
  `, [TENANT_ID]);

  console.log("\n══════════════════════════════════════");
  console.log("  SEED COMPLETE — Final Counts:");
  console.log("══════════════════════════════════════");
  for (const [k,v] of Object.entries(res.rows[0]))
    console.log(`  ${k.padEnd(20)} ${v}`);

  await client.end();
  console.log("\nDone!");
}

seed().catch(e => { console.error("SEED ERROR:", e); process.exit(1); });
