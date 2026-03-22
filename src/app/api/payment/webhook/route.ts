/**
 * POST /api/payment/webhook
 * Razorpay webhook — the ONLY place that processes payments.
 * Razorpay Dashboard config:
 *   URL: https://app.ainewworld.in/api/payment/webhook
 *   Events: payment_link.paid
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logAudit } from '@/lib/audit';
import { createRouteLogger, createTenantLogger } from '@/lib/logger';
import { OP_PASS_VALIDITY_DAYS } from '@/lib/config/defaults';

const log = createRouteLogger('payment/webhook');

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
    log.error({ status: r.status, path, body: txt.slice(0, 200) }, 'sbGet failed');
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
    log.error({ status: r.status, path, body: txt.slice(0, 200) }, 'sbPatch failed');
  }
}

async function sbPost(path: string, body: object) {
  const r = await fetch(SB_URL() + path, {
    method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    log.error({ status: r.status, path, body: txt.slice(0, 200) }, 'sbPost failed');
  }
}

async function sbDelete(path: string) {
  const r = await fetch(SB_URL() + path, { method: 'DELETE', headers: sbHeaders(), signal: AbortSignal.timeout(10000) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    log.error({ status: r.status, path, body: txt.slice(0, 200) }, 'sbDelete failed');
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
  log.info('POST received');

  // ── PHASE 1: Signature verification ──
  const secret = WEBHOOK_SECRET();
  const sig = req.headers.get('x-razorpay-signature') || '';
  if (secret && sig) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig === expected) {
      log.info('PHASE 1 OK — Signature verified');
    } else {
      // Signature mismatch — verify payment via Razorpay API instead
      log.warn('PHASE 1 WARN — Signature mismatch, will verify via API');
    }
  } else {
    log.warn('PHASE 1 WARN — No secret or signature, will verify via API');
  }

  // ── PHASE 2: Parse event ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = JSON.parse(rawBody); } catch (e) {
    log.error({ err: e }, 'PHASE 2 FAIL — Invalid JSON');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event || '';
  if (eventType !== 'payment_link.paid') {
    log.info({ eventType }, 'PHASE 2 SKIP — not payment_link.paid');
    return NextResponse.json({ status: 'ignored' });
  }

  const paymentLinkId = event.payload?.payment_link?.entity?.id || '';
  const paymentId = event.payload?.payment?.entity?.id || '';
  log.info({ paymentLinkId, paymentId }, 'PHASE 2 OK — payment_link.paid');

  if (!paymentLinkId || !paymentId) {
    log.error({ paymentLinkId, paymentId }, 'PHASE 2 FAIL — Missing IDs');
    return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
  }

  // ── PHASE 2b: Verify payment via Razorpay API ──
  try {
    const verifyRes = await fetch('https://api.razorpay.com/v1/payments/' + paymentId, {
      headers: { Authorization: RZP_AUTH() },
      signal: AbortSignal.timeout(10000),
    });
    if (verifyRes.ok) {
      const payment = await verifyRes.json();
      if (payment.status !== 'captured') {
        log.error({ paymentId, rzpStatus: payment.status }, 'PHASE 2b FAIL — Payment not captured');
        return NextResponse.json({ error: 'Payment not captured' }, { status: 400 });
      }
      log.info({ paymentId, rzpStatus: payment.status }, 'PHASE 2b OK — Payment verified via API');
    } else {
      log.warn({ paymentId, status: verifyRes.status }, 'PHASE 2b WARN — Could not verify via API, proceeding');
    }
  } catch (e) {
    log.warn({ err: e }, 'PHASE 2b WARN — API verification failed, proceeding');
  }

  // ── PHASE 3: Dedup check (memory) ──
  if (processedPayments.has(paymentId)) {
    log.info({ paymentId }, 'PHASE 3 SKIP — Already processed (memory)');
    return NextResponse.json({ status: 'already_processed' });
  }
  log.info('PHASE 3 OK — Not in memory dedup set');

  // ── PHASE 4: Dedup check (DB) ──
  try {
    const existing = await sbGet('/appointments?razorpay_payment_id=eq.' + encodeURIComponent(paymentId) + '&status=eq.confirmed&select=booking_id');
    if (Array.isArray(existing) && existing.length > 0) {
      processedPayments.add(paymentId);
      log.info({ bookingId: existing[0].booking_id }, 'PHASE 4 SKIP — Already processed (DB)');
      return NextResponse.json({ status: 'already_processed' });
    }
    log.info('PHASE 4 OK — Not in DB (fresh payment)');
  } catch (e) {
    log.warn({ err: e }, 'PHASE 4 — DB dedup check failed');
  }

  // ── PHASE 5: Extract data from webhook payload ──
  try {
    const link = event.payload?.payment_link?.entity || {};
    const notes = link.notes || {};

    log.info({ linkKeys: Object.keys(link), notes, linkAmount: link.amount, linkStatus: link.status }, 'PHASE 5 — Raw data');

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

    log.info({ type, bookingId, tenantId, patientName, patientPhone, doctorName, specialty, apptDate, apptTime, amount }, 'PHASE 5 OK — Extracted');

    if (!bookingId) {
      log.error('PHASE 5 FAIL — No booking ID in notes');
      return NextResponse.json({ error: 'No booking ID in payment notes' }, { status: 400 });
    }

    const tlog = createTenantLogger(tenantId, { route: 'payment/webhook', bookingId, paymentId });

    // ── PHASE 6: Check existing OP pass ──
    if (type === 'appointment' && bookingId) {
      try {
        const existingPass = await sbGet('/op_passes?booking_id=eq.' + encodeURIComponent(bookingId) + '&status=eq.ACTIVE&select=op_pass_id');
        if (Array.isArray(existingPass) && existingPass.length > 0) {
          processedPayments.add(paymentId);
          tlog.info({ opPassId: existingPass[0].op_pass_id }, 'PHASE 6 SKIP — OP pass already exists');
          return NextResponse.json({ status: 'already_processed' });
        }
        tlog.info('PHASE 6 OK — No existing OP pass');
      } catch (e) {
        tlog.warn({ err: e }, 'PHASE 6 — OP pass check failed');
      }
    }

    /* ── APPOINTMENT FLOW ── */
    if (type === 'appointment' && bookingId) {
      // ── PHASE 7: Verify appointment exists ──
      const apptCheck = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(bookingId) + '&select=booking_id');
      if (!Array.isArray(apptCheck) || apptCheck.length === 0) {
        processedPayments.add(paymentId);
        tlog.error('PHASE 7 FAIL — Appointment not found in DB');
        return NextResponse.json({ status: 'appointment_not_found' });
      }
      tlog.info('PHASE 7 OK — Appointment exists');

      // ── PHASE 8: Generate OP Pass data ──
      const ist = nowIST();
      const expiryDate = new Date(ist.ms + OP_PASS_VALIDITY_DAYS * 86400000).toISOString().split('T')[0];
      const opPassId = 'OP' + Date.now() + Math.random().toString(36).slice(2, 6);
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ainewworld.in'}/api/verify?id=` + encodeURIComponent(opPassId);
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
      const expiryDisplay = new Date(expiryDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      tlog.info({ opPassId, issueDate: ist.date, expiryDate, expiryDisplay }, 'PHASE 8 OK — Generated OP Pass');

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
        tlog.info({ pType, depId, bookedBy }, 'PHASE 9 OK — Appointment details');
      } catch (e) {
        tlog.warn({ err: e }, 'PHASE 9 — Failed to get appointment details');
      }
      if (!bookedBy) bookedBy = patientPhone;

      // ── PHASE 10-12: Atomic payment confirmation ──
      // Uses fn_confirm_payment RPC for atomic: OP pass + appointment update + slot lock release
      try {
        const rpcRes = await fetch(SB_URL() + '/rpc/fn_confirm_payment', {
          method: 'POST',
          headers: { ...sbHeaders(), Prefer: 'return=representation' },
          body: JSON.stringify({
            p_booking_id: bookingId,
            p_payment_id: paymentId,
            p_op_pass_id: opPassId,
            p_patient_phone: patientPhone,
            p_patient_name: patientName,
            p_patient_type: pType,
            p_dependent_id: depId,
            p_issue_date: ist.date,
            p_expiry_date: expiryDate,
            p_qr_code: verifyUrl,
            p_booked_by: bookedBy,
            p_tenant_id: tenantId,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const rpcResult = await rpcRes.json();
        if (!rpcRes.ok || !rpcResult?.success) {
          if (rpcResult?.already_processed) {
            processedPayments.add(paymentId);
            tlog.info('PHASE 10-12 SKIP — Already processed (RPC dedup)');
            return NextResponse.json({ status: 'already_processed' });
          }
          tlog.error({ err: rpcResult?.error }, 'PHASE 10-12 FAIL — RPC error');
          return NextResponse.json({ error: rpcResult?.error || 'Payment confirmation failed' }, { status: 500 });
        }

        tlog.info({ opPassId }, 'PHASE 10-12 OK — Atomic: OP pass + appointment + slot lock');
        logAudit({
          action: "status_change", entityType: "appointment", entityId: bookingId,
          actorEmail: patientPhone || "payment_webhook", actorRole: "system",
          tenantId: tenantId || undefined,
          details: { payment_status: "paid", payment_id: paymentId, amount },
        });
      } catch (e) {
        tlog.error({ err: e }, 'PHASE 10-12 FAIL — Payment confirmation error');
        return NextResponse.json({ error: 'Payment confirmation failed' }, { status: 500 });
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
        tlog.info({ hospitalName, hasWaUrl: !!waUrl, hasWaToken: !!waToken }, 'PHASE 13 OK — Tenant fetched');
      } catch (e) {
        tlog.warn({ err: e }, 'PHASE 13 — Tenant fetch failed');
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
      tlog.info({ cardRendered: !!cardUrl }, 'PHASE 14 OK — Card image');

      const caption = cardUrl
        ? '*' + hospitalName + '*\nAppointment Confirmed\n\n*Amount Paid:* \u20B9' + amount + '\n*Booking ID:* ' + bookingId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_Present this digital pass at reception._'
        : '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + patientName + '\n*Doctor:* Dr. ' + drName + '\n*Department:* ' + specialty + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n\n*Booking ID:* ' + bookingId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n*Paid:* \u20B9' + amount + '\n\n_Present this QR code at reception._';

      // ── PHASE 15: Send WhatsApp notifications ──
      if (patientPhone) {
        tlog.info({ patientPhone }, 'PHASE 15 — Sending WA card to patient');
        await sendWA(waUrl, waToken, patientPhone, { type: 'image', image: { link: imageUrl, caption } });
        await new Promise(r => setTimeout(r, 3000));
        await sendWA(waUrl, waToken, patientPhone, {
          type: 'text', text: { body: 'Thank you for choosing *' + hospitalName + '* \u2705\n\nType *menu* anytime to book another appointment, reschedule, or manage your bookings.' },
        });
        tlog.info('PHASE 15 OK — WA messages sent to patient');
      } else {
        tlog.warn('PHASE 15 SKIP — No patient phone number');
      }

      // Send to booker if different person
      const bookerClean = bookedBy.replace(/\D/g, '');
      if (bookerClean && bookerClean !== patientPhone) {
        tlog.info({ bookerPhone: bookerClean }, 'PHASE 15b — Sending WA card to booker');
        await sendWA(waUrl, waToken, bookerClean, {
          type: 'image', image: { link: imageUrl, caption: '*' + hospitalName + '*\nBooking Confirmed for ' + patientName + '\n\n*Doctor:* Dr. ' + drName + '\n*Date:* ' + apptDate + '\n*Time:* ' + apptTime + '\n*Booking ID:* ' + bookingId + '\n\n_Present this pass at reception._' },
        });
        tlog.info('PHASE 15b OK — WA card sent to booker');
      }

      tlog.info({ opPassId }, 'SUCCESS — appointment payment processed');
    }

    /* ── PRESCRIPTION ── */
    if (type === 'prescription' && bookingId) {
      try {
        await sbPatch('/prescriptions?prescription_id=eq.' + encodeURIComponent(bookingId), {
          payment_status: 'paid', payment_id: paymentId, payment_link: paymentLinkId,
        });
        tlog.info('Prescription paid');
        logAudit({
          action: "status_change", entityType: "prescription", entityId: bookingId,
          actorEmail: "payment_webhook", actorRole: "system",
          details: { payment_status: "paid", payment_id: paymentId },
        });
      } catch (e) {
        tlog.error({ err: e }, 'Prescription update error');
      }
    }

    // Mark as processed in memory
    processedPayments.add(paymentId);
    return NextResponse.json({ status: 'ok' });
  } catch (err: unknown) {
    log.error({ err }, 'FATAL ERROR');
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
