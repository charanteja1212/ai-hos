const te: Record<string, string> = {
  // ── Nav ──────────────────────────────────────────────
  "nav.overview": "అవలోకనం",
  "nav.operations": "కార్యకలాపాలు",
  "nav.management": "నిర్వహణ",
  "nav.clinical": "వైద్య",
  "nav.finance": "ఆర్థిక",
  "nav.settings": "సెట్టింగ్స్",
  "nav.today": "ఈ రోజు",
  "nav.records": "రికార్డులు",
  "nav.availability": "అందుబాటు",
  "nav.orders": "ఆర్డర్లు",
  "nav.work": "పని",
  "nav.home": "హోమ్",
  "nav.health": "ఆరోగ్యం",
  "nav.account": "ఖాతా",

  // ── Common Actions ──────────────────────────────────
  "common.save": "సేవ్ చేయండి",
  "common.cancel": "రద్దు చేయండి",
  "common.delete": "తొలగించండి",
  "common.edit": "సవరించండి",
  "common.search": "వెతకండి",
  "common.filter": "ఫిల్టర్",
  "common.add": "జోడించండి",
  "common.back": "వెనక్కి",
  "common.submit": "సమర్పించండి",
  "common.confirm": "నిర్ధారించండి",
  "common.close": "మూసివేయండి",
  "common.refresh": "రిఫ్రెష్",
  "common.loading": "లోడ్ అవుతోంది",
  "common.noResults": "ఫలితాలు లేవు",
  "common.viewAll": "అన్నీ చూడండి",

  // ── Common Labels ───────────────────────────────────
  "common.name": "పేరు",
  "common.email": "ఇమెయిల్",
  "common.phone": "ఫోన్",
  "common.date": "తేదీ",
  "common.time": "సమయం",
  "common.status": "స్థితి",
  "common.actions": "చర్యలు",
  "common.total": "మొత్తం",
  "common.amount": "మొత్తం",
  "common.description": "వివరణ",

  // ── Auth ────────────────────────────────────────────
  "auth.login": "లాగిన్",
  "auth.logout": "లాగౌట్",
  "auth.signIn": "సైన్ ఇన్",
  "auth.pin": "పిన్",
  "auth.selectBranch": "బ్రాంచ్ ఎంచుకోండి",
  "auth.selectRole": "పాత్ర ఎంచుకోండి",

  // ── Roles ───────────────────────────────────────────
  "role.doctor": "డాక్టర్",
  "role.reception": "రిసెప్షన్",
  "role.admin": "అడ్మిన్",
  "role.pharmacist": "ఫార్మసిస్ట్",
  "role.labTech": "ల్యాబ్ టెక్",
  "role.patient": "రోగి",
  "role.superAdmin": "సూపర్ అడ్మిన్",

  // ── Dashboard Stats ─────────────────────────────────
  "dashboard.todayAppointments": "ఈ రోజు అపాయింట్‌మెంట్లు",
  "dashboard.totalPatients": "మొత్తం రోగులు",
  "dashboard.revenue": "ఆదాయం",
  "dashboard.queueLength": "క్యూ పొడవు",
  "dashboard.activeDoctors": "యాక్టివ్ డాక్టర్లు",
  "dashboard.pendingLabOrders": "పెండింగ్ ల్యాబ్ ఆర్డర్లు",

  // ── Queue ───────────────────────────────────────────
  "queue.board": "క్యూ బోర్డ్",
  "queue.checkIn": "చెక్ ఇన్",
  "queue.checkedIn": "చెక్ ఇన్ అయింది",
  "queue.consulting": "సంప్రదింపు",
  "queue.completed": "పూర్తయింది",
  "queue.waiting": "వేచి ఉంది",
  "queue.noShow": "రాలేదు",
  "queue.walkIn": "వాక్-ఇన్",

  // ── Booking ─────────────────────────────────────────
  "booking.bookAppointment": "అపాయింట్‌మెంట్ బుక్ చేయండి",
  "booking.walkInBooking": "వాక్-ఇన్ బుకింగ్",
  "booking.selectDoctor": "డాక్టర్ ఎంచుకోండి",
  "booking.selectDate": "తేదీ ఎంచుకోండి",
  "booking.selectTime": "సమయం ఎంచుకోండి",
  "booking.consultationFee": "సంప్రదింపు రుసుము",
  "booking.patientName": "రోగి పేరు",
  "booking.patientPhone": "రోగి ఫోన్",

  // ── Consultation / Vitals ───────────────────────────
  "clinical.consult": "సంప్రదింపు",
  "clinical.vitals": "వైటల్స్",
  "clinical.bloodPressure": "రక్తపోటు",
  "clinical.pulse": "పల్స్",
  "clinical.temperature": "ఉష్ణోగ్రత",
  "clinical.spo2": "SpO2",
  "clinical.weight": "బరువు",
  "clinical.diagnosis": "రోగ నిర్ధారణ",
  "clinical.prescription": "ప్రిస్క్రిప్షన్",
  "clinical.clinicalNotes": "వైద్య నోట్స్",

  // ── Pharmacy ────────────────────────────────────────
  "pharmacy.orders": "ఫార్మసీ ఆర్డర్లు",
  "pharmacy.dispense": "అందజేయండి",
  "pharmacy.dispensed": "అందజేయబడింది",
  "pharmacy.pending": "పెండింగ్",
  "pharmacy.medicine": "మందు",
  "pharmacy.dosage": "డోసేజ్",
  "pharmacy.duration": "వ్యవధి",
  "pharmacy.quantity": "పరిమాణం",

  // ── Lab ─────────────────────────────────────────────
  "lab.orders": "ల్యాబ్ ఆర్డర్లు",
  "lab.sampleCollected": "శాంపిల్ సేకరించబడింది",
  "lab.reportReady": "రిపోర్ట్ సిద్ధం",
  "lab.testName": "టెస్ట్ పేరు",
  "lab.result": "ఫలితం",
  "lab.normalRange": "సాధారణ పరిధి",

  // ── Admin / Settings ────────────────────────────────
  "settings.hospitalSettings": "హాస్పిటల్ సెట్టింగ్స్",
  "settings.consultationFee": "సంప్రదింపు రుసుము",
  "settings.adminPin": "అడ్మిన్ పిన్",
  "settings.receptionPin": "రిసెప్షన్ పిన్",

  // ── Billing ─────────────────────────────────────────
  "billing.billing": "బిల్లింగ్",
  "billing.invoice": "ఇన్వాయిస్",
  "billing.payment": "చెల్లింపు",
  "billing.paid": "చెల్లించబడింది",
  "billing.unpaid": "చెల్లించలేదు",
  "billing.due": "బకాయి",

  // ── Analytics ───────────────────────────────────────
  "analytics.analytics": "విశ్లేషణలు",
  "analytics.revenueChart": "ఆదాయ చార్ట్",
  "analytics.appointmentTrends": "అపాయింట్‌మెంట్ ట్రెండ్స్",
  "analytics.doctorPerformance": "డాక్టర్ పనితీరు",

  // ── Patient Portal ──────────────────────────────────
  "patient.myAppointments": "నా అపాయింట్‌మెంట్లు",
  "patient.bookAppointment": "అపాయింట్‌మెంట్ బుక్ చేయండి",
  "patient.myPrescriptions": "నా ప్రిస్క్రిప్షన్లు",
  "patient.labResults": "ల్యాబ్ ఫలితాలు",
  "patient.invoices": "ఇన్వాయిస్‌లు",
  "patient.profile": "ప్రొఫైల్",
  "patient.opPass": "OP పాస్",
}

export default te
