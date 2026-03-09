/**
 * WhatsApp Webhook Message Parser
 * Parses incoming Meta webhook payload to extract message content
 */

import type { ParsedMessage } from './types';

/**
 * Parse the incoming Meta webhook body into a structured message.
 * Handles text, button replies, list replies, and NFM flow form responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseWebhookPayload(body: any): ParsedMessage | null {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return null;

    const phoneNumberId = value?.metadata?.phone_number_id || '';
    const messages = value?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const message = messages[0];
    const senderPhone = message?.from || '';
    const messageId = message?.id || '';
    const messageType = message?.type || 'text';

    let messageBody = '';
    let parsedType: ParsedMessage['messageType'] = 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nfmResponseData: any = undefined;

    switch (messageType) {
      case 'text': {
        messageBody = message?.text?.body || '';
        parsedType = 'text';
        break;
      }
      case 'interactive': {
        const interactive = message?.interactive;
        const interactiveType = interactive?.type;

        if (interactiveType === 'button_reply') {
          // Reply button — user tapped a quick reply button
          messageBody = interactive?.button_reply?.id || interactive?.button_reply?.title || '';
          parsedType = 'button_reply';
        } else if (interactiveType === 'list_reply') {
          // List reply — user selected from a list
          messageBody = interactive?.list_reply?.id || interactive?.list_reply?.title || '';
          parsedType = 'list_reply';
        } else if (interactiveType === 'nfm_reply') {
          // NFM (Native Flow Message) — form submission from WhatsApp Flow
          parsedType = 'nfm_reply';
          const responseJson = interactive?.nfm_reply?.response_json;
          if (responseJson) {
            try {
              const parsed = typeof responseJson === 'string'
                ? JSON.parse(responseJson)
                : responseJson;
              nfmResponseData = parsed;

              // Convert flow form data to the format expected by the state machine
              // Registration flow: REGISTRATION_DATA:Name: X, Age: Y, Email: Z, Address: W
              // Dependent flow: DEPENDENT_DATA:Name: X, Age: Y, Address: Z, Reason: W
              if (parsed.screen === 'REGISTRATION' || parsed.flow_token?.startsWith('reg_')) {
                const parts: string[] = [];
                if (parsed.name) parts.push('Name: ' + parsed.name);
                if (parsed.age) parts.push('Age: ' + parsed.age);
                if (parsed.email) parts.push('Email: ' + parsed.email);
                if (parsed.address) parts.push('Address: ' + parsed.address);
                if (parsed.gender) parts.push('Gender: ' + parsed.gender);
                messageBody = 'REGISTRATION_DATA:' + parts.join(', ');
              } else if (parsed.screen === 'DEPENDENT_REG') {
                const parts: string[] = [];
                if (parsed.name) parts.push('Name: ' + parsed.name);
                if (parsed.age) parts.push('Age: ' + parsed.age);
                if (parsed.address) parts.push('Address: ' + parsed.address);
                if (parsed.reason) parts.push('Reason: ' + parsed.reason);
                messageBody = 'DEPENDENT_DATA:' + parts.join(', ');
              } else {
                // Unknown flow type — try to reconstruct something useful
                messageBody = JSON.stringify(parsed);
              }
            } catch {
              messageBody = String(responseJson);
            }
          }
        }
        break;
      }
      case 'button': {
        // Template button reply (different from interactive button_reply)
        messageBody = message?.button?.text || message?.button?.payload || '';
        parsedType = 'button_reply';
        break;
      }
      default: {
        // Image, audio, document, etc. — treat as unknown
        messageBody = '';
        parsedType = 'unknown';
        break;
      }
    }

    if (!senderPhone) return null;

    return {
      senderPhone,
      messageBody,
      messageId,
      receiverPhoneId: phoneNumberId,
      messageType: parsedType,
      nfmResponseData,
    };
  } catch (err) {
    console.error('[whatsapp-parser] Failed to parse webhook payload:', err);
    return null;
  }
}

/**
 * Check if the webhook payload is a status update (not a message)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStatusUpdate(body: any): boolean {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  return !!(value?.statuses && value.statuses.length > 0 && !value?.messages);
}
