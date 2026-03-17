/**
 * GET /api/payment/callback
 * Browser redirect after Razorpay payment. Returns HTML only — no processing.
 * All payment processing happens in /api/payment/webhook.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Done</title></head>' +
    '<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f0fdf4;text-align:center">' +
    '<div style="font-size:48px;margin-bottom:12px">&#9989;</div>' +
    '<h1 style="font-size:20px;color:#166534;margin:0 0 8px">Payment Successful!</h1>' +
    '<p style="font-size:14px;color:#4b5563;margin:0 0 16px">Your OP Pass will be sent on WhatsApp.</p>' +
    '<a href="whatsapp://" style="display:inline-block;background:#25D366;color:white;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px">Back to WhatsApp</a>' +
    '<script>try{window.close()}catch(e){}setTimeout(function(){location.href="whatsapp://"},1500)</script>' +
    '</body></html>';

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store' },
  });
}
