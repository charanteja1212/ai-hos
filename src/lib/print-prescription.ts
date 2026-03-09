interface PrintPrescriptionData {
  hospitalName: string
  doctorName: string
  doctorSpecialty?: string
  patientName: string
  patientPhone?: string
  patientAge?: string
  patientGender?: string
  date: string
  symptoms?: string
  diagnosis?: string
  vitals?: { bp?: string; pulse?: string; temp?: string; spo2?: string; weight?: string }
  medicines?: { medicine_name: string; dosage?: string; frequency?: string; duration?: string }[]
  labTests?: string[]
  notes?: string
  followUpDate?: string | null
}

export function printPrescription(data: PrintPrescriptionData) {
  const vitalsHtml = data.vitals && Object.values(data.vitals).some(Boolean)
    ? `<div class="vitals">
        <strong>Vitals:</strong>
        ${data.vitals.bp ? `BP: ${data.vitals.bp} mmHg` : ""}
        ${data.vitals.pulse ? `&nbsp;| Pulse: ${data.vitals.pulse} bpm` : ""}
        ${data.vitals.temp ? `&nbsp;| Temp: ${data.vitals.temp}°F` : ""}
        ${data.vitals.spo2 ? `&nbsp;| SpO2: ${data.vitals.spo2}%` : ""}
        ${data.vitals.weight ? `&nbsp;| Weight: ${data.vitals.weight} kg` : ""}
      </div>`
    : ""

  const medicinesHtml = data.medicines && data.medicines.length > 0
    ? `<h3>Rx</h3>
      <table class="rx-table">
        <thead>
          <tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
        </thead>
        <tbody>
          ${data.medicines.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${m.medicine_name}</td>
              <td>${m.dosage || "-"}</td>
              <td>${m.frequency || "-"}</td>
              <td>${m.duration || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : ""

  const labHtml = data.labTests && data.labTests.length > 0
    ? `<h3>Lab Tests Ordered</h3>
      <ul>${data.labTests.map((t) => `<li>${t}</li>`).join("")}</ul>`
    : ""

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Prescription - ${data.patientName}</title>
  <style>
    @page { size: A5; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
    .header { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .hospital { font-size: 16px; font-weight: 700; color: #0f766e; }
    .doctor { font-size: 12px; font-weight: 600; margin-top: 2px; }
    .specialty { font-size: 10px; color: #666; }
    .date { text-align: right; font-size: 10px; color: #666; }
    .patient-info { background: #f8fafb; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: flex; gap: 20px; flex-wrap: wrap; }
    .patient-info span { font-size: 11px; }
    .patient-info strong { color: #334155; }
    .vitals { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 10px; }
    .section { margin-bottom: 10px; }
    .section strong { display: inline-block; min-width: 70px; color: #334155; }
    h3 { font-size: 12px; color: #0f766e; margin: 12px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .rx-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .rx-table th { background: #f1f5f9; text-align: left; padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 600; font-size: 10px; }
    .rx-table td { padding: 5px 8px; border: 1px solid #e2e8f0; }
    ul { padding-left: 18px; font-size: 11px; }
    li { margin-bottom: 2px; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 12px; font-size: 10px; margin-top: 10px; }
    .follow-up { margin-top: 12px; font-size: 11px; font-weight: 600; color: #0f766e; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; }
    .signature { text-align: right; }
    .signature-line { border-top: 1px solid #333; width: 150px; margin-left: auto; margin-top: 30px; padding-top: 4px; font-size: 10px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="hospital">${data.hospitalName}</div>
      <div class="doctor">${data.doctorName}</div>
      ${data.doctorSpecialty ? `<div class="specialty">${data.doctorSpecialty}</div>` : ""}
    </div>
    <div class="date">
      <div>Date: <strong>${data.date}</strong></div>
    </div>
  </div>

  <div class="patient-info">
    <span><strong>Patient:</strong> ${data.patientName}</span>
    ${data.patientPhone ? `<span><strong>Phone:</strong> ${data.patientPhone}</span>` : ""}
    ${data.patientAge ? `<span><strong>Age:</strong> ${data.patientAge}</span>` : ""}
    ${data.patientGender ? `<span><strong>Gender:</strong> ${data.patientGender}</span>` : ""}
  </div>

  ${vitalsHtml}

  ${data.symptoms ? `<div class="section"><strong>Symptoms:</strong> ${data.symptoms}</div>` : ""}
  ${data.diagnosis ? `<div class="section"><strong>Diagnosis:</strong> ${data.diagnosis}</div>` : ""}

  ${medicinesHtml}
  ${labHtml}

  ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>` : ""}
  ${data.followUpDate ? `<div class="follow-up">Follow-up: ${data.followUpDate}</div>` : ""}

  <div class="footer">
    <div></div>
    <div class="signature">
      <div class="signature-line">${data.doctorName}</div>
    </div>
  </div>
</body>
</html>`

  const printWindow = window.open("", "_blank", "width=600,height=800")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}
