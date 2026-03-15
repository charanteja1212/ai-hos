import { NextRequest, NextResponse } from 'next/server';
import { verifyWaToken } from '@/lib/whatsapp/wa-token';

/**
 * GET /api/whatsapp/token?token=xxx
 * Verifies a WhatsApp web token and returns the payload.
 * Used by /wa/* pages to authenticate the patient.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const payload = await verifyWaToken(token);

  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json({
    phone: payload.phone,
    tenantId: payload.tenantId,
    patientName: payload.patientName || null,
  });
}
