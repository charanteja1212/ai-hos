/**
 * WhatsApp Web Token — Short-lived JWT for patient web auth
 * Generates & verifies tokens so patients can open web pages from WhatsApp
 * without needing to log in.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.WA_WEB_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'wa-web-fallback-secret-change-me'
);

/** Token TTL — 15 minutes */
const TOKEN_TTL = '15m';

export interface WaTokenPayload extends JWTPayload {
  phone: string;
  tenantId: string;
  patientName?: string;
}

/**
 * Generate a short-lived JWT for a WhatsApp patient
 */
export async function generateWaToken(
  phone: string,
  tenantId: string,
  patientName?: string
): Promise<string> {
  return new SignJWT({ phone, tenantId, patientName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

/**
 * Verify and decode a WhatsApp web token
 * Returns null if invalid or expired
 */
export async function verifyWaToken(token: string): Promise<WaTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as WaTokenPayload;
  } catch {
    return null;
  }
}
