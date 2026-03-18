/**
 * POST /api/payment/webhook
 * Razorpay webhook — the ONLY place that processes payments.
 * Razorpay Dashboard config:
 *   URL: https://app.ainewworld.in/api/payment/webhook
 *   Events: payment_link.paid
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/* ── in-memory dedup (survives across requests within same container) ── */
const processedPayments = new Set<string>();

/* ── env ── */
const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RZP_AUTH = () => 'Basic ' + (process.env.RAZORPAY_AUTH || '');
const WEBHOOK_SECRET = () => process.env.RAZORPAY_WEBHOOK_SECRET || '';

/* ── supabase helpers ── */
function sbHeaders() {
  return { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY(), 'Content-Type': 'application/json' };
}

async function sbGet(path: string) {
  const r = await fetch(SB_URL() + path, { headers: sbHeaders(), signal: AbortSignal.timeout(10000) });
  return r.ok ? r.json() : [];
}

async function sbPatch(path: string, body: object) {
  await fetch(SB_URL() + path, {
    method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
}

async function sbPost(path: string, body: object) {
  await fetch(SB_URL() + path, {
    method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
}

async function sbDelete(path: string) {
  await fetch(SB_URL() + path, { method: 'DELETE', headers: sbHeaders(), signal: AbortSignal.timeout(10000) });
}

/* ── whatsapp helper ── */
async function sendWA(url: string, token: string, to: string, payload: object) {
  if (!url || !token || !to) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { /* non-critical */ }
}

/* ── IST date helper ── */
function nowIST() {
  const ms = Date.now() + 5.5 * 3600000;
  const d = new Date(ms);
  const date = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  return { date, ms };
}

/* ── card image ── */
function buildCardHtml(d: {
  hospitalName: string; patientName: string; drName: string; specialty: string;
  date: string; time: string; amount: number;
  qrUrl: string; bookingId: string; opPassId: string; expiry: string;
}) {
  return '<div style="width:800px;height:600px;font-family:Segoe UI,Roboto,Arial,sans-serif;display:flex;overflow:hidden">'
    + '<div style="flex:1;background:linear-gradient(170deg,#0f172a 0%,#1e293b 100%);display:flex;flex-direction:column">'
    + '<div style="padding:24px 28px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06)">'
    + '<div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:3px;font-weight:600">Appointment Pass</div>'
    + '<div style="font-size:22px;font-weight:800;color:#f8fafc;margin-top:2px">' + d.hospitalName + '</div></div>'
    + '<div style="background:#059669;color:#ecfdf5;padding:5px 16px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">CONFIRMED</div></div>'
    + '<div style="padding:18px 28px;flex:1;display:flex;flex-direction:column;justify-content:center">'
    + '<div style="display:flex;margin-bottom:16px">'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Patient</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">' + d.patientName + '</div></div>'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Doctor</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">Dr. ' + d.drName + '</div></div></div>'
    + '<div style="display:flex;margin-bottom:16px">'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Department</div><div style="font-size:14px;font-weight:700;color:#f1f5f9">' + d.specialty + '</div></div>'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Amount Paid</div><div style="font-size:20px;font-weight:800;color:#34d399">&#8377;' + d.amount + '</div></div></div>'
    + '<div style="height:1px;background:linear-gradient(90deg,#334155,transparent);margin-bottom:16px"></div>'
    + '<div style="display:flex;gap:12px">'
    + '<div style="flex:1;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Date</div><div style="font-size:15px;font-weight:700;color:#f8fafc">' + d.date + '</div></div>'
    + '<div style="flex:0 0 120px;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155;text-align:center"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Time</div><div style="font-size:15px;font-weight:700;color:#f8fafc">' + d.time + '</div></div></div></div>'
    + '<div style="padding:10px 28px;background:rgba(2,6,23,0.5);border-top:1px solid rgba(255,255,255,0.04)"><div style="font-size:10px;color:#475569;letter-spacing:0.5px">Present this pass at hospital reception</div></div></div>'
    + '<div style="width:28px;background:#0f172a;position:relative;flex-shrink:0"><div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div><div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div><div style="position:absolute;top:28px;bottom:28px;left:50%;border-left:2px dashed #334155"></div></div>'
    + '<div style="width:220px;background:linear-gradient(170deg,#1e293b 0%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;flex-shrink:0">'
    + '<div style="background:#ffffff;border-radius:10px;padding:8px;margin-bottom:16px"><img src="' + d.qrUrl + '" width="130" height="130" style="display:block;border-radius:4px" /></div>'
    + '<div style="text-align:center;margin-bottom:10px;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Booking ID</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + d.bookingId + '</div></div>'
    + '<div style="text-align:center;margin-bottom:10px;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">OP Pass</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + d.opPassId + '</div></div>'
    + '<div style="text-align:center;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Valid Until</div><div style="font-size:13px;font-weight:700;color:#fbbf24">' + d.expiry + '</div></div>'
    + '</div></div>';
}

async function renderCard(html: string): Promise<string | null> {
  try {
    const r = await fetch('http://html2img:3000/render', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, vw: 800, vh: 600 }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d?.url) return d.url;
    }
  } catch { /* fallback */ }
  return null;
}

/* ── main handler ── */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  console.log('[webhook] Received');

  // 1. Verify signature
  const secret = WEBHOOK_SECRET();
  if (secret) {
    const sig = req.headers.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig !== expected) {
      console.error('[webhook] Signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  // 2. Parse event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event || '';
  if (eventType !== 'payment_link.paid') {
    return NextResponse.json({ status: 'ignored' });
  }

  const paymentLinkId = event.payload?.payment_link?.entity?.id || '';
  const paymentId = event.payload?.payment?.entity?.id || '';
  console.log('[webhook] payment_link.paid — link:', paymentLinkId, 'payment:', paymentId);

  if (!paymentLinkId || !paymentId) {
    return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
  }

  // 3. In-memory dedup (prevents reprocessing within same container)
  if (processedPayments.has(paymentId)) {
    console.log('[webhook] Already processed (memory):', paymentId);
    return NextResponse.json({ status: 'already_processed' });
  }

  // 4. DB idempotency check — appointments table
  try {
    const existing = await sbGet('/appointments?razorpay_payment_id=eq.' + encodeURIComponent(paymentId) + '&status=eq.confirmed&select=booking_id');
    if (Array.isArray(existing) && existing.length > 0) {
      processedPayments.add(paymentId);
      console.log('[webhook] Already processed (DB):', existing[0].booking_id);
      return NextResponse.json({ status: 'already_processed' });
    }
  } catch { /* continue */ }

  // 4. Get payment link details from webhook payload (no API call needed)
  try {
    // Razorpay webhook payload includes the full payment_link entity
    const link = event.payload?.payment_link?.entity || {};
    const notes = link.notes || {};
    const type = notes.type || 'appointment';
    const bookingId = notes.reference_id || '';
    const tenantId = notes.tenant_id || 'T001';
    const patientName = notes.patient_name || 'Patient';
    const patientPhone = (notes.patient_phone || '').replace(/\D/g, '');
    const doctorName = notes.doctor_name || '';
    const specialty = notes.specialty || '';
    const apptDate = notes.appointment_date || '';
    const apptTime = notes.appointment_time || '';
    const amount = link.amount ? link.amount / 100 : 0;

    console.log('[webhook] Processing:', type, bookingId, patientName);

    // 6. Check op_passes table too (catches cases where appointments was cleared but op_passes wasn't)
    if (type === 'appointment' && bookingId) {
      try {
        const existingPass = await sbGet('/op_passes?booking_id=eq.' + encodeURIComponent(bookingId) + '&status=eq.ACTIVE&select=op_pass_id');
        if (Array.isArray(existingPass) && existingPass.length > 0) {
          processedPayments.add(paymentId);
          console.log('[webhook] OP pass already exists for booking:', bookingId);
          return NextResponse.json({ status: 'already_processed' });
        }
      } catch { /* continue */ }
    }

    /* ── APPOINTMENT ── */
    if (type === 'appointment' && bookingId) {
      // Verify appointment actually exists in DB (blocks ghost processing from old webhook retries after DB clear)
      const apptCheck = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(bookingId) + '&select=booking_id');
      if (!Array.isArray(apptCheck) || apptCheck.length === 0) {
        processedPayments.add(paymentId);
        console.log('[webhook] Appointment not found in DB (old retry?):', bookingId);
        return NextResponse.json({ status: 'appointment_not_found' });
      }
      const ist = nowIST();
      const expiryDate = new Date(ist.ms + 15 * 86400000).toISOString().split('T')[0];
      const opPassId = 'OP' + Date.now();
      const verifyUrl = 'https://ainewworld.in/webhook/verify-appointment?id=' + encodeURIComponent(opPassId);
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
      const expiryDisplay = new Date(expiryDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      // Get appointment row for patient_type, dependent_id, booked_by
      let bookedBy = patientPhone;
      let pType = 'SELF';
      let depId: string | null = null;
      try {
        const rows = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(bookingId) + '&select=patient_type,dependent_id,booked_by_whatsapp_number');
        if (Array.isArray(rows) && rows.length > 0) {
          pType = rows[0].patient_type || 'SELF';
          depId = rows[0].dependent_id || null;
          bookedBy = (rows[0].booked_by_whatsapp_number || patientPhone).replace(/\D/g, '');
        }
      } catch { /* defaults */ }
      if (!bookedBy) bookedBy = patientPhone;

      // Insert OP Pass
      try {
        await sbPost('/op_passes', {
          op_pass_id: opPassId, booking_id: bookingId,
          patient_phone: patientPhone, patient_name: patientName,
          patient_type: pType, dependent_id: depId,
          issue_date: ist.date, expiry_date: expiryDate,
          status: 'ACTIVE', qr_code: verifyUrl,
          booked_by_whatsapp_number: bookedBy, tenant_id: tenantId,
        });
      } catch { /* continue */ }

      // Update appointment → confirmed + paid
      try {
        await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), {
          status: 'confirmed', payment_status: 'paid',
          payment_id: paymentId, razorpay_payment_id: paymentId, op_pass_id: opPassId,
        });
      } catch { /* continue */ }

      // Release slot lock
      try { await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(bookingId)); } catch { /* ok */ }

      // Get tenant WA credentials
      let hospitalName = 'Care Hospital';
      let waUrl = '';
      let waToken = '';
      try {
        const t = await sbGet('/tenants?tenant_id=eq.' + encodeURIComponent(tenantId) + '&select=hospital_name,wa_api_url,wa_token');
        if (Array.isArray(t) && t.length > 0) {
          hospitalName = t[0].hospital_name || hospitalName;
          waUrl = t[0].wa_api_url || '';
          waToken = t[0].wa_token || '';
        }
      } catch { /* ok */ }

      const drName = (doctorName || '').replace(/^Dr\.?\s*/i, '').trim();

      // Generate card image
      const cardHtml = buildCardHtml({
        hospitalName, patientName, drName, specialty,
        date: apptDate, time: apptTime, amount,
        qrUrl, bookingId, opPassId, expiry: expiryDisplay,
      });
      const cardUrl = await renderCard(cardHtml);
      const imageUrl = cardUrl || qrUrl;

      const caption = cardUrl
        ? '*' + hospitalName + '*\nAppointment Confirmed\n\n*Amount Paid:* \u20B9' + amount + '\n*Booking ID:* ' + bookingId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_Present this digital pass at reception._'
        : '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + patientName + '\n*Doctor:* Dr. ' + drName + '\n*Department:* ' + specialty + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n\n*Booking ID:* ' + bookingId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n*Paid:* \u20B9' + amount + '\n\n_Present this QR code at reception._';

      // Send card to patient
      if (patientPhone) {
        await sendWA(waUrl, waToken, patientPhone, { type: 'image', image: { link: imageUrl, caption } });
        await new Promise(r => setTimeout(r, 3000));
        await sendWA(waUrl, waToken, patientPhone, {
          type: 'text', text: { body: 'Thank you for choosing *' + hospitalName + '* \u2705\n\nType *menu* anytime to book another appointment, reschedule, or manage your bookings.' },
        });
      }

      // Send to booker if different person
      const bookerClean = bookedBy.replace(/\D/g, '');
      if (bookerClean && bookerClean !== patientPhone) {
        await sendWA(waUrl, waToken, bookerClean, {
          type: 'image', image: { link: imageUrl, caption: '*' + hospitalName + '*\nBooking Confirmed for ' + patientName + '\n\n*Doctor:* Dr. ' + drName + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n*Booking ID:* ' + bookingId + '\n\n_Present this pass at reception._' },
        });
      }

      console.log('[webhook] SUCCESS:', bookingId);
    }

    /* ── PRESCRIPTION ── */
    if (type === 'prescription' && bookingId) {
      try {
        await sbPatch('/prescriptions?prescription_id=eq.' + encodeURIComponent(bookingId), {
          payment_status: 'paid', payment_id: paymentId, payment_link: paymentLinkId,
        });
        console.log('[webhook] Prescription paid:', bookingId);
      } catch { /* continue */ }
    }

    // Mark as processed in memory
    processedPayments.add(paymentId);
    return NextResponse.json({ status: 'ok' });
  } catch (err: unknown) {
    console.error('[webhook] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
