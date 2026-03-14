/**
 * WhatsApp Bot Types
 * Types for the state-machine WhatsApp bot
 */

export type Language = 'en' | 'hi' | 'te';

export type BotState =
  | 'IDLE'
  | 'LANG_SELECT'
  | 'MAIN_MENU'
  | 'MAIN_MENU_SHOW'
  | 'SELF_LOOKUP'
  | 'AWAITING_REGISTRATION'
  | 'AWAITING_CALLER_REG'
  | 'BOOKING_SPECIALTY'
  | 'BOOKING_DOCTOR'
  | 'BOOKING_DATE'
  | 'BOOKING_PERIOD'
  | 'BOOKING_SLOT'
  | 'BOOKING_CONFIRM'
  | 'AWAITING_PAYMENT'
  | 'OTHER_LOOKUP'
  | 'AWAITING_DEPENDENT'
  | 'HAS_MOBILE'
  | 'COLLECT_PHONE'
  | 'RELATIONSHIP'
  | 'VIEW_APPOINTMENTS'
  | 'CANCEL_LIST'
  | 'CANCEL_SELECT'
  | 'CANCEL_CONFIRM'
  | 'RESCHED_LIST'
  | 'RESCHED_SELECT'
  | 'RESCHED_CONFIRM_OLD'
  | 'RESCHED_SPECIALTY'
  | 'RESCHED_DOCTOR'
  | 'RESCHED_DATE'
  | 'RESCHED_PERIOD'
  | 'RESCHED_SLOT'
  | 'RESCHED_CONFIRM_NEW'
  | 'FEEDBACK_RATING'
  | 'FEEDBACK_COMMENT'
  | 'PRESCRIPTION_LIST'
  | 'LIVE_AGENT';

export interface SessionData {
  _state?: BotState;
  _sessionWarning?: boolean;
  bookingType?: 'self' | 'someone_else';
  flowType?: 'cancel' | 'reschedule';
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  patientAge?: number | null;
  callerName?: string;
  callerPhone?: string;
  afterRegGoto?: string;
  noPatientPhone?: boolean;
  someoneElse?: {
    name: string;
    age: number | null;
    address: string;
    reason: string;
  };
  relationship?: string;
  dependentId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specialtiesData?: any;
  specialty?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchedDoctors?: any[];
  doctor_id?: string;
  doctor_name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  availabilityData?: any;
  selectedDate?: string;
  selectedPeriod?: string;
  selectedTime?: string;
  lastPaymentLink?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appointmentsData?: any[];
  selectedBookingId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedAppt?: any;
  oldBookingId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldAppt?: any;
  opPassValid?: boolean;
  reschedulesRemaining?: number;
  newSpecialty?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchedDoctorsResched?: any[];
  newDoctorId?: string;
  newDoctorName?: string;
  newSelectedDate?: string;
  newSelectedPeriod?: string;
  newSelectedTime?: string;
  // Feedback
  feedbackBookingId?: string;
  feedbackDoctorId?: string;
  feedbackDoctorName?: string;
  feedbackSpecialty?: string;
  feedbackRating?: number;
  // Prescriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prescriptionsData?: any[];
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
  /** Raw NFM response data for flow forms */
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
