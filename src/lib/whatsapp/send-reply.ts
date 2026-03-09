/**
 * WhatsApp Send Reply
 * Takes the AI reply string (with markers), builds the WhatsApp payload,
 * marks incoming message as read, and sends the reply via Cloud API.
 */

import type { Language } from './types';
import { buildMessagePayloads } from './messages';

interface SendReplyOptions {
  senderPhone: string;
  messageId: string;
  aiReply: string;
  language: Language | null;
  waToken: string;
  waApiUrl: string;
  tenantConfig: {
    flow_registration_id?: string | null;
    flow_dependent_id?: string | null;
  };
}

interface SendReplyResult {
  success: boolean;
  sentType: string;
  waMessageId?: string;
  error?: string;
}

/**
 * Send an HTTP request to the WhatsApp Cloud API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendWA(waApiUrl: string, waToken: string, payload: any): Promise<any> {
  const res = await fetch(waApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`WhatsApp API ${res.status}: ${errText.substring(0, 200)}`);
  }

  return res.json();
}

/**
 * Send the AI reply to WhatsApp.
 * 1. Mark incoming message as read
 * 2. Parse markers and build payload(s)
 * 3. Send the message(s)
 */
export async function sendReply(options: SendReplyOptions): Promise<SendReplyResult> {
  const { senderPhone, messageId, aiReply, language, waToken, waApiUrl, tenantConfig } = options;

  if (!senderPhone) {
    return { success: false, sentType: 'none', error: 'No senderPhone' };
  }

  if (!waToken || !waApiUrl) {
    return { success: false, sentType: 'none', error: 'WhatsApp not configured' };
  }

  // Strip + prefix for WhatsApp API
  const toPhone = senderPhone.replace(/\+/g, '');

  // Step 1: Mark incoming message as read
  if (messageId) {
    try {
      await sendWA(waApiUrl, waToken, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch {
      // Non-fatal
    }
  }

  // Step 2: Build payloads
  const { payloads, sentType } = buildMessagePayloads(aiReply, toPhone, language, tenantConfig);

  // Step 3: Send
  let lastResult = null;
  for (const payload of payloads) {
    try {
      lastResult = await sendWA(waApiUrl, waToken, payload);
    } catch (err) {
      return {
        success: false,
        sentType,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: true,
    sentType,
    waMessageId: lastResult?.messages?.[0]?.id,
  };
}
