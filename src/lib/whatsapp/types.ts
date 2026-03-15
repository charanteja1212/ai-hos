/**
 * WhatsApp Bot Types
 * Simplified: WhatsApp is now a menu launcher → web pages handle complex flows
 */

export type Language = 'en' | 'hi' | 'te';

export type BotState =
  | 'IDLE'
  | 'LANG_SELECT'
  | 'MAIN_MENU'
  | 'MAIN_MENU_SHOW'
  | 'LIVE_AGENT';

export interface SessionData {
  _state?: BotState;
  _sessionWarning?: boolean;
  patientName?: string;
  patientPhone?: string;
  // Live agent
  liveChatId?: string;
}

export interface ConvoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Session {
  phone: string;
  tenant_id: string;
  messages: ConvoMessage[];
  language: Language | null;
  booking_state: SessionData;
  last_message_id: string;
  last_active: string;
}

export interface TenantConfig {
  tenant_id: string;
  hospital_name: string;
  bot_name: string;
  consultation_fee: number;
  openai_api_key: string;
  openai_model: string;
  wa_token: string;
  wa_api_url: string;
  whatsapp_phone_id: string;
  flow_registration_id: string;
  flow_dependent_id: string;
}

export interface ParsedMessage {
  senderPhone: string;
  messageBody: string;
  messageId: string;
  receiverPhoneId: string;
  messageType: 'text' | 'button_reply' | 'list_reply' | 'nfm_reply' | 'unknown';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nfmResponseData?: any;
}

export interface AgentResult {
  duplicate: boolean;
  senderPhone: string;
  messageId: string;
  aiReply: string;
  language: Language;
  tenantConfig: {
    wa_token: string | null;
    wa_api_url: string | null;
    flow_registration_id: string | null;
    flow_dependent_id: string | null;
  };
}
