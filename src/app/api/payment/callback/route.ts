/**
 * Payment Callback Route — replaces n8n Payment Confirmation workflow
 * Razorpay redirects here after payment: GET /api/payment/callback?razorpay_payment_link_id=...&razorpay_payment_id=...&razorpay_payment_link_status=paid
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerNotifications } from '@/lib/notifications-server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RAZORPAY_AUTH = 'Basic ' + (process.env.RAZORPAY_AUTH || '');
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
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

async function getRzpAmount(paymentLinkId: string): Promise<number> {
  if (!paymentLinkId) return 0;
  try {
    const res = await fetch('https://api.razorpay.com/v1/payment_links/' + paymentLinkId, {
      headers: { 'Authorization': RAZORPAY_AUTH },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.amount ? data.amount / 100 : 0;
    }
  } catch { /* ok */ }
  return 0;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const paymentLinkId = params.get('razorpay_payment_link_id') || '';
  const paymentId = params.get('razorpay_payment_id') || '';
  const paymentLinkStatus = params.get('razorpay_payment_link_status') || '';

  // Debug logging — capture all callback params
  console.log('[payment-callback] URL:', req.nextUrl.toString());
  console.log('[payment-callback] Params:', Object.fromEntries(params.entries()));
  console.log('[payment-callback] paymentId:', paymentId, 'status:', paymentLinkStatus, 'linkId:', paymentLinkId);

  if (!paymentId || paymentLinkStatus !== 'paid') {
    console.error('[payment-callback] REJECTED — paymentId:', paymentId, 'status:', paymentLinkStatus);

    // Check if webhook already processed this payment link
    if (paymentLinkId) {
      try {
        const existing = await sbGet(
          '/appointments?payment_id=eq.' + encodeURIComponent(paymentLinkId) +
          '&status=eq.confirmed&select=booking_id,op_pass_id,patient_name,doctor_name,specialty,date,time'
        );
        if (Array.isArray(existing) && existing.length > 0) {
          console.log('[payment-callback] Webhook already processed, showing confirmation for:', existing[0].booking_id);
          const e = existing[0];
          const amountPaid = await getRzpAmount(paymentLinkId);
          return new NextResponse(
            await confirmationPage({ referenceId: e.booking_id, opPassId: e.op_pass_id, patientName: e.patient_name, cleanDrName: (e.doctor_name || '').replace(/^Dr\.?\s*/i, '').trim(), specialty: e.specialty, appointmentDate: e.date, appointmentTime: e.time, amountPaid, alreadyProcessed: true }),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
      } catch { /* continue to error */ }
    }

    return new NextResponse(errorPage('Payment not completed. Status: ' + paymentLinkStatus), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Verify Razorpay payment signature
  const razorpaySignature = params.get('razorpay_signature') || '';
  if (RAZORPAY_KEY_SECRET && razorpaySignature) {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(paymentLinkId + '|' + params.get('razorpay_payment_link_reference_id') + '|' + paymentLinkStatus + '|' + paymentId)
      .digest('hex');
    if (razorpaySignature !== expectedSignature) {
      console.error('[payment-callback] Signature verification failed');
      return new NextResponse(errorPage('Payment verification failed. Please contact the hospital.'), {
        status: 200, headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  // Server-side verification: confirm payment is actually captured via Razorpay API
  try {
    const verifyRes = await fetch('https://api.razorpay.com/v1/payments/' + paymentId, {
      headers: { 'Authorization': RAZORPAY_AUTH },
      signal: AbortSignal.timeout(10000),
    });
    if (verifyRes.ok) {
      const paymentData = await verifyRes.json();
      console.log('[payment-callback] Razorpay payment status:', paymentData.status, 'amount:', paymentData.amount);
      if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
        console.error('[payment-callback] Payment not captured. Status:', paymentData.status);
        return new NextResponse(errorPage('Payment not completed. Your payment status is: ' + paymentData.status + '. If money was deducted, it will be refunded automatically. Please try again.'), {
          status: 200, headers: { 'Content-Type': 'text/html' },
        });
      }
    } else {
      console.error('[payment-callback] Failed to verify payment with Razorpay:', verifyRes.status);
    }
  } catch (e) {
    console.error('[payment-callback] Payment verification API error:', e);
    // Continue — don't block if Razorpay API is temporarily down, webhook will handle it
  }

  // Idempotency check
  try {
    const existing = await sbGet(
      '/appointments?razorpay_payment_id=eq.' + encodeURIComponent(paymentId) +
      '&status=eq.confirmed&select=booking_id,op_pass_id,patient_name,doctor_name,specialty,date,time'
    );
    if (Array.isArray(existing) && existing.length > 0) {
      const e = existing[0];
      const amountPaid = await getRzpAmount(paymentLinkId);
      return new NextResponse(
        await confirmationPage({ referenceId: e.booking_id, opPassId: e.op_pass_id, patientName: e.patient_name, cleanDrName: (e.doctor_name || '').replace(/^Dr\.?\s*/i, '').trim(), specialty: e.specialty, appointmentDate: e.date, appointmentTime: e.time, amountPaid, alreadyProcessed: true }),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
  } catch { /* continue */ }

  try {
    // Fetch payment link details from Razorpay
    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links/' + paymentLinkId, {
      headers: { 'Authorization': RAZORPAY_AUTH },
      signal: AbortSignal.timeout(10000),
    });
    if (!rzpRes.ok) throw new Error('Razorpay API error: ' + rzpRes.status);
    const linkDetails = await rzpRes.json();

    const notes = linkDetails.notes || {};
    const tenantId = notes.tenant_id || 'T001';
    const type = notes.type || 'appointment';
    const referenceId = notes.reference_id || '';
    const patientName = notes.patient_name || 'Patient';
    const patientPhone = (notes.patient_phone || '').replace(/\D/g, '');
    const doctorName = notes.doctor_name || '';
    const specialty = notes.specialty || '';
    let appointmentDate = notes.appointment_date || '';
    let appointmentTime = notes.appointment_time || '';
    const amountPaid = linkDetails.amount ? (linkDetails.amount / 100) : 0;

    // DB fallback for date/time
    if ((!appointmentDate || !appointmentTime) && referenceId) {
      try {
        const rows = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(referenceId) + '&select=date,time');
        if (Array.isArray(rows) && rows.length > 0) {
          if (!appointmentDate && rows[0].date) {
            const d = rows[0].date;
            const dObj = new Date(Date.UTC(...d.split('-').map(Number) as [number, number, number]));
            dObj.setUTCMonth(dObj.getUTCMonth() - 1); // month is 0-indexed
            const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const [yr, mo, dy] = d.split('-').map(Number);
            const dateObj = new Date(Date.UTC(yr, mo - 1, dy, 12, 0, 0));
            appointmentDate = days[dateObj.getUTCDay()] + ', ' + dy + ' ' + months[mo - 1] + ' ' + yr;
          }
          if (!appointmentTime && rows[0].time) appointmentTime = rows[0].time;
        }
      } catch { /* fallback failed */ }
    }

    // Fetch tenant for WA credentials + hospital name
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

    if (type === 'appointment' && referenceId) {
      // Create OP Pass
      const ist = nowIST();
      const issueDate = ist.dateStr;
      const expiryMs = ist.ms + 15 * 86400000;
      const expiryDate = new Date(expiryMs).toISOString().split('T')[0];
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

      // Notify reception + admin about payment
      createServerNotifications([
        {
          tenantId,
          type: 'payment_received',
          title: 'Payment Received',
          message: `${patientName} paid ₹${amountPaid} for Dr. ${cleanDrName} (${referenceId})`,
          targetRole: 'RECEPTION',
          referenceId,
          referenceType: 'appointment',
        },
        {
          tenantId,
          type: 'new_booking',
          title: 'New Booking Confirmed',
          message: `${patientName} booked with Dr. ${cleanDrName} on ${appointmentDate} ${appointmentTime}`,
          targetRole: 'RECEPTION',
          referenceId,
          referenceType: 'appointment',
        },
        {
          tenantId,
          type: 'payment_received',
          title: 'Payment Received',
          message: `₹${amountPaid} from ${patientName} for appointment ${referenceId}`,
          targetRole: 'ADMIN',
          referenceId,
          referenceType: 'appointment',
        },
      ]);

      // Create reminders
      try {
        const apptRows2 = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(referenceId) + '&select=date,time');
        if (Array.isArray(apptRows2) && apptRows2.length > 0) {
          const a = apptRows2[0];
          const tMatch = (a.time || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (tMatch) {
            let rH = parseInt(tMatch[1], 10);
            const rM = parseInt(tMatch[2], 10);
            if (tMatch[3].toUpperCase() === 'PM' && rH !== 12) rH += 12;
            if (tMatch[3].toUpperCase() === 'AM' && rH === 12) rH = 0;
            const apptISO = a.date + 'T' + String(rH).padStart(2, '0') + ':' + String(rM).padStart(2, '0') + ':00+05:30';
            const apptMs = new Date(apptISO).getTime();
            const reminders: object[] = [];
            const rem24 = apptMs - 86400000;
            const rem2 = apptMs - 7200000;
            if (rem24 > Date.now()) reminders.push({ id: referenceId + '_24h', patient_phone: patientPhone, patient_name: patientName, appointment_date: a.date, appointment_time: a.time, reminder_type: '24h', send_at: new Date(rem24).toISOString(), sent: 'no', booked_by_whatsapp_number: bookedBy, tenant_id: tenantId });
            if (rem2 > Date.now()) reminders.push({ id: referenceId + '_2h', patient_phone: patientPhone, patient_name: patientName, appointment_date: a.date, appointment_time: a.time, reminder_type: '2h', send_at: new Date(rem2).toISOString(), sent: 'no', booked_by_whatsapp_number: bookedBy, tenant_id: tenantId });
            if (reminders.length > 0) {
              try { await sbPost('/reminders', reminders); } catch { /* ok */ }
            }
          }
        }
      } catch { /* reminders non-critical */ }

      // Fire-and-forget: generate card + send WA messages in background (don't block HTML response)
      const bgPatientPhone = patientPhone;
      const bgBookedBy = bookedBy;
      (async () => {
        try {
          const cardImageUrl = await generateCardImage({
            hospitalName, patientName, cleanDrName, specialty,
            appointmentDate, appointmentTime, amountPaid,
            qrUrl, referenceId, opPassId, expiryDisplay,
          });

          const isCard = cardImageUrl !== qrUrl;
          const shortCaption = '*' + hospitalName + '*\nAppointment Confirmed\n\n*Amount Paid:* \u20B9' + amountPaid + '\n*Booking ID:* ' + referenceId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_Present this digital pass at reception._';
          const detailedCaption = '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + patientName + '\n*Doctor:* Dr. ' + cleanDrName + '\n*Department:* ' + specialty + '\n*Date:* ' + appointmentDate + '\n*Time:* ' + appointmentTime + '\n\n*Booking ID:* ' + referenceId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n*Paid:* \u20B9' + amountPaid + '\n\n_Present this QR code at reception._\n_Your OP Pass is valid for 15 days._';
          const caption = isCard ? shortCaption : detailedCaption;

          if (bgPatientPhone) {
            await sendWA(waApiUrl, waToken, bgPatientPhone, { type: 'image', image: { link: cardImageUrl, caption } });
            await new Promise(r => setTimeout(r, 5000));
            await sendWA(waApiUrl, waToken, bgPatientPhone, {
              type: 'text', text: { body: 'Thank you for choosing *' + hospitalName + '* \u2705\n\nType *menu* anytime to book another appointment, reschedule, or manage your bookings.' },
            });
          }

          const bookerDigits = bgBookedBy.replace(/\D/g, '');
          if (bookerDigits && bookerDigits !== bgPatientPhone) {
            const bookerCaption = '*' + hospitalName + '*\nBooking Confirmed for ' + patientName + '\n\n*Doctor:* Dr. ' + cleanDrName + '\n*Date:* ' + appointmentDate + '\n*Time:* ' + appointmentTime + '\n*Booking ID:* ' + referenceId + '\n\n_Present this pass at reception._';
            await sendWA(waApiUrl, waToken, bookerDigits, { type: 'image', image: { link: cardImageUrl, caption: bookerCaption } });
          }
        } catch (e) { console.error('[payment-callback] Background WA send error:', e); }
      })();

      // Return confirmation HTML page immediately
      return new NextResponse(
        await confirmationPage({
          hospitalName, patientName, cleanDrName, specialty,
          appointmentDate, appointmentTime, amountPaid,
          referenceId, opPassId, expiryDisplay, qrUrl,
        }),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Prescription payment type
    if (type === 'prescription' && referenceId) {
      try {
        await sbPatch('/prescriptions?prescription_id=eq.' + encodeURIComponent(referenceId), {
          payment_status: 'paid', payment_id: paymentId, payment_link: paymentLinkId,
        });
      } catch { /* continue */ }

      return new NextResponse(
        await confirmationPage({ hospitalName, patientName, referenceId, amountPaid, isPrescription: true }),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(errorPage('Unknown payment type'), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('[payment-callback] FATAL Error:', error);
    return new NextResponse(errorPage('Payment processing error. Please contact the hospital. Error: ' + (error instanceof Error ? error.message : String(error))), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }
}

function nowIST() {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600000;
  const istDate = new Date(istMs);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  return { dateStr: yyyy + '-' + mm + '-' + dd, ms: istMs };
}

async function generateCardImage(d: {
  hospitalName: string; patientName: string; cleanDrName: string; specialty: string;
  appointmentDate: string; appointmentTime: string; amountPaid: number;
  qrUrl: string; referenceId: string; opPassId: string; expiryDisplay: string;
}): Promise<string> {
  const cardHtml = '<div style="width:800px;height:600px;font-family:Segoe UI,Roboto,Arial,sans-serif;display:flex;overflow:hidden">'
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

  try {
    const imgRes = await fetch('http://html2img:3000/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: cardHtml, vw: 800, vh: 600 }),
      signal: AbortSignal.timeout(3000),
    });
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      if (imgData?.url) return imgData.url;
    }
  } catch { /* fallback */ }
  return d.qrUrl;
}

async function confirmationPage(d: {
  hospitalName?: string; patientName?: string; cleanDrName?: string; specialty?: string;
  appointmentDate?: string; appointmentTime?: string; amountPaid?: number;
  referenceId?: string; opPassId?: string; expiryDisplay?: string; qrUrl?: string;
  alreadyProcessed?: boolean; isPrescription?: boolean;
}): Promise<string> {
  const h = escapeHtml;
  const hospital = d.hospitalName || 'Care Hospital';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment Confirmed</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f4f8;padding:16px;color:#1a202c}
.card{background:#fff;border-radius:16px;overflow:hidden;max-width:440px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.header{background:#0284c7;padding:24px 20px;text-align:center;color:#fff}
.header h1{font-size:18px;font-weight:700;margin-bottom:4px}
.header p{font-size:12px;opacity:0.9}
.badge{display:inline-block;background:rgba(255,255,255,0.25);padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;margin-top:10px}
.amount{text-align:center;padding:16px 20px;font-size:28px;font-weight:800;color:#059669}
.rows{padding:0 20px 16px}
.row{padding:10px 0;border-bottom:1px solid #f0f0f0}
.row:last-child{border-bottom:none}
.label{font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.value{font-size:14px;font-weight:600;color:#1e293b;margin-top:2px}
.ids{padding:0 20px 16px;display:flex;gap:8px}
.id-box{flex:1;background:#f1f5f9;padding:10px;border-radius:8px;text-align:center}
.id-box .label{font-size:9px}.id-box .value{font-size:11px;word-break:break-all}
.qr{text-align:center;padding:16px 20px}
.qr img{border-radius:8px;border:2px solid #e2e8f0}
.qr p{font-size:11px;color:#059669;font-weight:600;margin-top:8px}
.expiry{margin:0 20px 16px;padding:10px;background:#fef9c3;border-radius:8px;text-align:center;font-size:12px;color:#92400e;font-weight:600}
.footer{background:#f8fafc;padding:16px 20px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9}
.wa-note{text-align:center;padding:16px;font-size:13px;color:#64748b}
</style>
</head>
<body>
<div class="card">
<div class="header">
<h1>${h(hospital.toUpperCase())}</h1>
<p>Digital Appointment Pass</p>
<div class="badge">Confirmed &amp; Paid</div>
</div>
<div class="amount">\u20B9${d.amountPaid || 0}</div>
<div class="rows">
<div class="row"><div class="label">Patient</div><div class="value">${h(d.patientName || '-')}</div></div>
${d.cleanDrName ? `<div class="row"><div class="label">Doctor</div><div class="value">Dr. ${h(d.cleanDrName)}</div></div>` : ''}
${d.specialty ? `<div class="row"><div class="label">Department</div><div class="value">${h(d.specialty)}</div></div>` : ''}
${d.appointmentDate ? `<div class="row"><div class="label">Date</div><div class="value">${h(d.appointmentDate)}</div></div>` : ''}
${d.appointmentTime ? `<div class="row"><div class="label">Time</div><div class="value">${h(d.appointmentTime)}</div></div>` : ''}
</div>
<div class="ids">
<div class="id-box"><div class="label">Booking ID</div><div class="value">${h(d.referenceId || '-')}</div></div>
${d.opPassId ? `<div class="id-box"><div class="label">OP Pass</div><div class="value">${h(d.opPassId)}</div></div>` : ''}
</div>
${d.qrUrl ? `<div class="qr"><img src="${d.qrUrl}" width="180" height="180" alt="QR"><p>Scan at Reception</p></div>` : ''}
${d.expiryDisplay ? `<div class="expiry">OP Pass Valid Until: ${h(d.expiryDisplay)}</div>` : ''}
<div class="footer">Thank you for choosing ${h(hospital)}.<br>Your OP Pass has been sent on WhatsApp.</div>
</div>
<div class="wa-note" id="countdown">Returning to WhatsApp in <span id="sec">4</span>s...</div>
<a href="https://wa.me/" id="wa-btn" style="display:none;text-align:center;margin:12px auto;padding:12px 28px;background:#25D366;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px;max-width:260px;width:100%;">Return to WhatsApp</a>
<script>
var s=4,t=setInterval(function(){s--;document.getElementById('sec').textContent=s;if(s<=0){clearInterval(t);try{window.close()}catch(e){}setTimeout(function(){window.location.href='https://wa.me/';setTimeout(function(){document.getElementById('countdown').textContent='Page could not close automatically.';document.getElementById('wa-btn').style.display='block'},1500)},300)}},1000);
</script>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Payment Error</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f4f8;padding:16px;color:#1a202c}
.card{background:#fff;padding:40px 24px;border-radius:16px;text-align:center;max-width:400px;margin:40px auto;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{font-size:20px;margin-bottom:12px;color:#dc2626}p{color:#64748b;font-size:14px;line-height:1.5}
.note{margin-top:20px;font-size:13px;color:#94a3b8}</style>
</head><body><div class="card"><h1>Payment Issue</h1><p>${escapeHtml(message)}</p><p class="note" id="countdown">Returning to WhatsApp in <span id="sec">4</span>s...</p></div>
<script>
var s=4,t=setInterval(function(){s--;document.getElementById('sec').textContent=s;if(s<=0){clearInterval(t);try{window.close()}catch(e){}setTimeout(function(){window.location.href='https://wa.me/'},300)}},1000);
</script>
</body></html>`;
}
