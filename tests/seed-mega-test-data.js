/**
 * MEGA Test Data Seeder — Multi-Client, Multi-Branch
 * Seeds realistic hospital data across 3 clients, 5 branches
 * Uses UPSERT (ON CONFLICT DO NOTHING) to avoid duplicates
 *
 * Run: node tests/seed-mega-test-data.js
 */

const { Client } = require("pg");

const DB_URL =
  "postgresql://postgres:Tejas%40%233478@db.pbevoxnglfbtxwgbbncp.supabase.co:5432/postgres";

// ═══════════════════════════════════════════════════════════════════════════
// DATA POOLS
// ═══════════════════════════════════════════════════════════════════════════

const CLIENTS = [
  { client_id: "CL001", name: "Care Hospital", status: "active", admin_pin: "1234" },
  { client_id: "CL002", name: "City Medical Center", status: "active", admin_pin: "5678" },
  { client_id: "CL003", name: "Apollo Diagnostics", status: "active", admin_pin: "9012" },
];

const TENANTS = [
  { tenant_id: "T001", hospital_name: "Care Hospital - Main", client_id: "CL001", status: "active", phone: "914000000001", address: "Banjara Hills, Hyderabad", admin_pin: "1234", reception_pin: "0000" },
  { tenant_id: "T1772293744327", hospital_name: "Care Hospital - Hyderabad", client_id: "CL001", status: "active", phone: "914000000002", address: "Gachibowli, Hyderabad", admin_pin: "1234", reception_pin: "0000" },
  { tenant_id: "T-CITY-01", hospital_name: "City Medical Center - Jubilee Hills", client_id: "CL002", status: "active", phone: "914000000003", address: "Jubilee Hills, Hyderabad", admin_pin: "5678", reception_pin: "1111" },
  { tenant_id: "T-CITY-02", hospital_name: "City Medical Center - Kukatpally", client_id: "CL002", status: "active", phone: "914000000004", address: "Kukatpally, Hyderabad", admin_pin: "5678", reception_pin: "1111" },
  { tenant_id: "T-APOLLO-01", hospital_name: "Apollo Diagnostics - Secunderabad", client_id: "CL003", status: "active", phone: "914000000005", address: "Secunderabad, Hyderabad", admin_pin: "9012", reception_pin: "2222" },
];

const CLIENT_CONFIGS = [
  {
    client_id: "CL002",
    tier: "medium",
    features: { whatsapp: true, lab: true, pharmacy: true, ipd: true, ai_assistant: false, multi_branch: true },
    limits: { max_branches: 5, max_doctors_per_branch: 15, max_patients: 10000, max_appointments_per_day: 200 },
  },
  {
    client_id: "CL003",
    tier: "basic",
    features: { whatsapp: true, lab: true, pharmacy: false, ipd: false, ai_assistant: false, multi_branch: false },
    limits: { max_branches: 2, max_doctors_per_branch: 10, max_patients: 5000, max_appointments_per_day: 100 },
  },
];

// Existing doctors in T001 — we skip re-creating these
const EXISTING_T001_DOCTOR_IDS = new Set([
  "DOC001", "DOC002", "DOC003", "DOC004", "DOC005", "DOC006", "DOC007",
]);

const SPECIALTIES = [
  "Cardiology", "Orthopedics", "Dermatology", "General Medicine", "Pediatrics",
  "ENT", "Gynecology", "Neurology", "Ophthalmology", "Pulmonology",
  "Gastroenterology", "Urology", "Psychiatry", "Oncology", "Nephrology",
];

const DOCTOR_FIRST = ["Rajesh", "Priya", "Ananya", "Vikram", "Meera", "Arjun", "Sonia", "Karthik", "Lakshmi", "Anil", "Deepa", "Suresh", "Kavitha", "Ramesh", "Sunita", "Harish", "Padma", "Ganesh", "Nisha", "Mohan"];
const DOCTOR_LAST = ["Sharma", "Patel", "Reddy", "Singh", "Krishnan", "Nair", "Gupta", "Iyer", "Rao", "Kumar", "Menon", "Joshi", "Shetty", "Babu", "Desai", "Kulkarni", "Hegde", "Tiwari", "Bhat", "Deshpande"];

const FIRST_NAMES = [
  "Aarav","Priya","Rohan","Sneha","Vikram","Ananya","Arjun","Kavitha","Rajesh","Meera",
  "Suresh","Deepa","Karthik","Lakshmi","Anil","Pooja","Ganesh","Sunita","Manoj","Rekha",
  "Amit","Divya","Prasad","Sujata","Ravi","Nisha","Srinivas","Padma","Rahul","Swati",
  "Naveen","Asha","Venkat","Geeta","Harish","Usha","Deepak","Sangeeta","Prakash","Kamala",
  "Ajay","Radha","Mohan","Bhavani","Sunil","Manjula","Raghu","Savitri","Krishna","Vijaya",
  "Sanjay","Anita","Ramesh","Saroja","Dinesh","Keerthi","Balaji","Shanti","Varun","Menaka",
  "Nikhil","Revathi","Chetan","Pushpa","Ashok","Geetha","Vinod","Janaki","Siddharth","Lavanya",
  "Pavan","Mythili","Aditya","Sowmya","Tarun","Bhavana","Sahil","Pallavi","Akash","Vasundara",
  "Gaurav","Sudha","Manish","Chithra","Vishal","Amala","Vivek","Saritha","Mahesh","Kalpana",
  "Pranav","Gayathri","Sachin","Devika","Kunal","Shruti","Roshan","Leela","Aman","Indira",
];
const LAST_NAMES = [
  "Sharma","Verma","Gupta","Patel","Reddy","Iyer","Nair","Rao","Kumar","Joshi",
  "Babu","Menon","Pillai","Devi","Shetty","Kulkarni","Hegde","Desai","Tiwari","Saxena",
  "Mishra","Chauhan","Mane","Bhat","Shankar","Agarwal","Raman","Deshpande","Jain","Patil",
  "Gowda","Mukherjee","Pandey","Chandra","Rani","Choudhary","Mohan","Sinha","Sundaram","Thakur",
  "Das","Kapoor","Veer","Bai","Murthy","Mahajan","Singh","Khan","Thomas","Nambiar",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ALLERGIES_LIST = ["Penicillin", "Aspirin", "Sulfonamides", "NSAIDs", "Dust", "Pollen", "Shellfish", "Peanuts", "Latex", "Iodine", "None"];

const MEDICINE_NAMES = [
  "Paracetamol 500mg","Amoxicillin 500mg","Cetirizine 10mg","Azithromycin 500mg",
  "Omeprazole 20mg","Metformin 500mg","Amlodipine 5mg","Ibuprofen 400mg",
  "Cough Syrup 100ml","Betadine Ointment","Pantoprazole 40mg","Montelukast 10mg",
  "Atorvastatin 10mg","Levofloxacin 500mg","Dolo 650mg","Ranitidine 150mg",
  "Doxycycline 100mg","Ciprofloxacin 500mg","Losartan 50mg","Glimepiride 2mg",
];
const DOSAGES = [
  "1 tab 3x/day","1 cap 2x/day","1 tab at night","1 tab once daily",
  "1 cap before breakfast","1 tab 2x after meals","1 tab once daily","1 tab as needed",
  "10ml 3x/day","Apply 2x/day","1 tab morning","1 tab evening",
];

const LAB_TESTS = [
  { name: "CBC", price: 350 }, { name: "Lipid Profile", price: 600 },
  { name: "Blood Sugar Fasting", price: 150 }, { name: "Blood Sugar PP", price: 150 },
  { name: "Thyroid Profile", price: 800 }, { name: "LFT", price: 700 },
  { name: "KFT", price: 650 }, { name: "Urine Routine", price: 200 },
  { name: "HbA1c", price: 500 }, { name: "Vitamin D", price: 1200 },
  { name: "Vitamin B12", price: 900 }, { name: "ECG", price: 300 },
  { name: "Serum Creatinine", price: 250 }, { name: "Serum Uric Acid", price: 250 },
  { name: "CRP", price: 400 }, { name: "ESR", price: 150 },
  { name: "Hemoglobin", price: 100 }, { name: "Blood Group", price: 200 },
  { name: "Dengue NS1", price: 600 }, { name: "Widal Test", price: 300 },
];

const DIAGNOSES = [
  "URTI","Hypertension Stage 1","Type 2 Diabetes","Acute Gastritis","Allergic Rhinitis",
  "Lower Back Pain","Migraine","UTI","Iron Deficiency Anemia","Vitamin D Deficiency",
  "Hypothyroidism","Osteoarthritis Knee","Dermatitis","Viral Fever","Bronchitis",
  "GERD","Cervical Spondylosis","Anxiety Disorder","Conjunctivitis","Otitis Media",
  "Dengue Fever","Pneumonia","Sinusitis","Plantar Fasciitis","Sciatica",
];

const WARDS = ["General Ward", "Semi-Private", "Private Room", "ICU", "NICU", "Maternity Ward", "Surgical Ward", "Pediatric Ward"];

const FEEDBACK_COMMENTS = [
  "Very good experience, doctor was thorough",
  "Good treatment, quick service",
  "Excellent care and follow-up",
  "Average experience, long wait time",
  "Doctor was very knowledgeable and patient",
  "Pharmacy was efficient and well stocked",
  "Clean facility, friendly staff",
  "Could improve appointment timing",
  "Very satisfied with the treatment",
  "Quick and professional consultation",
  "Staff was helpful and courteous",
  "Long waiting time but good consultation",
  "Doctor explained everything clearly",
  "Not satisfied with billing process",
  "Great experience overall, will recommend",
  "Lab results were delivered promptly",
  "Comfortable waiting area",
  "Doctor spent adequate time with me",
  "Parking could be improved",
  "Reception staff was very helpful",
];

const STAFF_ROLES = ["reception", "lab_tech", "pharmacist", "admin"];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function getISTDate(offsetDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000);
  return d.toISOString().split("T")[0];
}

function getISTTimestamp(offsetDays = 0, hour = 9, minute = 0) {
  const base = new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000);
  base.setUTCHours(hour - 5, minute - 30, 0, 0); // Convert IST to UTC
  return base.toISOString();
}

function genTimeSlots(startH, endH, durationMin) {
  const slots = [];
  for (let m = startH * 60; m + durationMin <= endH * 60; m += durationMin) {
    slots.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    );
  }
  return slots;
}

function genPhone() {
  return `91${randInt(7000000000, 9999999999)}`;
}

let _idCounter = 0;
function uid(prefix) {
  _idCounter++;
  return `${prefix}${Date.now()}${_idCounter}${randInt(10, 99)}`;
}

async function execQuery(client, sql, params) {
  try {
    const res = await client.query(sql, params);
    return res;
  } catch (e) {
    // Silently handle duplicates / constraint violations
    if (e.code === "23505" || e.code === "23503") return null;
    // Log unexpected errors but don't crash
    console.error(`  [WARN] ${e.message.substring(0, 120)}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function seedClients(db) {
  console.log("\n[1/14] Seeding CLIENTS...");
  let ct = 0;
  for (const c of CLIENTS) {
    const res = await execQuery(db,
      `INSERT INTO clients (client_id, name, status, admin_pin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO NOTHING`,
      [c.client_id, c.name, c.status, c.admin_pin]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} new clients inserted (${CLIENTS.length} total)`);
}

async function seedTenants(db) {
  console.log("\n[2/14] Seeding TENANTS (branches)...");
  let ct = 0;
  for (const t of TENANTS) {
    const res = await execQuery(db,
      `INSERT INTO tenants (tenant_id, hospital_name, client_id, status, phone, address, admin_pin, reception_pin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [t.tenant_id, t.hospital_name, t.client_id, t.status, t.phone, t.address, t.admin_pin, t.reception_pin]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} new tenants inserted (${TENANTS.length} total)`);
}

async function seedClientConfigs(db) {
  console.log("\n[3/14] Seeding CLIENT_CONFIGS...");
  let ct = 0;
  for (const cc of CLIENT_CONFIGS) {
    const res = await execQuery(db,
      `INSERT INTO client_configs (client_id, tier, features, limits)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO NOTHING`,
      [cc.client_id, cc.tier, JSON.stringify(cc.features), JSON.stringify(cc.limits)]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} new client_configs inserted`);
}

async function seedDoctors(db) {
  console.log("\n[4/14] Seeding DOCTORS (20 total)...");
  const doctors = [];

  // 7 existing doctors for T001 — skip insertion but include in array for reference
  const existingDocs = [
    { doctor_id: "DOC001", name: "Dr. Rajesh Sharma", specialty: "Cardiology", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC002", name: "Dr. Priya Patel", specialty: "Orthopedics", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC003", name: "Dr. Ananya Reddy", specialty: "Dermatology", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC004", name: "Dr. Vikram Singh", specialty: "General Medicine", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC005", name: "Dr. Meera Krishnan", specialty: "Pediatrics", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC006", name: "Dr. Arjun Nair", specialty: "ENT", tenant_id: "T001", client_id: "CL001" },
    { doctor_id: "DOC007", name: "Dr. Sonia Gupta", specialty: "Gynecology", tenant_id: "T001", client_id: "CL001" },
  ];
  doctors.push(...existingDocs);

  // New doctors for other branches
  const branchDoctorMap = [
    { tenant_id: "T1772293744327", client_id: "CL001", count: 3, startIdx: 8 },
    { tenant_id: "T-CITY-01", client_id: "CL002", count: 4, startIdx: 11 },
    { tenant_id: "T-CITY-02", client_id: "CL002", count: 3, startIdx: 15 },
    { tenant_id: "T-APOLLO-01", client_id: "CL003", count: 3, startIdx: 18 },
  ];

  let ct = 0;
  let docNum = 8;
  for (const branch of branchDoctorMap) {
    for (let i = 0; i < branch.count; i++) {
      const fn = DOCTOR_FIRST[docNum % DOCTOR_FIRST.length];
      const ln = DOCTOR_LAST[docNum % DOCTOR_LAST.length];
      const spec = SPECIALTIES[docNum % SPECIALTIES.length];
      const doc = {
        doctor_id: `DOC${String(docNum).padStart(3, "0")}`,
        name: `Dr. ${fn} ${ln}`,
        specialty: spec,
        phone: genPhone(),
        consultation_fee: randInt(300, 1500),
        status: "active",
        tenant_id: branch.tenant_id,
        client_id: branch.client_id,
        pin: String(1000 + docNum),
      };
      doctors.push(doc);

      const res = await execQuery(db,
        `INSERT INTO doctors (doctor_id, name, specialty, phone, consultation_fee, status, tenant_id, client_id, pin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (doctor_id) DO NOTHING`,
        [doc.doctor_id, doc.name, doc.specialty, doc.phone, doc.consultation_fee, doc.status, doc.tenant_id, doc.client_id, doc.pin]
      );
      if (res && res.rowCount > 0) ct++;
      docNum++;
    }
  }
  console.log(`   -> ${ct} new doctors inserted (${doctors.length} total across all branches)`);
  return doctors;
}

async function seedPatients(db) {
  console.log("\n[5/14] Seeding PATIENTS (500 total)...");

  const patients = [];
  // Distribution: T001 = 200 (50 exist + 150 new), others = 100 each
  const branchPatientCounts = [
    { tenant_id: "T001", client_id: "CL001", total: 200, existingCount: 50 },
    { tenant_id: "T1772293744327", client_id: "CL001", total: 75, existingCount: 0 },
    { tenant_id: "T-CITY-01", client_id: "CL002", total: 75, existingCount: 0 },
    { tenant_id: "T-CITY-02", client_id: "CL002", total: 75, existingCount: 0 },
    { tenant_id: "T-APOLLO-01", client_id: "CL003", total: 75, existingCount: 0 },
  ];

  let ct = 0;
  let phoneCounter = 0;

  for (const branch of branchPatientCounts) {
    for (let i = 0; i < branch.total; i++) {
      phoneCounter++;
      const fn = FIRST_NAMES[phoneCounter % FIRST_NAMES.length];
      const ln = LAST_NAMES[phoneCounter % LAST_NAMES.length];
      const age = 18 + (phoneCounter * 37 % 62);
      const gender = phoneCounter % 2 === 0 ? "Male" : "Female";
      const phone = `91${String(6000000000 + phoneCounter)}`;
      const bg = BLOOD_GROUPS[phoneCounter % BLOOD_GROUPS.length];
      const allergy = Math.random() < 0.3 ? rand(ALLERGIES_LIST.filter(a => a !== "None")) : "None";

      const pat = {
        phone,
        name: `${fn} ${ln}`,
        age,
        gender,
        tenant_id: branch.tenant_id,
        client_id: branch.client_id,
        blood_group: bg,
        allergies: allergy,
      };
      patients.push(pat);

      const res = await execQuery(db,
        `INSERT INTO patients (phone, name, age, gender, tenant_id, client_id, blood_group, allergies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [pat.phone, pat.name, pat.age, pat.gender, pat.tenant_id, pat.client_id, pat.blood_group, pat.allergies]
      );
      if (res && res.rowCount > 0) ct++;
    }
  }
  console.log(`   -> ${ct} new patients inserted (${patients.length} generated across branches)`);
  return patients;
}

async function seedAppointments(db, doctors, patients) {
  console.log("\n[6/14] Seeding APPOINTMENTS (500)...");
  const allSlots = [...genTimeSlots(9, 13, 20), ...genTimeSlots(14, 18, 20)];
  const SOURCES = ["dashboard", "whatsapp", "patient_portal"];
  const appointments = [];

  // Group patients and doctors by tenant
  const patByTenant = {};
  const docByTenant = {};
  for (const p of patients) {
    if (!patByTenant[p.tenant_id]) patByTenant[p.tenant_id] = [];
    patByTenant[p.tenant_id].push(p);
  }
  for (const d of doctors) {
    if (!docByTenant[d.tenant_id]) docByTenant[d.tenant_id] = [];
    docByTenant[d.tenant_id].push(d);
  }

  let ct = 0;
  const targetPerTenant = { "T001": 150, "T1772293744327": 100, "T-CITY-01": 100, "T-CITY-02": 75, "T-APOLLO-01": 75 };

  for (const [tenantId, target] of Object.entries(targetPerTenant)) {
    const tenantDocs = docByTenant[tenantId] || [];
    const tenantPats = patByTenant[tenantId] || [];
    if (tenantDocs.length === 0 || tenantPats.length === 0) continue;

    const clientId = tenantPats[0].client_id;

    for (let i = 0; i < target; i++) {
      const dayOffset = randInt(-30, 3);
      const date = getISTDate(dayOffset);
      const isPast = dayOffset < 0;
      const isToday = dayOffset === 0;

      const doc = rand(tenantDocs);
      const pat = rand(tenantPats);
      const slot = rand(allSlots);

      let status;
      if (isPast) {
        const r = Math.random();
        if (r < 0.6) status = "completed";
        else if (r < 0.8) status = "confirmed";
        else if (r < 0.9) status = "cancelled";
        else status = "no_show";
      } else if (isToday) {
        const r = Math.random();
        if (r < 0.3) status = "completed";
        else if (r < 0.7) status = "confirmed";
        else if (r < 0.85) status = "cancelled";
        else status = "no_show";
      } else {
        status = Math.random() < 0.85 ? "confirmed" : "cancelled";
      }

      const bookingId = uid("BK");
      const appt = {
        booking_id: bookingId,
        patient_phone: pat.phone,
        patient_name: pat.name,
        doctor_id: doc.doctor_id,
        doctor_name: doc.name,
        specialty: doc.specialty,
        date,
        time: slot,
        status,
        tenant_id: tenantId,
        client_id: clientId,
        source: rand(SOURCES),
      };
      appointments.push(appt);

      const res = await execQuery(db,
        `INSERT INTO appointments (booking_id, patient_phone, patient_name, doctor_id, doctor_name, specialty, date, time, status, tenant_id, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (booking_id) DO NOTHING`,
        [appt.booking_id, appt.patient_phone, appt.patient_name, appt.doctor_id, appt.doctor_name, appt.specialty, appt.date, appt.time, appt.status, appt.tenant_id, appt.client_id]
      );
      if (res && res.rowCount > 0) ct++;
    }
  }
  console.log(`   -> ${ct} appointments inserted (${appointments.length} generated)`);
  return appointments;
}

async function seedInvoices(db, appointments) {
  console.log("\n[7/14] Seeding INVOICES (200)...");
  const TYPES = ["consultation", "pharmacy", "lab"];
  const PAYMENT_STATUSES = ["paid", "unpaid", "partial"];
  let ct = 0;

  // Pick 200 appointments for invoices, preferring completed ones
  const completed = appointments.filter(a => a.status === "completed");
  const confirmed = appointments.filter(a => a.status === "confirmed");
  const pool = [...completed, ...confirmed].slice(0, 250);

  for (let i = 0; i < 200 && i < pool.length; i++) {
    const a = pool[i];
    const type = rand(TYPES);
    let items, subtotal;

    if (type === "consultation") {
      const fee = randInt(300, 1500);
      items = [{ description: `Consultation - ${a.doctor_name}`, amount: fee }];
      subtotal = fee;
    } else if (type === "pharmacy") {
      const n = randInt(1, 4);
      items = [];
      subtotal = 0;
      for (let j = 0; j < n; j++) {
        const amt = randInt(50, 500);
        items.push({ description: rand(MEDICINE_NAMES), quantity: randInt(1, 3), amount: amt });
        subtotal += amt;
      }
    } else {
      const n = randInt(1, 3);
      items = [];
      subtotal = 0;
      for (let j = 0; j < n; j++) {
        const test = rand(LAB_TESTS);
        items.push({ description: test.name, amount: test.price });
        subtotal += test.price;
      }
    }

    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;
    const paymentStatus = rand(PAYMENT_STATUSES);
    const invoiceId = uid("INV");
    const createdAt = getISTTimestamp(randInt(-30, 0), randInt(8, 18), randInt(0, 59));

    const res = await execQuery(db,
      `INSERT INTO invoices (invoice_id, patient_phone, patient_name, type, items, subtotal, tax, total, payment_status, tenant_id, client_id, booking_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (invoice_id) DO NOTHING`,
      [invoiceId, a.patient_phone, a.patient_name, type, JSON.stringify(items), subtotal, tax, total, paymentStatus, a.tenant_id, a.client_id, a.booking_id, createdAt]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} invoices inserted`);
}

async function seedQueueEntries(db, appointments) {
  console.log("\n[8/14] Seeding QUEUE_ENTRIES (100 for today)...");
  const today = getISTDate(0);
  const todayAppts = appointments.filter(a => a.date === today && a.status !== "cancelled");
  let ct = 0;

  // Take up to 100
  const pool = todayAppts.slice(0, 100);
  const queueStatuses = ["waiting", "in_consultation", "completed", "no_show"];

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    const qStatus = a.status === "completed" ? "completed" : rand(queueStatuses);
    const priority = Math.random() < 0.1 ? "urgent" : "normal";
    const checkInHour = randInt(8, 16);
    const checkInMin = randInt(0, 59);
    const checkInTime = `${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}`;

    let consultStart = null;
    let consultEnd = null;
    if (qStatus === "in_consultation" || qStatus === "completed") {
      const csH = checkInHour;
      const csM = checkInMin + randInt(5, 30);
      consultStart = `${String(csH).padStart(2, "0")}:${String(csM % 60).padStart(2, "0")}`;
      if (qStatus === "completed") {
        const ceM = csM + randInt(10, 25);
        consultEnd = `${String(csH + Math.floor(ceM / 60)).padStart(2, "0")}:${String(ceM % 60).padStart(2, "0")}`;
      }
    }

    const res = await execQuery(db,
      `INSERT INTO queue_entries (tenant_id, date, queue_number, patient_phone, patient_name, doctor_id, doctor_name, status, priority, check_in_time, consultation_start, consultation_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [a.tenant_id, today, i + 1, a.patient_phone, a.patient_name, a.doctor_id, a.doctor_name, qStatus, priority, checkInTime, consultStart, consultEnd]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} queue entries inserted`);
}

async function seedPrescriptions(db, appointments) {
  console.log("\n[9/14] Seeding PRESCRIPTIONS (100)...");
  const completed = appointments.filter(a => a.status === "completed");
  let ct = 0;

  for (let i = 0; i < 100 && i < completed.length; i++) {
    const a = completed[i];
    const diagnosis = rand(DIAGNOSES);
    const nMeds = randInt(1, 5);
    const medicines = [];
    const used = new Set();
    for (let j = 0; j < nMeds; j++) {
      let med;
      do { med = rand(MEDICINE_NAMES); } while (used.has(med));
      used.add(med);
      medicines.push({
        medicine_name: med,
        dosage: rand(DOSAGES),
        duration: `${randInt(3, 14)} days`,
        quantity: randInt(5, 30),
      });
    }

    const rxId = uid("RX");
    const createdAt = getISTTimestamp(randInt(-30, 0), randInt(9, 17), randInt(0, 59));

    const res = await execQuery(db,
      `INSERT INTO prescriptions (prescription_id, patient_phone, patient_name, doctor_id, doctor_name, diagnosis, medicines, tenant_id, client_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (prescription_id) DO NOTHING`,
      [rxId, a.patient_phone, a.patient_name, a.doctor_id, a.doctor_name, diagnosis, JSON.stringify(medicines), a.tenant_id, a.client_id, createdAt]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} prescriptions inserted`);
}

async function seedLabOrders(db, appointments) {
  console.log("\n[10/14] Seeding LAB_ORDERS (50)...");
  const completed = appointments.filter(a => a.status === "completed");
  const LAB_STATUSES = ["ordered", "sample_collected", "in_progress", "completed", "reported"];
  let ct = 0;

  for (let i = 0; i < 50 && i < completed.length; i++) {
    const a = completed[i];
    const nTests = randInt(1, 4);
    const tests = [];
    const used = new Set();
    let totalAmount = 0;
    for (let j = 0; j < nTests; j++) {
      let test;
      do { test = rand(LAB_TESTS); } while (used.has(test.name));
      used.add(test.name);
      tests.push({ test_name: test.name, price: test.price });
      totalAmount += test.price;
    }

    const orderId = uid("LO");
    const status = rand(LAB_STATUSES);
    const priority = Math.random() < 0.15 ? "urgent" : "normal";

    const res = await execQuery(db,
      `INSERT INTO lab_orders (order_id, patient_phone, patient_name, doctor_id, doctor_name, tests, status, total_amount, tenant_id, client_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId, a.patient_phone, a.patient_name, a.doctor_id, a.doctor_name, JSON.stringify(tests), status, totalAmount, a.tenant_id, a.client_id, priority]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} lab orders inserted`);
}

async function seedPharmacyOrders(db, appointments) {
  console.log("\n[11/14] Seeding PHARMACY_ORDERS (30)...");
  const completed = appointments.filter(a => a.status === "completed");
  const PHARM_STATUSES = ["pending", "preparing", "dispensed", "cancelled"];
  let ct = 0;

  for (let i = 0; i < 30 && i < completed.length; i++) {
    const a = completed[i];
    const nItems = randInt(1, 5);
    const items = [];
    let totalAmount = 0;
    for (let j = 0; j < nItems; j++) {
      const qty = randInt(1, 3);
      const price = randInt(30, 500);
      items.push({
        medicine_name: rand(MEDICINE_NAMES),
        quantity: qty,
        price_per_unit: price,
        amount: qty * price,
      });
      totalAmount += qty * price;
    }

    const orderId = uid("PH");
    const status = rand(PHARM_STATUSES);

    const res = await execQuery(db,
      `INSERT INTO pharmacy_orders (order_id, patient_phone, patient_name, items, total_amount, status, tenant_id, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId, a.patient_phone, a.patient_name, JSON.stringify(items), totalAmount, status, a.tenant_id, a.client_id]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} pharmacy orders inserted`);
}

async function seedAdmissions(db, appointments, doctors, patients) {
  console.log("\n[12/14] Seeding ADMISSIONS (20)...");
  const ADM_STATUSES = ["admitted", "discharged", "transferred"];
  let ct = 0;

  // Group docs and patients by tenant
  const docByTenant = {};
  const patByTenant = {};
  for (const d of doctors) {
    if (!docByTenant[d.tenant_id]) docByTenant[d.tenant_id] = [];
    docByTenant[d.tenant_id].push(d);
  }
  for (const p of patients) {
    if (!patByTenant[p.tenant_id]) patByTenant[p.tenant_id] = [];
    patByTenant[p.tenant_id].push(p);
  }

  const tenants = ["T001", "T1772293744327", "T-CITY-01", "T-CITY-02", "T-APOLLO-01"];
  const clientMap = { "T001": "CL001", "T1772293744327": "CL001", "T-CITY-01": "CL002", "T-CITY-02": "CL002", "T-APOLLO-01": "CL003" };

  for (let i = 0; i < 20; i++) {
    const tenantId = tenants[i % tenants.length];
    const clientId = clientMap[tenantId];
    const tenantDocs = docByTenant[tenantId] || [];
    const tenantPats = patByTenant[tenantId] || [];
    if (tenantDocs.length === 0 || tenantPats.length === 0) continue;

    const doc = rand(tenantDocs);
    const pat = rand(tenantPats);
    const daysAgo = randInt(1, 25);
    const admDate = getISTDate(-daysAgo);
    const status = daysAgo > 7 ? (Math.random() < 0.7 ? "discharged" : "admitted") : "admitted";
    const expectedDischarge = getISTDate(-daysAgo + randInt(3, 14));
    const ward = rand(WARDS);
    const bed = `${ward.charAt(0)}${randInt(101, 320)}`;

    const admId = uid("ADM");

    const res = await execQuery(db,
      `INSERT INTO admissions (admission_id, patient_phone, patient_name, doctor_id, doctor_name, ward, bed_number, diagnosis, status, tenant_id, client_id, admission_date, expected_discharge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (admission_id) DO NOTHING`,
      [admId, pat.phone, pat.name, doc.doctor_id, doc.name, ward, bed, rand(DIAGNOSES), status, tenantId, clientId, admDate, expectedDischarge]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} admissions inserted`);
}

async function seedStaff(db) {
  console.log("\n[13/14] Seeding STAFF (10 for new branches)...");
  const newBranches = [
    { tenant_id: "T-CITY-01", client_id: "CL002" },
    { tenant_id: "T-CITY-02", client_id: "CL002" },
    { tenant_id: "T-APOLLO-01", client_id: "CL003" },
  ];

  const staffNames = [
    "Priya Nair", "Rahul Menon", "Sunita Rao", "Arun Kumar",
    "Kavitha Babu", "Deepak Joshi", "Anita Sharma", "Venkat Reddy",
    "Meera Pillai", "Sanjay Das",
  ];

  let ct = 0;
  let idx = 0;
  for (const branch of newBranches) {
    const rolesForBranch = idx < 2
      ? ["reception", "lab_tech", "pharmacist", "admin"]
      : ["reception", "lab_tech"];

    for (const role of rolesForBranch) {
      const name = staffNames[idx % staffNames.length];
      const email = `${name.toLowerCase().replace(/ /g, ".")}@${branch.tenant_id.toLowerCase().replace(/[^a-z0-9]/g, "")}.hospital.com`;
      const pin = String(2000 + idx);

      const res = await execQuery(db,
        `INSERT INTO staff (email, name, role, pin, tenant_id, client_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (email) DO NOTHING`,
        [email, name, role, pin, branch.tenant_id, branch.client_id]
      );
      if (res && res.rowCount > 0) ct++;
      idx++;
    }
  }
  console.log(`   -> ${ct} staff entries inserted`);
}

async function seedFeedback(db, appointments) {
  console.log("\n[14/14] Seeding FEEDBACK (30)...");
  const completed = appointments.filter(a => a.status === "completed");
  let ct = 0;

  for (let i = 0; i < 30 && i < completed.length; i++) {
    const a = completed[i];
    const rating = randInt(1, 5);
    const comment = rand(FEEDBACK_COMMENTS);
    const createdAt = getISTTimestamp(randInt(-30, 0), randInt(10, 20), randInt(0, 59));

    const res = await execQuery(db,
      `INSERT INTO feedback (patient_phone, patient_name, doctor_name, rating, comment, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [a.patient_phone, a.patient_name, a.doctor_name, rating, comment, a.tenant_id, createdAt]
    );
    if (res && res.rowCount > 0) ct++;
  }
  console.log(`   -> ${ct} feedback entries inserted`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   MEGA TEST DATA SEEDER — Multi-Client, Multi-Branch       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\nConnecting to Supabase...`);

  try {
    await db.connect();
    console.log("Connected successfully.\n");

    // Seed in dependency order
    await seedClients(db);
    await seedTenants(db);
    await seedClientConfigs(db);
    const doctors = await seedDoctors(db);
    const patients = await seedPatients(db);
    const appointments = await seedAppointments(db, doctors, patients);
    await seedInvoices(db, appointments);
    await seedQueueEntries(db, appointments);
    await seedPrescriptions(db, appointments);
    await seedLabOrders(db, appointments);
    await seedPharmacyOrders(db, appointments);
    await seedAdmissions(db, appointments, doctors, patients);
    await seedStaff(db);
    await seedFeedback(db, appointments);

    // Print summary
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   SEEDING COMPLETE — Verifying counts...                   ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const tables = [
      "clients", "tenants", "client_configs", "doctors", "patients",
      "appointments", "invoices", "queue_entries", "prescriptions",
      "lab_orders", "pharmacy_orders", "admissions", "staff", "feedback",
    ];

    for (const table of tables) {
      try {
        const res = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table.padEnd(22)} ${res.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${table.padEnd(22)} [table not found or error]`);
      }
    }

    // Per-tenant breakdown
    console.log("\n  --- Per-Tenant Breakdown (patients / appointments) ---");
    for (const t of TENANTS) {
      try {
        const pRes = await db.query(`SELECT COUNT(*) as c FROM patients WHERE tenant_id = $1`, [t.tenant_id]);
        const aRes = await db.query(`SELECT COUNT(*) as c FROM appointments WHERE tenant_id = $1`, [t.tenant_id]);
        console.log(`  ${t.tenant_id.padEnd(22)} ${pRes.rows[0].c} patients / ${aRes.rows[0].c} appointments`);
      } catch (e) {
        console.log(`  ${t.tenant_id.padEnd(22)} [error]`);
      }
    }

  } catch (err) {
    console.error("\nFATAL ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.end();
    console.log("\nDatabase connection closed. Done!");
  }
}

main();
