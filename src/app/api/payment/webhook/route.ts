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
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('[webhook][sbGet] FAIL', r.status, path, txt.slice(0, 200));
    return [];
  }
  return r.json();
}

async function sbPatch(path: string, body: object) {
  const r = await fetch(SB_URL() + path, {
    method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('[webhook][sbPatch] FAIL', r.status, path, txt.slice(0, 200));
  }
}

async function sbPost(path: string, body: object) {
  const r = await fetch(SB_URL() + path, {
    method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('[webhook][sbPost] FAIL', r.status, path, txt.slice(0, 200));
  }
}

async function sbDelete(path: string) {
  const r = await fetch(SB_URL() + path, { method: 'DELETE', headers: sbHeaders(), signal: AbortSignal.timeout(10000) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('[webhook][sbDelete] FAIL', r.status, path, txt.slice(0, 200));
  }
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
  console.log('[webhook] POST received');

  // ── PHASE 1: Signature verification ──
  const secret = WEBHOOK_SECRET();
  if (secret) {
    const sig = req.headers.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig !== expected) {
      console.error('[webhook][PHASE 1] FAIL — Signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    console.log('[webhook][PHASE 1] OK — Signature verified');
  } else {
    console.log('[webhook][PHASE 1] SKIP — No webhook secret configured');
  }

  // ── PHASE 2: Parse event ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = JSON.parse(rawBody); } catch (e) {
    console.error('[webhook][PHASE 2] FAIL — Invalid JSON:', e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event || '';
  if (eventType !== 'payment_link.paid') {
    console.log('[webhook][PHASE 2] SKIP — Event type:', eventType, '(not payment_link.paid)');
    return NextResponse.json({ status: 'ignored' });
  }

  const paymentLinkId = event.payload?.payment_link?.entity?.id || '';
  const paymentId = event.payload?.payment?.entity?.id || '';
  console.log('[webhook][PHASE 2] OK — payment_link.paid | link:', paymentLinkId, '| payment:', paymentId);

  if (!paymentLinkId || !paymentId) {
    console.error('[webhook][PHASE 2] FAIL — Missing IDs | linkId:', paymentLinkId, '| paymentId:', paymentId);
    return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
  }

  // ── PHASE 3: Dedup check (memory) ──
  if (processedPayments.has(paymentId)) {
    console.log('[webhook][PHASE 3] SKIP — Already processed (memory):', paymentId);
    return NextResponse.json({ status: 'already_processed' });
  }
  console.log('[webhook][PHASE 3] OK — Not in memory dedup set');

  // ── PHASE 4: Dedup check (DB) ──
  try {
    const existing = await sbGet('/appointments?razorpay_payment_id=eq.' + encodeURIComponent(paymentId) + '&status=eq.confirmed&select=booking_id');
    if (Array.isArray(existing) && existing.length > 0) {
      processedPayments.add(paymentId);
      console.log('[webhook][PHASE 4] SKIP — Already processed (DB):', existing[0].booking_id);
      return NextResponse.json({ status: 'already_processed' });
    }
    console.log('[webhook][PHASE 4] OK — Not in DB (fresh payment)');
  } catch (e) {
    console.error('[webhook][PHASE 4] WARN — DB dedup check failed:', e);
  }

  // ── PHASE 5: Extract data from webhook payload ──
  try {
    const link = event.payload?.payment_link?.entity || {};
    const notes = link.notes || {};

    console.log('[webhook][PHASE 5] Raw link entity keys:', Object.keys(link));
    console.log('[webhook][PHASE 5] Raw notes:', JSON.stringify(notes));
    console.log('[webhook][PHASE 5] Link amount:', link.amount, '| Link status:', link.status);

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

    console.log('[webhook][PHASE 5] OK — Extracted:', {
      type, bookingId, tenantId, patientName, patientPhone, doctorName, specialty, apptDate, apptTime, amount,
    });

    if (!bookingId) {
      console.error('[webhook][PHASE 5] FAIL — No booking ID in notes! Cannot proceed.');
      return NextResponse.json({ error: 'No booking ID in payment notes' }, { status: 400 });
    }

    // ── PHASE 6: Check existing OP pass ──
    if (type === 'appointment' && bookingId) {
      try {
        const existingPass = await sbGet('/op_passes?booking_id=eq.' + encodeURIComponent(bookingId) + '&status=eq.ACTIVE&select=op_pass_id');
        if (Array.isArray(existingPass) && existingPass.length > 0) {
          processedPayments.add(paymentId);
          console.log('[webhook][PHASE 6] SKIP — OP pass already exists:', existingPass[0].op_pass_id, 'for booking:', bookingId);
          return NextResponse.json({ status: 'already_processed' });
        }
        console.log('[webhook][PHASE 6] OK — No existing OP pass for booking:', bookingId);
      } catch (e) {
        console.error('[webhook][PHASE 6] WARN — OP pass check failed:', e);
      }
    }

    /* ── APPOINTMENT FLOW ── */
    if (type === 'appointment' && bookingId) {
      // ── PHASE 7: Verify appointment exists ──
      const apptCheck = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(bookingId) + '&select=booking_id');
      if (!Array.isArray(apptCheck) || apptCheck.length === 0) {
        processedPayments.add(paymentId);
        console.error('[webhook][PHASE 7] FAIL — Appointment not found in DB:', bookingId);
        return NextResponse.json({ status: 'appointment_not_found' });
      }
      console.log('[webhook][PHASE 7] OK — Appointment exists:', bookingId);

      // ── PHASE 8: Generate OP Pass data ──
      const ist = nowIST();
      const expiryDate = new Date(ist.ms + 15 * 86400000).toISOString().split('T')[0];
      const opPassId = 'OP' + Date.now() + Math.random().toString(36).slice(2, 6);
      const verifyUrl = 'https://ainewworld.in/webhook/verify-appointment?id=' + encodeURIComponent(opPassId);
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
      const expiryDisplay = new Date(expiryDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      console.log('[webhook][PHASE 8] OK — Generated OP Pass:', { opPassId, issueDate: ist.date, expiryDate, expiryDisplay });

      // ── PHASE 9: Get appointment details ──
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
        console.log('[webhook][PHASE 9] OK — Appointment details:', { pType, depId, bookedBy });
      } catch (e) {
        console.error('[webhook][PHASE 9] WARN — Failed to get appointment details:', e);
      }
      if (!bookedBy) bookedBy = patientPhone;

      // ── PHASE 10: Insert OP Pass into DB ──
      try {
        const opPassData = {
          op_pass_id: opPassId, booking_id: bookingId,
          patient_phone: patientPhone, patient_name: patientName,
          patient_type: pType, dependent_id: depId,
          issue_date: ist.date, expiry_date: expiryDate,
          status: 'ACTIVE', qr_code: verifyUrl,
          booked_by_whatsapp_number: bookedBy, tenant_id: tenantId,
        };
        console.log('[webhook][PHASE 10] Inserting OP pass:', JSON.stringify(opPassData));
        await sbPost('/op_passes', opPassData);
        console.log('[webhook][PHASE 10] OK — OP pass inserted:', opPassId);
      } catch (e) {
        console.error('[webhook][PHASE 10] FAIL — OP pass insert error:', e);
      }

      // ── PHASE 11: Update appointment status ──
      try {
        await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), {
          status: 'confirmed', payment_status: 'paid',
          payment_id: paymentId, razorpay_payment_id: paymentId, op_pass_id: opPassId,
        });
        console.log('[webhook][PHASE 11] OK — Appointment updated to confirmed/paid');
      } catch (e) {
        console.error('[webhook][PHASE 11] FAIL — Appointment update error:', e);
      }

      // ── PHASE 12: Release slot lock ──
      try {
        await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(bookingId));
        console.log('[webhook][PHASE 12] OK — Slot lock released');
      } catch (e) {
        console.error('[webhook][PHASE 12] WARN — Slot lock release failed:', e);
      }

      // ── PHASE 13: Get tenant WA credentials ──
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
        console.log('[webhook][PHASE 13] OK — Tenant:', { hospitalName, hasWaUrl: !!waUrl, hasWaToken: !!waToken });
      } catch (e) {
        console.error('[webhook][PHASE 13] WARN — Tenant fetch failed:', e);
      }

      // ── PHASE 14: Generate card image ──
      const drName = (doctorName || '').replace(/^Dr\.?\s*/i, '').trim();
      const cardHtml = buildCardHtml({
        hospitalName, patientName, drName, specialty,
        date: apptDate, time: apptTime, amount,
        qrUrl, bookingId, opPassId, expiry: expiryDisplay,
      });
      const cardUrl = await renderCard(cardHtml);
      const imageUrl = cardUrl || qrUrl;
      console.log('[webhook][PHASE 14] OK — Card image:', cardUrl ? 'html2img success' : 'fallback to QR url');

      const caption = cardUrl
        ? '*' + hospitalName + '*\nAppointment Confirmed\n\n*Amount Paid:* \u20B9' + amount + '\n*Booking ID:* ' + bookingId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_Present this digital pass at reception._'
        : '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + patientName + '\n*Doctor:* Dr. ' + drName + '\n*Department:* ' + specialty + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n\n*Booking ID:* ' + bookingId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n*Paid:* \u20B9' + amount + '\n\n_Present this QR code at reception._';

      // ── PHASE 15: Send WhatsApp notifications ──
      if (patientPhone) {
        console.log('[webhook][PHASE 15] Sending WA card to patient:', patientPhone);
        await sendWA(waUrl, waToken, patientPhone, { type: 'image', image: { link: imageUrl, caption } });
        await new Promise(r => setTimeout(r, 3000));
        await sendWA(waUrl, waToken, patientPhone, {
          type: 'text', text: { body: 'Thank you for choosing *' + hospitalName + '* \u2705\n\nType *menu* anytime to book another appointment, reschedule, or manage your bookings.' },
        });
        console.log('[webhook][PHASE 15] OK — WA messages sent to patient');
      } else {
        console.error('[webhook][PHASE 15] SKIP — No patient phone number');
      }

      // Send to booker if different person
      const bookerClean = bookedBy.replace(/\D/g, '');
      if (bookerClean && bookerClean !== patientPhone) {
        console.log('[webhook][PHASE 15b] Sending WA card to booker:', bookerClean);
        await sendWA(waUrl, waToken, bookerClean, {
          type: 'image', image: { link: imageUrl, caption: '*' + hospitalName + '*\nBooking Confirmed for ' + patientName + '\n\n*Doctor:* Dr. ' + drName + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n*Booking ID:* ' + bookingId + '\n\n_Present this pass at reception._' },
        });
        console.log('[webhook][PHASE 15b] OK — WA card sent to booker');
      }

      console.log('[webhook] ===== SUCCESS ===== booking:', bookingId, '| opPass:', opPassId);
    }

    /* ── PRESCRIPTION ── */
    if (type === 'prescription' && bookingId) {
      try {
        await sbPatch('/prescriptions?prescription_id=eq.' + encodeURIComponent(bookingId), {
          payment_status: 'paid', payment_id: paymentId, payment_link: paymentLinkId,
        });
        console.log('[webhook] Prescription paid:', bookingId);
      } catch (e) {
        console.error('[webhook] FAIL — Prescription update error:', e);
      }
    }

    // Mark as processed in memory
    processedPayments.add(paymentId);
    return NextResponse.json({ status: 'ok' });
  } catch (err: unknown) {
    console.error('[webhook] FATAL ERROR:', err instanceof Error ? err.message : err);
    console.error('[webhook] Stack:', err instanceof Error ? err.stack : 'no stack');
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
