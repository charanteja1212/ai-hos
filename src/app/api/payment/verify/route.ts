/**
 * POST /api/payment/verify
 * Verifies a Razorpay payment after Checkout.js handler fires.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id }
 * Verifies signature, updates appointment to confirmed+paid, creates OP pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';
import { isRateLimited } from '@/lib/rate-limit';
import crypto from 'crypto';

const log = createRouteLogger('payment/verify');

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RZP_SECRET = () => process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(`pay-verify:${ip}`, 20, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', RZP_SECRET())
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      log.error({ razorpay_order_id, booking_id }, 'Payment signature verification failed');
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Signature valid — update appointment
    const updateRes = await fetch(
      SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(booking_id),
      {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY(),
          Authorization: 'Bearer ' + SB_KEY(),
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'razorpay',
          razorpay_payment_id,
          razorpay_order_id,
        }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => '');
      log.error({ status: updateRes.status, body: errText.substring(0, 200) }, 'Failed to update appointment');
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    // Create OP Pass
    const opPassId = 'OP' + Date.now();
    try {
      // Get appointment details for OP pass
      const apptRes = await fetch(
        SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(booking_id) +
        '&select=patient_phone,patient_name,doctor_id,doctor_name,specialty,date,time,tenant_id',
        { headers: { apikey: SB_KEY(), Authorization: 'Bearer ' + SB_KEY() }, signal: AbortSignal.timeout(5000) }
      );
      const appts = apptRes.ok ? await apptRes.json() : [];
      const appt = Array.isArray(appts) && appts.length > 0 ? appts[0] : null;

      if (appt) {
        await fetch(SB_URL() + '/op_passes', {
          method: 'POST',
          headers: {
            apikey: SB_KEY(),
            Authorization: 'Bearer ' + SB_KEY(),
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            op_pass_id: opPassId,
            booking_id,
            patient_phone: appt.patient_phone,
            patient_name: appt.patient_name,
            doctor_id: appt.doctor_id,
            doctor_name: appt.doctor_name,
            specialty: appt.specialty,
            date: appt.date,
            time: appt.time,
            tenant_id: appt.tenant_id,
            status: 'active',
          }),
          signal: AbortSignal.timeout(5000),
        });

        // Update appointment with op_pass_id
        await fetch(
          SB_URL() + '/appointments?booking_id=eq.' + encodeURIComponent(booking_id),
          {
            method: 'PATCH',
            headers: {
              apikey: SB_KEY(),
              Authorization: 'Bearer ' + SB_KEY(),
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ op_pass_id: opPassId }),
            signal: AbortSignal.timeout(5000),
          }
        );
      }
    } catch (e) {
      log.error({ err: e, booking_id }, 'OP pass creation failed (non-fatal)');
    }

    log.info({ booking_id, razorpay_payment_id }, 'Payment verified and confirmed');

    return NextResponse.json({
      success: true,
      booking_id,
      op_pass_id: opPassId,
      status: 'confirmed',
      payment_status: 'paid',
    });
  } catch (err) {
    log.error({ err }, 'Unhandled error in payment verification');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
