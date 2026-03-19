/**
 * GET /api/payment/status?booking_id=BK123
 * Returns payment status for a booking. Used by the custom payment page to poll.
 */

import { NextRequest, NextResponse } from 'next/server';

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
  }

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
      console.error('[payment/status] Supabase error:', res.status, errBody.substring(0, 300));
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
