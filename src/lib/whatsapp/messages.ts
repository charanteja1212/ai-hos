/**
 * WhatsApp Message Builders
 * Handles: language buttons, CTA URL buttons, plain text.
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
function buildCtaUrlMessage(toPhone: string, bodyText: string, displayText: string, url: string): any {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: truncate(bodyText, 1024) },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: truncate(displayText, 36),
          url,
        },
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTextMessage(toPhone: string, text: string): any {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'text', text: { preview_url: false, body: text },
  };
}

export interface BuildResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payloads: any[];
  sentType: string;
}

/**
 * Parse the AI reply string and build WhatsApp API payload(s).
 * Supports: [BUTTONS:language], [CTA_URL] markers, and plain text.
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

  // --- CTA URL menu format ---
  // [CTA_MENU]
  // greeting line
  // [CTA_URL]body text|button label|url
  // [CTA_FOOTER]footer text
  if (aiReply.startsWith('[CTA_MENU]')) {
    const lines = aiReply.split('\n');
    const greetingLines: string[] = [];
    const footerLines: string[] = [];
    const ctaItems: { body: string; label: string; url: string }[] = [];
    let inFooter = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('[CTA_URL]')) {
        const parts = line.substring(9).split('|');
        if (parts.length >= 3) {
          ctaItems.push({ body: parts[0], label: parts[1], url: parts[2] });
        }
      } else if (line.startsWith('[CTA_FOOTER]')) {
        inFooter = true;
        const rest = line.substring(12).trim();
        if (rest) footerLines.push(rest);
      } else if (inFooter) {
        footerLines.push(line);
      } else {
        greetingLines.push(line);
      }
    }

    // 1. Greeting text
    const greeting = greetingLines.join('\n').trim();
    if (greeting) {
      payloads.push(buildTextMessage(toPhone, greeting));
    }

    // 2. CTA URL buttons
    for (const cta of ctaItems) {
      payloads.push(buildCtaUrlMessage(toPhone, cta.body, cta.label, cta.url));
    }

    // 3. Footer text
    const footer = footerLines.join('\n').trim();
    if (footer) {
      payloads.push(buildTextMessage(toPhone, footer));
    }

    sentType = 'cta_menu';
    return { payloads, sentType };
  }

  // --- Language buttons ---
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
      payloads.push(buildTextMessage(toPhone, aiReply.replace(/\[BUTTONS:[^\]]+\]/g, '').trim()));
      sentType = 'text';
    }
  } else {
    // Plain text
    payloads.push(buildTextMessage(toPhone, aiReply.trim()));
    sentType = 'text';
  }

  return { payloads, sentType };
}
