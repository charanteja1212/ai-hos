/**
 * WhatsApp Session Management
 * Load, save, and expire sessions from Supabase chat_sessions table
 */

import type { Session, SessionData, ConvoMessage, Language, BotState } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supaHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

/** Session TTL — 30 minutes */
const TTL_MS = 30 * 60 * 1000;

/** Max conversation messages to keep */
const MAX_CONVO_MESSAGES = 60;

export interface LoadedSession {
  state: BotState;
  data: SessionData;
  language: Language | null;
  convoMessages: ConvoMessage[];
  isDuplicateMessage: boolean;
}

/**
 * Load session from Supabase.
 * Returns parsed session state, or defaults if session expired/missing.
 */
export async function loadSession(
  cleanPhone: string,
  tenantId: string,
  messageId: string
): Promise<LoadedSession> {
  let session: Session | null = null;

  try {
    const res = await fetch(
      SUPABASE_URL + '/chat_sessions?phone=eq.' + encodeURIComponent(cleanPhone) +
      '&tenant_id=eq.' + encodeURIComponent(tenantId),
      {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const sessions = await res.json();
      if (Array.isArray(sessions) && sessions.length > 0) {
        session = sessions[0];
      }
    }
  } catch (e) {
    console.error('[session] Load error:', e);
  }

  // Dedup check via session's last_message_id
  if (session && session.last_message_id === messageId) {
    return {
      state: 'IDLE',
      data: {},
      language: null,
      convoMessages: [],
      isDuplicateMessage: true,
    };
  }

  // Parse session state
  let state: BotState = 'IDLE';
  let data: SessionData = {};
  let language: Language | null = null;
  let convoMessages: ConvoMessage[] = [];

  if (session) {
    const lastActive = new Date(session.last_active || 0).getTime();
    const elapsed = Date.now() - lastActive;

    if (elapsed < TTL_MS) {
      state = (session.booking_state && session.booking_state._state) || 'IDLE';
      data = (typeof session.booking_state === 'object' && session.booking_state) ? session.booking_state : {};
      language = session.language || null;
      convoMessages = Array.isArray(session.messages) ? session.messages : [];

      // Warn if session is about to expire (25+ min inactive)
      if (elapsed > 25 * 60 * 1000 && state !== 'IDLE' && state !== 'MAIN_MENU') {
        data._sessionWarning = true;
      }
    }
  }

  return { state, data, language, convoMessages, isDuplicateMessage: false };
}

/**
 * Save session back to Supabase.
 * Uses upsert (merge-duplicates) on phone + tenant_id.
 */
export async function saveSession(
  cleanPhone: string,
  tenantId: string,
  state: BotState,
  data: SessionData,
  language: Language | null,
  convoMessages: ConvoMessage[],
  messageId: string,
  userMessage: string,
  aiReply: string
): Promise<void> {
  // Update state in data
  data._state = state;

  // Append conversation messages
  convoMessages.push({ role: 'user', content: userMessage });
  convoMessages.push({ role: 'assistant', content: aiReply });

  // Trim conversation history
  if (convoMessages.length > MAX_CONVO_MESSAGES) {
    convoMessages = convoMessages.slice(-MAX_CONVO_MESSAGES);
  }

  try {
    await fetch(SUPABASE_URL + '/chat_sessions', {
      method: 'POST',
      headers: {
        ...supaHeaders,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        tenant_id: tenantId,
        messages: convoMessages,
        language,
        booking_state: data,
        last_message_id: messageId,
        last_active: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('[session] Save error:', e);
  }
}
