/**
 * POST /api/payment/create-order
 * Creates a Razorpay Order for Checkout.js (used by the custom payment page).
 * Body: { booking_id: string }
 * Returns: { order_id, key_id, amount, currency, booking_id, patient_name, patient_phone }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';
import { isRateLimited } from '@/lib/rate-limit';
import { createOrderBodySchema } from '@/lib/validations/api-schemas';

const log = createRouteLogger('payment/create-order');

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RZP_AUTH = () => 'Basic ' + (process.env.RAZORPAY_AUTH || '');
const RZP_KEY_ID = () => process.env.RAZORPAY_KEY_ID || '';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 20 order creations per IP per 15 minutes
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`pay-create:${ip}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const validation = createOrderBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { booking_id } = validation.data;

    // Get appointment
    const apptRes = await fetch(
      SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(booking_id) +
      '&select=booking_id,patient_name,patient_phone,doctor_name,specialty,date,time,tenant_id,status,payment_status,payment_id',
      { headers: { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY() }, signal: AbortSignal.timeout(8000) }
    );
    if (!apptRes.ok) return NextResponse.json({ error: 'DB error' }, { status: 500 });
    const appts = await apptRes.json();
    if (!Array.isArray(appts) || appts.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const appt = appts[0];

    if (appt.status === 'confirmed' || appt.payment_status === 'paid') {
      return NextResponse.json({ error: 'Already paid' }, { status: 400 });
    }

    // Get amount from Razorpay Payment Link
    let amount = 20000; // default ₹200 in paise
    if (appt.payment_id) {
      try {
        const plRes = await fetch('https://api.razorpay.com/v1/payment_links/' + appt.payment_id, {
          headers: { Authorization: RZP_AUTH() }, signal: AbortSignal.timeout(8000),
        });
        if (plRes.ok) {
          const pl = await plRes.json();
          if (pl.amount) amount = pl.amount;
        }
      } catch { /* use default */ }
    }

    // Create Razorpay Order
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: RZP_AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        notes: {
          type: 'appointment',
          reference_id: booking_id,
          patient_name: appt.patient_name,
          patient_phone: appt.patient_phone,
          doctor_name: appt.doctor_name,
          specialty: appt.specialty,
          appointment_date: appt.date,
          appointment_time: appt.time,
          tenant_id: appt.tenant_id || 'T001',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text().catch(() => '');
      log.error({ status: orderRes.status, body: errText.substring(0, 200) }, 'Razorpay order creation failed');
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const order = await orderRes.json();

    return NextResponse.json({
      order_id: order.id,
      key_id: RZP_KEY_ID(),
      amount: order.amount,
      currency: order.currency,
      booking_id,
      patient_name: appt.patient_name,
      patient_phone: appt.patient_phone || '',
      doctor_name: appt.doctor_name,
      specialty: appt.specialty,
    });
  } catch (err: unknown) {
    log.error({ err }, 'Unhandled error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
