const hi: Record<string, string> = {
  // ── Nav ──────────────────────────────────────────────
  "nav.overview": "अवलोकन",
  "nav.operations": "संचालन",
  "nav.management": "प्रबंधन",
  "nav.clinical": "नैदानिक",
  "nav.finance": "वित्त",
  "nav.settings": "सेटिंग्स",
  "nav.today": "आज",
  "nav.records": "रिकॉर्ड्स",
  "nav.availability": "उपलब्धता",
  "nav.orders": "ऑर्डर्स",
  "nav.work": "कार्य",
  "nav.home": "होम",
  "nav.health": "स्वास्थ्य",
  "nav.account": "खाता",

  // ── Common Actions ──────────────────────────────────
  "common.save": "सहेजें",
  "common.cancel": "रद्द करें",
  "common.delete": "हटाएं",
  "common.edit": "संपादित करें",
  "common.search": "खोजें",
  "common.filter": "फ़िल्टर",
  "common.add": "जोड़ें",
  "common.back": "वापस",
  "common.submit": "जमा करें",
  "common.confirm": "पुष्टि करें",
  "common.close": "बंद करें",
  "common.refresh": "रिफ्रेश करें",
  "common.loading": "लोड हो रहा है",
  "common.noResults": "कोई परिणाम नहीं",
  "common.viewAll": "सभी देखें",

  // ── Common Labels ───────────────────────────────────
  "common.name": "नाम",
  "common.email": "ईमेल",
  "common.phone": "फ़ोन",
  "common.date": "तारीख",
  "common.time": "समय",
  "common.status": "स्थिति",
  "common.actions": "कार्रवाई",
  "common.total": "कुल",
  "common.amount": "राशि",
  "common.description": "विवरण",

  // ── Auth ────────────────────────────────────────────
  "auth.login": "लॉगिन",
  "auth.logout": "लॉगआउट",
  "auth.signIn": "साइन इन",
  "auth.pin": "पिन",
  "auth.selectBranch": "शाखा चुनें",
  "auth.selectRole": "भूमिका चुनें",

  // ── Roles ───────────────────────────────────────────
  "role.doctor": "डॉक्टर",
  "role.reception": "रिसेप्शन",
  "role.admin": "एडमिन",
  "role.pharmacist": "फार्मासिस्ट",
  "role.labTech": "लैब तकनीशियन",
  "role.patient": "मरीज़",
  "role.superAdmin": "सुपर एडमिन",

  // ── Dashboard Stats ─────────────────────────────────
  "dashboard.todayAppointments": "आज की अपॉइंटमेंट्स",
  "dashboard.totalPatients": "कुल मरीज़",
  "dashboard.revenue": "राजस्व",
  "dashboard.queueLength": "कतार की लंबाई",
  "dashboard.activeDoctors": "सक्रिय डॉक्टर",
  "dashboard.pendingLabOrders": "लंबित लैब ऑर्डर",

  // ── Queue ───────────────────────────────────────────
  "queue.board": "कतार बोर्ड",
  "queue.checkIn": "चेक इन",
  "queue.checkedIn": "चेक इन हुआ",
  "queue.consulting": "परामर्श जारी",
  "queue.completed": "पूर्ण",
  "queue.waiting": "प्रतीक्षा में",
  "queue.noShow": "अनुपस्थित",
  "queue.walkIn": "वॉक-इन",

  // ── Booking ─────────────────────────────────────────
  "booking.bookAppointment": "अपॉइंटमेंट बुक करें",
  "booking.walkInBooking": "वॉक-इन बुकिंग",
  "booking.selectDoctor": "डॉक्टर चुनें",
  "booking.selectDate": "तारीख चुनें",
  "booking.selectTime": "समय चुनें",
  "booking.consultationFee": "परामर्श शुल्क",
  "booking.patientName": "मरीज़ का नाम",
  "booking.patientPhone": "मरीज़ का फ़ोन",

  // ── Consultation / Vitals ───────────────────────────
  "clinical.consult": "परामर्श",
  "clinical.vitals": "वाइटल्स",
  "clinical.bloodPressure": "रक्तचाप",
  "clinical.pulse": "नाड़ी",
  "clinical.temperature": "तापमान",
  "clinical.spo2": "SpO2",
  "clinical.weight": "वज़न",
  "clinical.diagnosis": "निदान",
  "clinical.prescription": "नुस्खा",
  "clinical.clinicalNotes": "नैदानिक नोट्स",

  // ── Pharmacy ────────────────────────────────────────
  "pharmacy.orders": "फार्मेसी ऑर्डर",
  "pharmacy.dispense": "वितरण करें",
  "pharmacy.dispensed": "वितरित",
  "pharmacy.pending": "लंबित",
  "pharmacy.medicine": "दवाई",
  "pharmacy.dosage": "खुराक",
  "pharmacy.duration": "अवधि",
  "pharmacy.quantity": "मात्रा",

  // ── Lab ─────────────────────────────────────────────
  "lab.orders": "लैब ऑर्डर",
  "lab.sampleCollected": "नमूना एकत्रित",
  "lab.reportReady": "रिपोर्ट तैयार",
  "lab.testName": "परीक्षण का नाम",
  "lab.result": "परिणाम",
  "lab.normalRange": "सामान्य सीमा",

  // ── Admin / Settings ────────────────────────────────
  "settings.hospitalSettings": "अस्पताल सेटिंग्स",
  "settings.consultationFee": "परामर्श शुल्क",
  "settings.adminPin": "एडमिन पिन",
  "settings.receptionPin": "रिसेप्शन पिन",

  // ── Billing ─────────────────────────────────────────
  "billing.billing": "बिलिंग",
  "billing.invoice": "चालान",
  "billing.payment": "भुगतान",
  "billing.paid": "भुगतान हुआ",
  "billing.unpaid": "अवैतनिक",
  "billing.due": "बकाया",

  // ── Analytics ───────────────────────────────────────
  "analytics.analytics": "विश्लेषण",
  "analytics.revenueChart": "राजस्व चार्ट",
  "analytics.appointmentTrends": "अपॉइंटमेंट रुझान",
  "analytics.doctorPerformance": "डॉक्टर प्रदर्शन",

  // ── Patient Portal ──────────────────────────────────
  "patient.myAppointments": "मेरी अपॉइंटमेंट्स",
  "patient.bookAppointment": "अपॉइंटमेंट बुक करें",
  "patient.myPrescriptions": "मेरे नुस्खे",
  "patient.labResults": "लैब परिणाम",
  "patient.invoices": "चालान",
  "patient.profile": "प्रोफ़ाइल",
  "patient.opPass": "ओपी पास",
}

export default hi
