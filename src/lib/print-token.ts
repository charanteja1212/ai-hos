interface PrintTokenData {
  hospitalName: string
  tokenNumber: number
  patientName: string
  doctorName: string
  date: string
  time: string
  estimatedWait: number
  waitingAhead: number
  priority: number
}

export function printToken(data: PrintTokenData) {
  const priorityLabel =
    data.priority === 2 ? "EMERGENCY" : data.priority === 1 ? "URGENT" : ""
  const priorityBg =
    data.priority === 2 ? "#dc2626" : data.priority === 1 ? "#d97706" : ""
  const accentColor =
    data.priority === 2 ? "#dc2626" : data.priority === 1 ? "#d97706" : "#0d9488"
  const accentLight =
    data.priority === 2 ? "#fef2f2" : data.priority === 1 ? "#fffbeb" : "#f0fdfa"

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Token #${data.tokenNumber}</title>
  <style>
    @page { size: 90mm 155mm; margin: 0; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      width: 90mm;
      padding: 4mm;
      color: #0f172a;
      background: white;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hospital-name {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .header-badge {
      font-size: 8px;
      font-weight: 600;
      background: rgba(255,255,255,0.15);
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    /* ── Token Circle ── */
    .token-section {
      text-align: center;
      padding: 16px 12px 12px;
      background: ${accentLight};
    }
    .token-label {
      font-size: 9px;
      font-weight: 700;
      color: ${accentColor};
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .token-ring {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 4px solid ${accentColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08), inset 0 0 0 2px ${accentLight};
    }
    .token-number {
      font-size: 42px;
      font-weight: 900;
      color: ${accentColor};
      line-height: 1;
      letter-spacing: -1px;
    }
    .priority-badge {
      display: ${priorityLabel ? "inline-block" : "none"};
      background: ${priorityBg};
      color: white;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 3px 12px;
      border-radius: 20px;
      margin-top: 10px;
    }

    /* ── Patient Info ── */
    .info-section {
      padding: 12px 14px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .info-item {
      min-width: 0;
    }
    .info-item.full {
      grid-column: 1 / -1;
    }
    .info-label {
      font-size: 8px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 1px;
    }
    .info-value {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Divider ── */
    .cut-line {
      border: none;
      border-top: 1.5px dashed #cbd5e1;
      margin: 0 12px;
    }

    /* ── Wait Info ── */
    .wait-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 10px 14px;
    }
    .wait-item {
      text-align: center;
    }
    .wait-number {
      font-size: 20px;
      font-weight: 900;
      color: ${accentColor};
      line-height: 1.1;
    }
    .wait-unit {
      font-size: 8px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .wait-divider {
      width: 1px;
      height: 28px;
      background: #e2e8f0;
    }

    /* ── Footer ── */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      padding: 8px 14px;
      text-align: center;
    }
    .footer-text {
      font-size: 8px;
      color: #94a3b8;
      font-weight: 500;
      letter-spacing: 0.3px;
      line-height: 1.4;
    }
    .footer-text strong {
      color: #64748b;
      font-weight: 700;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="hospital-name">${data.hospitalName}</div>
      <div class="header-badge">OPD</div>
    </div>

    <div class="token-section">
      <div class="token-label">Your Token</div>
      <div class="token-ring">
        <div class="token-number">${data.tokenNumber}</div>
      </div>
      <div class="priority-badge">${priorityLabel}</div>
    </div>

    <div class="info-section">
      <div class="info-grid">
        <div class="info-item full">
          <div class="info-label">Patient</div>
          <div class="info-value">${data.patientName}</div>
        </div>
        <div class="info-item full">
          <div class="info-label">Doctor</div>
          <div class="info-value">${data.doctorName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date</div>
          <div class="info-value">${data.date}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Check-in</div>
          <div class="info-value">${data.time}</div>
        </div>
      </div>
    </div>

    <hr class="cut-line" />

    <div class="wait-section">
      <div class="wait-item">
        <div class="wait-number">${data.estimatedWait > 0 ? `~${data.estimatedWait}` : "0"}</div>
        <div class="wait-unit">Min Wait</div>
      </div>
      <div class="wait-divider"></div>
      <div class="wait-item">
        <div class="wait-number">${data.waitingAhead}</div>
        <div class="wait-unit">Ahead</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">
        Please wait in the lobby &bull; <strong>Watch the display screen</strong>
      </div>
    </div>
  </div>
</body>
</html>`

  const printWindow = window.open("", "_blank", "width=380,height=650")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}
