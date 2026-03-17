/**
 * WhatsApp Bot Agent — Simplified Menu Launcher
 * Shows language selection → main menu with CTA URL links to web pages.
 * Complex flows (booking, cancel, reschedule, etc.) happen on web.
 */

import type { BotState, SessionData, ConvoMessage, Language, TenantConfig } from './types';
import { msg } from './translations';
import { generateWaToken } from './wa-token';
import { createServerNotification } from '@/lib/notifications-server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ainewworld.in';

export interface AgentInput {
  senderPhone: string;
  messageBody: string;
  messageId: string;
  cleanPhone: string;
  tenantId: string;
  tenant: TenantConfig;
  state: BotState;
  data: SessionData;
  language: Language | null;
  convoMessages: ConvoMessage[];
}

export interface AgentOutput {
  reply: string;
  nextState: BotState;
  data: SessionData;
  language: Language | null;
}

/**
 * Build the main menu as CTA URL buttons.
 * Returns a special [CTA_MENU] format that buildMessagePayloads parses
 * into separate WhatsApp CTA URL button messages.
 */
async function buildWebMenu(
  cleanPhone: string,
  tenantId: string,
  language: Language,
  hospitalName: string,
  patientName?: string,
): Promise<string> {
  const greeting = patientName
    ? msg('menu_greeting_known', language, { name: patientName, hospital: hospitalName })
    : msg('menu_greeting', language, { hospital: hospitalName });

  // Generate a single token with 30-minute expiry for all URLs
  const token = await generateWaToken(cleanPhone, tenantId, patientName, '30m');

  const ctaItems = [
    { bodyKey: 'cta_book_self', labelKey: 'btn_book_self', path: `/wa/book?mode=self&token=${token}` },
    { bodyKey: 'cta_book_other', labelKey: 'btn_book_other', path: `/wa/book?mode=dependent&token=${token}` },
    { bodyKey: 'cta_appointments', labelKey: 'btn_appointments', path: `/wa/appointments?token=${token}` },
    { bodyKey: 'cta_prescriptions', labelKey: 'btn_prescriptions', path: `/wa/prescriptions?token=${token}` },
  ];

  const ctaLines = ctaItems.map(item => {
    const body = msg(item.bodyKey, language);
    const label = msg(item.labelKey, language);
    return `[CTA_URL]${body}|${label}|${APP_URL}${item.path}`;
  });

  const talkHint = msg('talk_staff_footer', language);

  return `[CTA_MENU]\n${greeting}\n${ctaLines.join('\n')}\n[CTA_FOOTER]${talkHint}`;
}

/**
 * Run the state machine for a single incoming message.
 */
export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const { messageBody, cleanPhone, tenantId, tenant } = input;
  let { state, data, language } = input;

  const hospitalName = tenant.hospital_name || 'Care Hospital';
  const botName = tenant.bot_name || 'Advera';
  const lowerMsg = messageBody.toLowerCase().trim();

  // ---- Language detection (always runs) ----
  const rawMsg = messageBody.trim();
  if (lowerMsg === 'english' || lowerMsg === '1' || lowerMsg === 'en' || lowerMsg === 'lang_en') { language = 'en'; }
  else if (lowerMsg === 'hindi' || lowerMsg === '2' || rawMsg === 'हिन्दी' || rawMsg === 'हिंदी' || lowerMsg === 'lang_hi') { language = 'hi'; }
  else if (lowerMsg === 'telugu' || lowerMsg === '3' || lowerMsg === 'te' || rawMsg === 'తెలుగు' || lowerMsg === 'lang_te') { language = 'te'; }

  // ---- Global shortcuts ----
  const isMainMenuRequest = lowerMsg === 'menu' || lowerMsg === 'main menu' || lowerMsg === 'start over' || lowerMsg === 'restart' || lowerMsg === 'hi' || lowerMsg === 'hello';
  const isTalkToHuman = lowerMsg === 'talk to human' || lowerMsg === 'talk to staff' || lowerMsg === 'human' || lowerMsg === 'agent' || lowerMsg === 'help me' || lowerMsg === 'menu_talk_human' || lowerMsg === 'menu_talk_staff' || lowerMsg === '7';
  const isEndChat = lowerMsg === 'end chat' || lowerMsg === 'end' || lowerMsg === 'close chat' || lowerMsg === 'exit chat';

  if (isTalkToHuman && state !== 'LIVE_AGENT') {
    state = 'LIVE_AGENT';
    data = { _state: 'LIVE_AGENT' };
  }
  if (isMainMenuRequest && state !== 'IDLE' && state !== 'LANG_SELECT' && !isTalkToHuman) {
    state = 'MAIN_MENU_SHOW';
    data = { _state: 'MAIN_MENU_SHOW' };
  }

  let reply = '';
  let nextState: BotState = state;

  switch (state) {

    // ----- IDLE / NEW USER -----
    case 'IDLE': {
      reply = msg('welcome', language, { hospital: hospitalName, bot: botName });
      nextState = 'LANG_SELECT';
      break;
    }

    // ----- LANGUAGE SELECTION -----
    case 'LANG_SELECT': {
      if (language) {
        reply = await buildWebMenu(cleanPhone, tenantId, language, hospitalName);
        nextState = 'MAIN_MENU';
      } else {
        reply = msg('lang_retry', language);
        nextState = 'LANG_SELECT';
      }
      break;
    }

    // ----- MAIN MENU -----
    case 'MAIN_MENU_SHOW':
    case 'MAIN_MENU': {
      if (language) {
        // Show the full menu with all clickable URLs
        reply = await buildWebMenu(cleanPhone, tenantId, language, hospitalName, data.patientName);
        nextState = 'MAIN_MENU';
      } else {
        // No language set yet — ask for it
        reply = msg('welcome', language, { hospital: hospitalName, bot: botName });
        nextState = 'LANG_SELECT';
      }
      break;
    }

    // ----- LIVE AGENT -----
    case 'LIVE_AGENT': {
      if (isEndChat) {
        reply = msg('live_agent_ended', language);
        nextState = 'MAIN_MENU';

        // Close live chat if exists (must read liveChatId BEFORE wiping data)
        const chatIdToClose = data.liveChatId;
        data = { _state: 'MAIN_MENU' };

        if (chatIdToClose) {
          try {
            const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
            const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
            await fetch(
              SUPABASE_URL + '/live_chats?id=eq.' + chatIdToClose,
              {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + SUPABASE_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() }),
                signal: AbortSignal.timeout(8000),
              }
            );
          } catch { /* ignore */ }
        }
        break;
      }

      // First time entering live agent — create chat
      if (!data.liveChatId) {
        try {
          const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
          const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const res = await fetch(SUPABASE_URL + '/live_chats', {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              phone: cleanPhone,
              patient_name: data.patientName || cleanPhone,
              tenant_id: tenantId,
              status: 'active',
              messages: [{ role: 'patient', content: messageBody, ts: new Date().toISOString() }],
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
              data.liveChatId = rows[0].id;
            }
          }
        } catch { /* ignore */ }

        // Notify staff
        try {
          await createServerNotification({
            tenantId,
            title: 'Live Chat Request',
            message: `Patient ${cleanPhone} wants to chat with staff`,
            type: 'info',
            targetRole: 'RECEPTION',
            actionUrl: '/reception/chat',
          });
        } catch { /* ignore */ }

        reply = msg('live_agent_connected', language);
        nextState = 'LIVE_AGENT';
      } else {
        // Append message to existing chat
        try {
          const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
          const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          // Fetch current messages, append new one
          const getRes = await fetch(
            SUPABASE_URL + '/live_chats?id=eq.' + data.liveChatId + '&select=messages',
            {
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (getRes.ok) {
            const rows = await getRes.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msgs = (Array.isArray(rows) && rows[0]?.messages) ? rows[0].messages as any[] : [];
            msgs.push({ role: 'patient', content: messageBody, ts: new Date().toISOString() });
            await fetch(
              SUPABASE_URL + '/live_chats?id=eq.' + data.liveChatId,
              {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + SUPABASE_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: msgs }),
                signal: AbortSignal.timeout(8000),
              }
            );
          }
        } catch { /* ignore */ }

        // Don't send a bot reply in live agent mode — staff replies separately
        reply = '';
        nextState = 'LIVE_AGENT';
      }
      break;
    }

    default: {
      // Any old state from previous version — show menu
      if (language) {
        reply = await buildWebMenu(cleanPhone, tenantId, language, hospitalName, data.patientName);
        nextState = 'MAIN_MENU';
      } else {
        reply = msg('welcome', language, { hospital: hospitalName, bot: botName });
        nextState = 'LANG_SELECT';
      }
      break;
    }
  }

  return { reply, nextState, data: { ...data, _state: nextState }, language };
}
