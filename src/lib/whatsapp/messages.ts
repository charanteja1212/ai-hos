/**
 * WhatsApp Message Builders (Simplified)
 * Now only handles: language buttons, plain text, and CTA URLs.
 * Complex interactive menus removed — web pages handle those flows.
 */

import type { Language } from './types';
import { t } from './translations';

/** Truncate string to max length */
function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) : str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildReplyButtons(toPhone: string, text: string, buttons: { id: string; title: string }[]): any {
  const cappedButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: { id: btn.id || `btn_${idx + 1}`, title: truncate(btn.title, 20) },
  }));
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'interactive',
    interactive: { type: 'button', body: { text }, action: { buttons: cappedButtons } },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildListMessage(toPhone: string, bodyText: string, listData: { buttonText: string; sectionTitle: string; rows: { id: string; title: string; description: string }[] }): any {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: truncate(bodyText, 1024) },
      action: {
        button: truncate(listData.buttonText, 20),
        sections: [{
          title: truncate(listData.sectionTitle, 24),
          rows: listData.rows.map(r => ({
            id: r.id,
            title: truncate(r.title, 24),
            description: truncate(r.description, 72),
          })),
        }],
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTextMessage(toPhone: string, text: string): any {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'text', text: { preview_url: true, body: text },
  };
}

export interface BuildResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payloads: any[];
  sentType: string;
}

/**
 * Parse the AI reply string and build WhatsApp API payload(s).
 * Simplified — only language buttons and plain text remain.
 */
export function buildMessagePayloads(
  aiReply: string,
  toPhone: string,
  language: Language | null,
  _tenantConfig: {
    flow_registration_id?: string | null;
    flow_dependent_id?: string | null;
  }
): BuildResult {
  const lang = language || 'en';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloads: any[] = [];
  let sentType = 'text';

  // Check for list menu marker first
  const listMenuRegex = /\[LIST_MENU:([\s\S]+)\]$/;
  const listMatch = listMenuRegex.exec(aiReply);

  if (listMatch) {
    const bodyText = truncate(aiReply.substring(0, listMatch.index).trim(), 1024);
    try {
      const listData = JSON.parse(listMatch[1]);
      payloads.push(buildListMessage(toPhone, bodyText, listData));
      sentType = 'list';
    } catch {
      payloads.push(buildTextMessage(toPhone, aiReply.replace(listMenuRegex, '').trim()));
      sentType = 'text';
    }
    return { payloads, sentType };
  }

  const buttonRegex = /\[BUTTONS:([^\]]+)\]/;
  const btnMatch = buttonRegex.exec(aiReply);

  if (btnMatch) {
    const bodyText = truncate(aiReply.substring(0, btnMatch.index).trim() || t('select_option', lang), 1024);
    const markerType = btnMatch[1].trim().toLowerCase();

    if (markerType === 'language') {
      payloads.push(buildReplyButtons(toPhone, bodyText, [
        { id: 'lang_en', title: 'English' },
        { id: 'lang_hi', title: 'हिन्दी' },
        { id: 'lang_te', title: 'తెలుగు' },
      ]));
      sentType = 'buttons';
    } else {
      // Any other marker — just send as text (fallback)
      payloads.push(buildTextMessage(toPhone, aiReply.replace(/\[BUTTONS:[^\]]+\]/g, '').trim()));
      sentType = 'text';
    }
  } else {
    // Plain text — send with URL previews enabled
    payloads.push(buildTextMessage(toPhone, aiReply.trim()));
    sentType = 'text';
  }

  return { payloads, sentType };
}
