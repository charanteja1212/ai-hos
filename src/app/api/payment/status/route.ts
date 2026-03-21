/**
 * GET /api/payment/status?booking_id=BK123
 * Returns payment status for a booking. Used by the custom payment page to poll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';
import { isRateLimited } from '@/lib/rate-limit';
import { paymentStatusQuerySchema } from '@/lib/validations/api-schemas';

const log = createRouteLogger('/api/payment/status');

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  // Rate limit: max 60 status checks per IP per 5 minutes (page polls frequently)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(`pay-status:${ip}`, 60, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const validation = paymentStatusQuerySchema.safeParse({
    booking_id: req.nextUrl.searchParams.get('booking_id'),
  });
  if (!validation.success) {
    return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
  }
  const bookingId = validation.data.booking_id;

  try {
    const res = await fetch(
      SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(bookingId) +
      '&select=booking_id,status,payment_status,patient_name,doctor_name,specialty,date,time,op_pass_id,payment_link,payment_id,tenant_id',
      {
        headers: { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY() },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      log.error({ statusCode: res.status, detail: errBody.substring(0, 300) }, 'Supabase error');
      return NextResponse.json({ error: 'DB error', detail: errBody.substring(0, 200) }, { status: 500 });
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const appt = rows[0];

    // Fetch consultation fee from Razorpay payment link if available
    let consultation_fee: number | null = null;
    if (appt.payment_id) {
      try {
        const RZP_AUTH = 'Basic ' + (process.env.RAZORPAY_AUTH || '');
        const plRes = await fetch('https://api.razorpay.com/v1/payment_links/' + appt.payment_id, {
          headers: { Authorization: RZP_AUTH },
          signal: AbortSignal.timeout(5000),
        });
        if (plRes.ok) {
          const pl = await plRes.json();
          if (pl.amount) consultation_fee = pl.amount / 100; // paise to rupees
        }
      } catch { /* ignore — fee is optional */ }
    }

    // If payment_link is missing but booking is pending_payment, create Razorpay link on-the-fly
    if (!appt.payment_link && appt.status === 'pending_payment' && appt.payment_status === 'unpaid') {
      try {
        // Fetch tenant razorpay_auth and consultation_fee
        const tRes = await fetch(
          SB_URL() + '/tenants?tenant_id=eq.' + encodeURIComponent(appt.tenant_id || 'T001') + '&select=razorpay_auth,consultation_fee,hospital_name',
          { headers: { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY() }, signal: AbortSignal.timeout(5000) }
        );
        const tenants = tRes.ok ? await tRes.json() : [];
        const tenant = Array.isArray(tenants) && tenants.length > 0 ? tenants[0] : null;
        const rzpAuth = 'Basic ' + (tenant?.razorpay_auth || process.env.RAZORPAY_AUTH || '');
        const fee = tenant?.consultation_fee || 200;
        consultation_fee = fee;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ainewworld.in';
        const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
          method: 'POST',
          headers: { 'Authorization': rzpAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: fee * 100, currency: 'INR', accept_partial: false,
            description: 'Consultation - ' + (appt.doctor_name || ''),
            customer: { name: appt.patient_name || 'Patient', contact: '+91' + (appt.booking_id || '').slice(-10) },
            notify: { sms: false, email: false }, reminder_enable: false,
            callback_url: appUrl + '/wa/pay?id=' + encodeURIComponent(appt.booking_id),
            callback_method: 'get',
            expire_by: Math.floor(Date.now() / 1000) + 1200,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          appt.payment_link = rzpData.short_url || null;
          appt.payment_id = rzpData.id || null;
          // Save to DB
          if (appt.payment_link) {
            await fetch(
              SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(appt.booking_id),
              {
                method: 'PATCH',
                headers: { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                body: JSON.stringify({ payment_link: appt.payment_link, payment_id: appt.payment_id }),
                signal: AbortSignal.timeout(5000),
              }
            );
          }
        }
      } catch (e) {
        log.error({ err: e }, 'Failed to create on-the-fly Razorpay link');
      }
    }

    // Redact sensitive PII — only expose what the payment page needs
    return NextResponse.json({
      booking_id: appt.booking_id,
      status: appt.status,
      payment_status: appt.payment_status,
      patient_name: appt.patient_name ? appt.patient_name.split(" ")[0] + " ***" : null,
      doctor_name: appt.doctor_name,
      specialty: appt.specialty,
      appointment_date: appt.date,
      appointment_time: appt.time,
      op_pass_id: appt.op_pass_id || null,
      payment_link: appt.payment_link || null,
      consultation_fee,
      tenant_id: appt.tenant_id || null,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
