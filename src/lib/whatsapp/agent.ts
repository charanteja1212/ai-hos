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
 * Build the main menu with CTA URLs for each action
 */
async function buildWebMenu(
  cleanPhone: string,
  tenantId: string,
  language: Language,
  hospitalName: string,
  patientName?: string,
): Promise<string> {
  const token = await generateWaToken(cleanPhone, tenantId, patientName);
  const base = `${APP_URL}/wa`;
  const q = `token=${token}`;

  const greeting = patientName
    ? msg('menu_greeting_known', language, { name: patientName, hospital: hospitalName })
    : msg('menu_greeting', language, { hospital: hospitalName });

  const links = [
    { emoji: '1️⃣', label: msg('link_book_self', language), url: `${base}/book?mode=self&${q}` },
    { emoji: '2️⃣', label: msg('link_book_other', language), url: `${base}/book?mode=dependent&${q}` },
    { emoji: '3️⃣', label: msg('link_appointments', language), url: `${base}/appointments?${q}` },
    { emoji: '4️⃣', label: msg('link_reschedule', language), url: `${base}/appointments?action=reschedule&${q}` },
    { emoji: '5️⃣', label: msg('link_cancel', language), url: `${base}/appointments?action=cancel&${q}` },
    { emoji: '6️⃣', label: msg('link_prescriptions', language), url: `${base}/prescriptions?${q}` },
  ];

  const linkLines = links.map(l => `${l.emoji} *${l.label}*\n${l.url}`).join('\n\n');

  const talkLine = `7️⃣ *${msg('link_talk_staff', language)}*\n_${msg('link_talk_staff_hint', language)}_`;

  return `${greeting}\n\n${linkLines}\n\n${talkLine}`;
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
  const isTalkToHuman = lowerMsg === 'talk to human' || lowerMsg === 'talk to staff' || lowerMsg === 'human' || lowerMsg === 'agent' || lowerMsg === 'help me' || lowerMsg === 'menu_talk_human' || lowerMsg === '7';
  const isEndChat = lowerMsg === 'end chat' || lowerMsg === 'end' || lowerMsg === 'close chat' || lowerMsg === 'exit chat';

  // Quick menu shortcuts from numbered replies
  const isMenuAction = ['1', '2', '3', '4', '5', '6'].includes(lowerMsg);

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
      if (isMenuAction && language) {
        // User typed a number — generate fresh menu with clickable links
        reply = await buildWebMenu(cleanPhone, tenantId, language, hospitalName, data.patientName);
        nextState = 'MAIN_MENU';
      } else if (language) {
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
        data = { _state: 'MAIN_MENU' };

        // Close live chat if exists
        if (data.liveChatId) {
          try {
            const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
            const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
            await fetch(
              SUPABASE_URL + '/live_chats?id=eq.' + data.liveChatId,
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
              tenant_id: tenantId,
              status: 'open',
              messages: [{ role: 'user', content: messageBody, ts: new Date().toISOString() }],
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
            msgs.push({ role: 'user', content: messageBody, ts: new Date().toISOString() });
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
