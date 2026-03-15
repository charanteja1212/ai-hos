/**
 * POST /api/payment/webhook — Razorpay server-to-server webhook
 * Handles payment.captured events as a fallback when browser redirect fails.
 * Configure in Razorpay Dashboard → Webhooks → Add:
 *   URL: https://app.ainewworld.in/api/payment/webhook
 *   Secret: (set RAZORPAY_WEBHOOK_SECRET in .env)
 *   Events: payment_link.paid
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RAZORPAY_AUTH = 'Basic ' + (process.env.RAZORPAY_AUTH || '');
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';

const sbHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

async function sbGet(path: string) {
  const res = await fetch(SUPABASE_URL + path, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    signal: AbortSignal.timeout(10000),
  });
  return res.ok ? res.json() : [];
}

async function sbPatch(path: string, body: object) {
  await fetch(SUPABASE_URL + path, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}

async function sbPost(path: string, body: object) {
  await fetch(SUPABASE_URL + path, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}

async function sbDelete(path: string) {
  await fetch(SUPABASE_URL + path, {
    method: 'DELETE',
    headers: sbHeaders,
    signal: AbortSignal.timeout(10000),
  });
}

async function sendWA(waApiUrl: string, waToken: string, to: string, payload: object) {
  if (!waApiUrl || !waToken || !to) return;
  try {
    await fetch(waApiUrl, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + waToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { /* non-critical */ }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  console.log('[payment-webhook] Received webhook event');

  // Verify signature if secret is configured
  if (RAZORPAY_WEBHOOK_SECRET) {
    const signature = req.headers.get('x-razorpay-signature') || '';
    const expected = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    if (signature !== expected) {
      console.error('[payment-webhook] Signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event || '';
  console.log('[payment-webhook] Event type:', eventType);

  // We only care about payment_link.paid
  if (eventType !== 'payment_link.paid') {
    return NextResponse.json({ status: 'ignored' });
  }

  const paymentLink = event.payload?.payment_link?.entity || {};
  const payment = event.payload?.payment?.entity || {};
  const paymentLinkId = paymentLink.id || '';
  const paymentId = payment.id || '';

  console.log('[payment-webhook] Payment link:', paymentLinkId, 'Payment:', paymentId);

  if (!paymentLinkId || !paymentId) {
    console.error('[payment-webhook] Missing payment link or payment ID');
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  // Idempotency — check if already processed
  try {
    const existing = await sbGet(
      '/appointments?razorpay_payment_id=eq.' + encodeURIComponent(paymentId) +
      '&status=eq.confirmed&select=booking_id'
    );
    if (Array.isArray(existing) && existing.length > 0) {
      console.log('[payment-webhook] Already processed:', existing[0].booking_id);
      return NextResponse.json({ status: 'already_processed' });
    }
  } catch { /* continue */ }

  try {
    // Get payment link details from Razorpay for notes
    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links/' + paymentLinkId, {
      headers: { 'Authorization': RAZORPAY_AUTH },
      signal: AbortSignal.timeout(10000),
    });
    if (!rzpRes.ok) throw new Error('Razorpay API error: ' + rzpRes.status);
    const linkDetails = await rzpRes.json();

    const notes = linkDetails.notes || {};
    const type = notes.type || 'appointment';
    const referenceId = notes.reference_id || '';
    const tenantId = notes.tenant_id || 'T001';
    const patientName = notes.patient_name || 'Patient';
    const patientPhone = (notes.patient_phone || '').replace(/\D/g, '');
    const doctorName = notes.doctor_name || '';
    const specialty = notes.specialty || '';
    const appointmentDate = notes.appointment_date || '';
    const appointmentTime = notes.appointment_time || '';
    const amountPaid = linkDetails.amount ? (linkDetails.amount / 100) : 0;

    console.log('[payment-webhook] Processing:', type, referenceId, patientName);

    if (type === 'appointment' && referenceId) {
      // Create OP Pass
      const now = new Date();
      const istMs = now.getTime() + 5.5 * 3600000;
      const istDate = new Date(istMs);
      const issueDate = istDate.getUTCFullYear() + '-' +
        String(istDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(istDate.getUTCDate()).padStart(2, '0');
      const expiryDate = new Date(istMs + 15 * 86400000).toISOString().split('T')[0];
      const opPassId = 'OP' + Date.now();
      const verifyUrl = 'https://ainewworld.in/webhook/verify-appointment?id=' + encodeURIComponent(opPassId);
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
      const expiryDisplay = new Date(expiryDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      // Get appointment details
      let bookedBy = patientPhone;
      let pType = 'SELF';
      let depId = null;
      try {
        const apptRows = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(referenceId) + '&select=patient_type,dependent_id,booked_by_whatsapp_number');
        if (Array.isArray(apptRows) && apptRows.length > 0) {
          pType = apptRows[0].patient_type || 'SELF';
          depId = apptRows[0].dependent_id || null;
          bookedBy = (apptRows[0].booked_by_whatsapp_number || patientPhone).replace(/\D/g, '');
        }
      } catch { /* defaults */ }
      if (!bookedBy) bookedBy = patientPhone;

      // Insert OP Pass
      try {
        await sbPost('/op_passes', {
          op_pass_id: opPassId, booking_id: referenceId,
          patient_phone: patientPhone, patient_name: patientName,
          patient_type: pType, dependent_id: depId,
          issue_date: issueDate, expiry_date: expiryDate,
          status: 'ACTIVE', qr_code: verifyUrl,
          booked_by_whatsapp_number: bookedBy, tenant_id: tenantId,
        });
      } catch { /* continue */ }

      // Update appointment: confirmed + paid
      try {
        await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(referenceId), {
          status: 'confirmed', payment_status: 'paid',
          payment_id: paymentId, razorpay_payment_id: paymentId, op_pass_id: opPassId,
        });
      } catch { /* continue */ }

      // Release slot lock
      try { await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(referenceId)); } catch { /* ok */ }

      // Fetch tenant for WA credentials
      let hospitalName = 'Care Hospital';
      let waApiUrl = '';
      let waToken = '';
      try {
        const tRows = await sbGet('/tenants?tenant_id=eq.' + encodeURIComponent(tenantId) + '&select=hospital_name,wa_api_url,wa_token');
        if (Array.isArray(tRows) && tRows.length > 0) {
          hospitalName = tRows[0].hospital_name || hospitalName;
          waApiUrl = tRows[0].wa_api_url || '';
          waToken = tRows[0].wa_token || '';
        }
      } catch { /* ok */ }

      const cleanDrName = (doctorName || '').replace(/^Dr\.?\s*/i, '').trim();

      // Generate card image
      let cardImageUrl = qrUrl;
      try {
        const cardHtml = buildCardHtml({
          hospitalName, patientName, cleanDrName, specialty,
          appointmentDate, appointmentTime, amountPaid,
          qrUrl, referenceId, opPassId, expiryDisplay,
        });
        const imgRes = await fetch('http://html2img:3000/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: cardHtml, vw: 800, vh: 600 }),
          signal: AbortSignal.timeout(20000),
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData?.url) cardImageUrl = imgData.url;
        }
      } catch { /* fallback to QR */ }

      const isCard = cardImageUrl !== qrUrl;
      const caption = isCard
        ? '*' + hospitalName + '*\nAppointment Confirmed\n\n*Amount Paid:* \u20B9' + amountPaid + '\n*Booking ID:* ' + referenceId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_Present this digital pass at reception._'
        : '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + patientName + '\n*Doctor:* Dr. ' + cleanDrName + '\n*Department:* ' + specialty + '\n*Date:* ' + appointmentDate + '\n*Time:* ' + appointmentTime + '\n\n*Booking ID:* ' + referenceId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n*Paid:* \u20B9' + amountPaid + '\n\n_Present this QR code at reception._\n_Your OP Pass is valid for 15 days._';

      // Send card to patient
      if (patientPhone) {
        await sendWA(waApiUrl, waToken, patientPhone, { type: 'image', image: { link: cardImageUrl, caption } });

        await new Promise(r => setTimeout(r, 3000));
        await sendWA(waApiUrl, waToken, patientPhone, {
          type: 'text', text: { body: 'Thank you for choosing *' + hospitalName + '* \u2705\n\nType *menu* anytime to book another appointment, reschedule, or manage your bookings.' },
        });
      }

      // Send to booker if different
      const bookerDigits = bookedBy.replace(/\D/g, '');
      if (bookerDigits && bookerDigits !== patientPhone) {
        const bookerCaption = '*' + hospitalName + '*\nBooking Confirmed for ' + patientName + '\n\n*Doctor:* Dr. ' + cleanDrName + '\n*Date:* ' + appointmentDate + '\n*Time:* ' + appointmentTime + '\n*Booking ID:* ' + referenceId + '\n\n_Present this pass at reception._';
        await sendWA(waApiUrl, waToken, bookerDigits, { type: 'image', image: { link: cardImageUrl, caption: bookerCaption } });
      }

      console.log('[payment-webhook] SUCCESS — confirmed:', referenceId);
    }

    if (type === 'prescription' && referenceId) {
      try {
        await sbPatch('/prescriptions?prescription_id=eq.' + encodeURIComponent(referenceId), {
          payment_status: 'paid', payment_id: paymentId, payment_link: paymentLinkId,
        });
        console.log('[payment-webhook] Prescription paid:', referenceId);
      } catch { /* continue */ }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[payment-webhook] Error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

function buildCardHtml(d: {
  hospitalName: string; patientName: string; cleanDrName: string; specialty: string;
  appointmentDate: string; appointmentTime: string; amountPaid: number;
  qrUrl: string; referenceId: string; opPassId: string; expiryDisplay: string;
}): string {
  return '<div style="width:800px;height:600px;font-family:Segoe UI,Roboto,Arial,sans-serif;display:flex;overflow:hidden">'
    + '<div style="flex:1;background:linear-gradient(170deg,#0f172a 0%,#1e293b 100%);display:flex;flex-direction:column">'
    + '<div style="padding:24px 28px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06)">'
    + '<div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:3px;font-weight:600">Appointment Pass</div>'
    + '<div style="font-size:22px;font-weight:800;color:#f8fafc;margin-top:2px">' + d.hospitalName + '</div></div>'
    + '<div style="background:#059669;color:#ecfdf5;padding:5px 16px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">CONFIRMED</div></div>'
    + '<div style="padding:18px 28px;flex:1;display:flex;flex-direction:column;justify-content:center">'
    + '<div style="display:flex;margin-bottom:16px">'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Patient</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">' + d.patientName + '</div></div>'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Doctor</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">Dr. ' + d.cleanDrName + '</div></div></div>'
    + '<div style="display:flex;margin-bottom:16px">'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Department</div><div style="font-size:14px;font-weight:700;color:#f1f5f9">' + d.specialty + '</div></div>'
    + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Amount Paid</div><div style="font-size:20px;font-weight:800;color:#34d399">&#8377;' + d.amountPaid + '</div></div></div>'
    + '<div style="height:1px;background:linear-gradient(90deg,#334155,transparent);margin-bottom:16px"></div>'
    + '<div style="display:flex;gap:12px">'
    + '<div style="flex:1;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Date</div><div style="font-size:15px;font-weight:700;color:#f8fafc">' + d.appointmentDate + '</div></div>'
    + '<div style="flex:0 0 120px;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155;text-align:center"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Time</div><div style="font-size:15px;font-weight:700;color:#f8fafc">' + d.appointmentTime + '</div></div></div></div>'
    + '<div style="padding:10px 28px;background:rgba(2,6,23,0.5);border-top:1px solid rgba(255,255,255,0.04)"><div style="font-size:10px;color:#475569;letter-spacing:0.5px">Present this pass at hospital reception</div></div></div>'
    + '<div style="width:28px;background:#0f172a;position:relative;flex-shrink:0"><div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div><div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div><div style="position:absolute;top:28px;bottom:28px;left:50%;border-left:2px dashed #334155"></div></div>'
    + '<div style="width:220px;background:linear-gradient(170deg,#1e293b 0%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;flex-shrink:0">'
    + '<div style="background:#ffffff;border-radius:10px;padding:8px;margin-bottom:16px"><img src="' + d.qrUrl + '" width="130" height="130" style="display:block;border-radius:4px" /></div>'
    + '<div style="text-align:center;margin-bottom:10px;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Booking ID</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + d.referenceId + '</div></div>'
    + '<div style="text-align:center;margin-bottom:10px;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">OP Pass</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + d.opPassId + '</div></div>'
    + '<div style="text-align:center;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Valid Until</div><div style="font-size:13px;font-weight:700;color:#fbbf24">' + d.expiryDisplay + '</div></div>'
    + '</div></div>';
}
