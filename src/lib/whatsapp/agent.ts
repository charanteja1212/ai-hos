/**
 * WhatsApp Bot Agent — State Machine
 * Deterministic flow control. GPT used ONLY for free-text intent detection.
 * Port of openai_agent_full.txt (V10) to TypeScript.
 */

import type { BotState, SessionData, ConvoMessage, Language, TenantConfig } from './types';
import { msg } from './translations';
import { callTool, saveDependentRecord } from './tools';

/** Strip "Dr." prefix */
function drName(name: string): string {
  return (name || '').replace(/^Dr\.?\s*/i, '').trim();
}

/** Format date + time for book_appointment API (YYYY-MM-DD HH:MM) */
function formatStartTime(dateLabel: string, timeStr: string): string {
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
  };
  const parts = dateLabel.trim().split(/\s+/);
  const day = (parts[0] || '01').padStart(2, '0');
  const mon = months[parts[1]] || '01';
  const year = parts[2] || '2026';

  const tm = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!tm) return year + '-' + mon + '-' + day + ' 10:00';
  let hr = parseInt(tm[1], 10);
  const min = tm[2];
  const ampm = tm[3].toUpperCase();
  if (ampm === 'PM' && hr < 12) hr += 12;
  if (ampm === 'AM' && hr === 12) hr = 0;
  return year + '-' + mon + '-' + day + ' ' + String(hr).padStart(2, '0') + ':' + min;
}

/** Extract specialty names from specialties data */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSpecNames(specResult: any): string[] {
  const sd = Array.isArray(specResult) ? specResult : (specResult?.specialties || specResult?.data || []);
  return sd.map((i: { specialty?: string; name?: string }) => i.specialty || i.name || '').filter(Boolean);
}

/** Extract specialty array from data */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpecArray(specData: any): any[] {
  if (!specData) return [];
  return Array.isArray(specData) ? specData : (specData.specialties || specData.data || []);
}

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
 * Run the state machine for a single incoming message.
 */
export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const {
    messageBody,
    cleanPhone,
    tenantId,
    tenant,
  } = input;

  let { state, data, language } = input;
  const convoMessages = input.convoMessages;

  const hospitalName = tenant.hospital_name || 'Care Hospital';
  const botName = tenant.bot_name || 'Advera';
  const consultationFee = tenant.consultation_fee || 200;
  const tenantOpenAIKey = tenant.openai_api_key || process.env.OPENAI_API_KEY || '';
  const tenantOpenAIModel = tenant.openai_model || 'gpt-4o-mini';

  const lowerMsg = messageBody.toLowerCase().trim();
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

  // Tool executor shortcut
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exec = (name: string, args: Record<string, any>) => callTool(name, args, tenantId);

  let reply = '';
  let nextState: BotState = state;

  // ---- Language detection (always runs) ----
  {
    const lm = messageBody.toLowerCase().trim();
    const rawMsg = messageBody.trim();
    if (lm === 'english' || lm === '1' || lm === 'en' || lm === 'lang_en') { language = 'en'; }
    else if (lm === 'hindi' || lm === '2' || rawMsg === 'हिन्दी' || rawMsg === 'हिंदी' || lm === 'हिन्दी' || lm === 'हिंदी' || lm === 'lang_hi') { language = 'hi'; }
    else if (lm === 'telugu' || lm === '3' || lm === 'te' || rawMsg === 'తెలుగు' || lm === 'తెలుగు' || lm === 'lang_te') { language = 'te'; }
  }

  // ---- Global navigation checks ----
  const isMainMenuRequest = lowerMsg === 'menu' || lowerMsg === 'main menu' || lowerMsg === 'start over' || lowerMsg === 'restart';
  const isGoBack = lowerMsg === 'back' || lowerMsg === 'go back' || lowerMsg === 'previous';
  const isBookSelf = lowerMsg === 'book for self' || lowerMsg === 'book for yourself' || lowerMsg === 'booking_self' || lowerMsg === 'menu_book_self';
  const isBookOther = lowerMsg === 'book for someone else' || lowerMsg === 'book for other' || lowerMsg === 'booking_other' || lowerMsg === 'menu_book_other';
  const isCancel = lowerMsg === 'cancel appointment' || lowerMsg === 'cancel' || lowerMsg === 'cancel booking' || lowerMsg === 'menu_cancel';
  const isReschedule = lowerMsg === 'reschedule' || lowerMsg === 'reschedule appointment' || lowerMsg === 'menu_reschedule';
  const isViewAppts = lowerMsg === 'view appointments' || lowerMsg === 'my appointments' || lowerMsg === 'menu_view_appts';

  // Go Back
  if (isGoBack && state !== 'IDLE' && state !== 'LANG_SELECT' && state !== 'MAIN_MENU') {
    const backMap: Record<string, BotState> = {
      'BOOKING_DOCTOR': 'SELF_LOOKUP',
      'BOOKING_DATE': (data.matchedDoctors && data.matchedDoctors.length > 1) ? 'BOOKING_SPECIALTY' : 'SELF_LOOKUP',
      'BOOKING_PERIOD': 'BOOKING_DATE',
      'BOOKING_SLOT': 'BOOKING_PERIOD',
      'BOOKING_CONFIRM': 'BOOKING_SLOT',
      'CANCEL_SELECT': 'MAIN_MENU_SHOW',
      'CANCEL_CONFIRM': 'CANCEL_LIST',
      'RESCHED_SELECT': 'MAIN_MENU_SHOW',
      'RESCHED_CONFIRM_OLD': 'RESCHED_LIST',
      'RESCHED_DOCTOR': 'RESCHED_SPECIALTY',
      'RESCHED_SPECIALTY': 'MAIN_MENU_SHOW',
      'RESCHED_DATE': 'RESCHED_SPECIALTY',
      'RESCHED_PERIOD': 'RESCHED_DATE',
      'RESCHED_SLOT': 'RESCHED_PERIOD',
      'RESCHED_CONFIRM_NEW': 'RESCHED_SLOT',
      'HAS_MOBILE': 'OTHER_LOOKUP',
      'COLLECT_PHONE': 'HAS_MOBILE',
      'RELATIONSHIP': 'HAS_MOBILE',
    };
    const prevState = backMap[state] || 'MAIN_MENU_SHOW';
    state = prevState;
    data._state = prevState;
  }

  // Global navigation overrides
  if (isMainMenuRequest && state !== 'IDLE' && state !== 'LANG_SELECT') {
    state = 'MAIN_MENU_SHOW';
    data = { _state: 'MAIN_MENU_SHOW' };
  }
  if (isBookSelf) {
    state = 'SELF_LOOKUP';
    data = { _state: 'SELF_LOOKUP', bookingType: 'self' };
  }
  if (isBookOther) {
    state = 'OTHER_LOOKUP';
    data = { _state: 'OTHER_LOOKUP', bookingType: 'someone_else' };
  }
  if (isCancel) {
    state = 'CANCEL_LIST';
    data = { _state: 'CANCEL_LIST', flowType: 'cancel' };
  }
  if (isReschedule) {
    state = 'RESCHED_LIST';
    data = { _state: 'RESCHED_LIST', flowType: 'reschedule' };
  }
  if (isViewAppts) {
    state = 'VIEW_APPOINTMENTS';
    data = { _state: 'VIEW_APPOINTMENTS' };
  }

  // ===== STATE HANDLERS =====

  switch (state) {

    // ----- IDLE / NEW USER -----
    case 'IDLE': {
      reply = msg('welcome', language, { hospital: hospitalName, bot: botName });
      nextState = 'LANG_SELECT';
      break;
    }

    case 'LANG_SELECT': {
      if (language) {
        reply = msg('lang_success', language);
        nextState = 'MAIN_MENU';
      } else {
        reply = msg('lang_retry', language);
        nextState = 'LANG_SELECT';
      }
      break;
    }

    case 'MAIN_MENU_SHOW':
    case 'MAIN_MENU': {
      reply = msg('main_menu', language);
      nextState = 'MAIN_MENU';
      break;
    }

    // ----- SELF BOOKING: LOOKUP -----
    case 'SELF_LOOKUP': {
      const result = await exec('lookup_patient', { phone: cleanPhone });
      if (result && !result.error && result.name) {
        data.patientName = result.name;
        data.patientEmail = result.email || '';
        data.patientPhone = cleanPhone;
        const specResult = await exec('list_specialties', {});
        data.specialtiesData = specResult;
        const names = extractSpecNames(specResult);
        reply = msg('welcome_back', language, { name: data.patientName || '', specs: names.join('|') });
        nextState = 'BOOKING_SPECIALTY';
      } else {
        reply = msg('new_user_reg', language);
        nextState = 'AWAITING_REGISTRATION';
      }
      break;
    }

    case 'AWAITING_REGISTRATION': {
      if (messageBody.startsWith('REGISTRATION_DATA:')) {
        const regData = messageBody.substring('REGISTRATION_DATA:'.length).trim();
        const nameMatch = regData.match(/Name:\s*([^,]+)/i);
        const ageMatch = regData.match(/Age:\s*(\d+)/i);
        const emailMatch = regData.match(/Email:\s*([^,]+)/i);
        const addressMatch = regData.match(/Address:\s*(.+)/i);

        const regName = nameMatch ? nameMatch[1].trim() : 'Patient';
        const regAge = ageMatch ? parseInt(ageMatch[1], 10) : null;
        const regEmail = emailMatch ? emailMatch[1].trim() : '';
        const regAddress = addressMatch ? addressMatch[1].trim() : '';

        await exec('save_patient', { phone: cleanPhone, name: regName, age: regAge, email: regEmail, address: regAddress });
        data.patientName = regName;
        data.patientEmail = regEmail;
        data.patientPhone = cleanPhone;

        const specResult = await exec('list_specialties', {});
        data.specialtiesData = specResult;
        const names = extractSpecNames(specResult);
        reply = 'Thank you, *' + regName + '*! Your registration is complete.\n\nYou\'re all set. Please select the department you\'d like to book an appointment with:\n[BUTTONS:specialty:' + names.join('|') + ']';
        nextState = 'BOOKING_SPECIALTY';
      } else {
        reply = msg('reg_retry', language);
        nextState = 'AWAITING_REGISTRATION';
      }
      break;
    }

    // ----- SOMEONE ELSE BOOKING: LOOKUP -----
    case 'OTHER_LOOKUP': {
      const result = await exec('lookup_patient', { phone: cleanPhone });
      if (result && !result.error && result.name) {
        data.callerName = result.name;
        data.callerPhone = cleanPhone;
        data.patientEmail = result.email || '';
        reply = msg('other_found', language, { name: result.name });
        nextState = 'AWAITING_DEPENDENT';
      } else {
        data.afterRegGoto = 'SHOW_DEPENDENT_FORM';
        reply = msg('other_reg_first', language);
        nextState = 'AWAITING_CALLER_REG';
      }
      break;
    }

    case 'AWAITING_CALLER_REG': {
      if (messageBody.startsWith('REGISTRATION_DATA:')) {
        const regData = messageBody.substring('REGISTRATION_DATA:'.length).trim();
        const nameMatch = regData.match(/Name:\s*([^,]+)/i);
        const ageMatch = regData.match(/Age:\s*(\d+)/i);
        const emailMatch = regData.match(/Email:\s*([^,]+)/i);
        const addressMatch = regData.match(/Address:\s*(.+)/i);

        await exec('save_patient', {
          phone: cleanPhone,
          name: nameMatch ? nameMatch[1].trim() : 'Patient',
          age: ageMatch ? parseInt(ageMatch[1], 10) : null,
          email: emailMatch ? emailMatch[1].trim() : '',
          address: addressMatch ? addressMatch[1].trim() : '',
        });
        data.callerName = nameMatch ? nameMatch[1].trim() : 'Patient';
        data.callerPhone = cleanPhone;

        reply = msg('caller_reg_done', language);
        nextState = 'AWAITING_DEPENDENT';
      } else {
        reply = msg('reg_retry', language);
        nextState = 'AWAITING_CALLER_REG';
      }
      break;
    }

    case 'AWAITING_DEPENDENT': {
      if (messageBody.startsWith('DEPENDENT_DATA:')) {
        const depData = messageBody.substring('DEPENDENT_DATA:'.length).trim();
        const nameMatch = depData.match(/Name:\s*([^,]+)/i);
        const ageMatch = depData.match(/Age:\s*(\d+)/i);
        const addressMatch = depData.match(/Address:\s*([^,]+)/i);
        const reasonMatch = depData.match(/Reason:\s*(.+)/i);

        data.someoneElse = {
          name: nameMatch ? nameMatch[1].trim() : '',
          age: ageMatch ? parseInt(ageMatch[1], 10) : null,
          address: addressMatch ? addressMatch[1].trim() : '',
          reason: reasonMatch ? reasonMatch[1].trim() : '',
        };

        reply = msg('dep_details_done', language);
        nextState = 'HAS_MOBILE';
      } else {
        reply = msg('dep_retry', language);
        nextState = 'AWAITING_DEPENDENT';
      }
      break;
    }

    case 'HAS_MOBILE': {
      const lb = lowerMsg;
      if (lb === 'yes' || lb === 'yes, they do' || lb === 'hasmobile_yes' || lb === 'हाँ' || lb === 'అవును') {
        reply = msg('enter_phone', language);
        nextState = 'COLLECT_PHONE';
      } else if (lb === 'no' || lb === 'no, use mine' || lb === 'hasmobile_no' || lb === 'नहीं' || lb === 'కాదు') {
        data.patientPhone = cleanPhone;
        data.noPatientPhone = true;
        reply = msg('use_my_phone', language);
        nextState = 'RELATIONSHIP';
      } else {
        reply = 'Please let us know — does the patient have their own mobile number?\n[BUTTONS:hasmobile]';
        nextState = 'HAS_MOBILE';
      }
      break;
    }

    case 'COLLECT_PHONE': {
      const phoneDigits = messageBody.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        let patientPhone = phoneDigits;
        if (patientPhone.length === 10) patientPhone = '91' + patientPhone;
        data.patientPhone = patientPhone;
        reply = msg('phone_saved', language);
        nextState = 'RELATIONSHIP';
      } else {
        reply = msg('phone_invalid', language);
        nextState = 'COLLECT_PHONE';
      }
      break;
    }

    case 'RELATIONSHIP': {
      const VALID_RELS = ['SELF', 'PARENT', 'SPOUSE', 'CHILD', 'FRIEND', 'OTHER'];
      const upperMsg = lowerMsg.toUpperCase();
      const matchedRel = VALID_RELS.find(r => upperMsg.includes(r));

      if (matchedRel) {
        data.relationship = matchedRel;
        const se = data.someoneElse || { name: '', age: null, address: '', reason: '' };

        // Save patient (dependent)
        await exec('save_patient', {
          phone: data.patientPhone || cleanPhone,
          name: se.name || 'Patient',
          age: se.age || null,
          address: se.address || '',
        });
        data.patientName = se.name;

        // Save dependent record
        const depId = await saveDependentRecord({
          linked_phone: cleanPhone,
          name: se.name || 'Patient',
          age: se.age || null,
          address: se.address || null,
          reason: se.reason || null,
          tenant_id: tenantId,
        });
        if (depId) data.dependentId = depId;

        const specResult = await exec('list_specialties', {});
        data.specialtiesData = specResult;
        const names = extractSpecNames(specResult);
        reply = 'The patient has been registered successfully.\n\nNow let\'s book the appointment. Please select the department:\n[BUTTONS:specialty:' + names.join('|') + ']';
        nextState = 'BOOKING_SPECIALTY';
      } else {
        reply = msg('rel_retry', language);
        nextState = 'RELATIONSHIP';
      }
      break;
    }

    // ----- BOOKING FLOW (shared for self + someone else) -----
    case 'BOOKING_SPECIALTY': {
      const sd = getSpecArray(data.specialtiesData);
      let matched = false;
      // Normalize button ID: "spec_general_medicine" → "general medicine"
      const normalizedMsg = lowerMsg.replace(/^spec_/, '').replace(/_/g, ' ');
      for (const s of sd) {
        const sName = (s.specialty || s.name || '').toLowerCase();
        if (sName && (normalizedMsg.includes(sName) || lowerMsg.includes(sName))) {
          data.specialty = s.specialty || s.name;
          data.matchedDoctors = s.doctors || [];
          matched = true;
          break;
        }
      }

      if (matched && data.matchedDoctors && data.matchedDoctors.length > 0) {
        if (data.matchedDoctors.length === 1) {
          data.doctor_id = data.matchedDoctors[0].doctor_id;
          data.doctor_name = data.matchedDoctors[0].name;
          const avail = await exec('check_availability_7days', {
            doctor_id: data.doctor_id,
            patient_phone: data.patientPhone || cleanPhone,
          });
          data.availabilityData = avail;

          if (avail && avail.available_dates && avail.available_dates.length > 0) {
            const entries = avail.available_dates
              .filter((d: { available_count: number }) => d.available_count > 0)
              .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
            reply = 'Dr. *' + drName(data.doctor_name!) + '* is available on the following dates. Please select your preferred date:\n[BUTTONS:dates:' + entries.join('|') + ']';
            nextState = 'BOOKING_DATE';
          } else {
            reply = 'Unfortunately, Dr. *' + drName(data.doctor_name!) + '* has no available slots in the next 7 days.\n\nWould you like to try a different department?\n[BUTTONS:mainmenu]';
            nextState = 'MAIN_MENU';
          }
        } else {
          const docNames = data.matchedDoctors.map((d: { name?: string }) => (d.name || '') + ' (' + (data.specialty || '') + ')');
          reply = 'Multiple doctors are available in *' + (data.specialty || '') + '*. Please select your preferred doctor:\n[BUTTONS:doctor:' + docNames.join('|') + ']';
          nextState = 'BOOKING_DOCTOR';
        }
      } else {
        const names = extractSpecNames(data.specialtiesData);
        reply = 'I couldn\'t match that selection. Please choose a department from the options below:\n[BUTTONS:specialty:' + names.join('|') + ']';
        nextState = 'BOOKING_SPECIALTY';
      }
      break;
    }

    case 'BOOKING_DOCTOR': {
      const docs = data.matchedDoctors || [];
      let matched = false;
      // Match by index-based button ID (doc_1, doc_2) or by name
      const docIdxMatch = lowerMsg.match(/^doc_(\d+)$/);
      if (docIdxMatch) {
        const idx = parseInt(docIdxMatch[1], 10) - 1;
        if (idx >= 0 && idx < docs.length) {
          data.doctor_id = docs[idx].doctor_id;
          data.doctor_name = docs[idx].name;
          matched = true;
        }
      }
      if (!matched) {
        for (const d of docs) {
          if (lowerMsg.includes((d.name || '').toLowerCase().replace(/^dr\.?\s*/i, ''))) {
            data.doctor_id = d.doctor_id;
            data.doctor_name = d.name;
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        const avail = await exec('check_availability_7days', {
          doctor_id: data.doctor_id,
          patient_phone: data.patientPhone || cleanPhone,
        });
        data.availabilityData = avail;

        if (avail && avail.available_dates && avail.available_dates.length > 0) {
          const entries = avail.available_dates
            .filter((d: { available_count: number }) => d.available_count > 0)
            .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
          reply = 'Dr. *' + drName(data.doctor_name!) + '* is available on the following dates. Please select your preferred date:\n[BUTTONS:dates:' + entries.join('|') + ']';
          nextState = 'BOOKING_DATE';
        } else {
          reply = 'Unfortunately, Dr. *' + drName(data.doctor_name!) + '* has no available slots in the next 7 days.\n\nWould you like to try a different department?\n[BUTTONS:mainmenu]';
          nextState = 'MAIN_MENU';
        }
      } else {
        const docNames = docs.map((d: { name?: string }) => (d.name || '') + ' (' + (data.specialty || '') + ')');
        reply = 'I couldn\'t match that doctor. Please select from the list:\n[BUTTONS:doctor:' + docNames.join('|') + ']';
        nextState = 'BOOKING_DOCTOR';
      }
      break;
    }

    case 'BOOKING_DATE': {
      const avail = data.availabilityData;
      let matched = false;
      // Match by index-based button ID (date_1, date_2) or by date text
      const dateIdxMatch = lowerMsg.match(/^date_(\d+)$/);
      if (dateIdxMatch && avail && avail.available_dates) {
        const idx = parseInt(dateIdxMatch[1], 10) - 1;
        const availDates = avail.available_dates.filter((d: { available_count: number }) => d.available_count > 0);
        if (idx >= 0 && idx < availDates.length) {
          data.selectedDate = availDates[idx].date;
          matched = true;
        }
      }
      if (!matched && avail && avail.available_dates) {
        for (const d of avail.available_dates) {
          if (lowerMsg.includes((d.date || '').toLowerCase())) {
            data.selectedDate = d.date;
            matched = true;
            break;
          }
        }
      }

      if (matched && avail && avail.slots_by_date) {
        const dateData = avail.slots_by_date[data.selectedDate!];
        if (dateData) {
          const ps: string[] = [];
          const mc = dateData.morning_count || (Array.isArray(dateData.morning) ? dateData.morning.length : 0);
          const ac = dateData.afternoon_count || (Array.isArray(dateData.afternoon) ? dateData.afternoon.length : 0);
          const ec = dateData.evening_count || (Array.isArray(dateData.evening) ? dateData.evening.length : 0);
          if (mc > 0) ps.push('Morning (' + mc + ')');
          if (ac > 0) ps.push('Afternoon (' + ac + ')');
          if (ec > 0) ps.push('Evening (' + ec + ')');

          if (ps.length) {
            reply = 'Great choice! For *' + data.selectedDate + '*, please select your preferred time period:\n[BUTTONS:timeperiod:' + ps.join('|') + ']';
            nextState = 'BOOKING_PERIOD';
          } else {
            reply = 'Sorry, all slots for *' + data.selectedDate + '* are fully booked. Please choose a different date.';
            nextState = 'BOOKING_DATE';
          }
        }
      }

      if (!matched) {
        if (avail && avail.available_dates) {
          const entries = avail.available_dates
            .filter((d: { available_count: number }) => d.available_count > 0)
            .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
          reply = 'I couldn\'t match that date. Please select from the available dates below:\n[BUTTONS:dates:' + entries.join('|') + ']';
        }
        nextState = 'BOOKING_DATE';
      }
      break;
    }

    case 'BOOKING_PERIOD': {
      let period: string | null = null;
      if (lowerMsg.includes('morning')) period = 'morning';
      else if (lowerMsg.includes('afternoon')) period = 'afternoon';
      else if (lowerMsg.includes('evening')) period = 'evening';

      if (period) {
        data.selectedPeriod = period;
        const avail = data.availabilityData;
        const dateData = avail && avail.slots_by_date && avail.slots_by_date[data.selectedDate!];

        if (dateData && Array.isArray(dateData[period])) {
          const slots = dateData[period];
          const fs = slots.map((s: { time: string; capacity?: number }) => s.time + ' (' + (s.capacity || 1) + ')');
          reply = 'Here are the available ' + period + ' slots. Please select your preferred time:\n[BUTTONS:timeslots:' + fs.join('|') + ']';
          nextState = 'BOOKING_SLOT';
        } else {
          reply = 'Sorry, no ' + period + ' slots are available. Please choose a different time period.';
          nextState = 'BOOKING_PERIOD';
        }
      } else {
        const avail = data.availabilityData;
        const dateData = avail && avail.slots_by_date && avail.slots_by_date[data.selectedDate!];
        if (dateData) {
          const ps: string[] = [];
          const mc = dateData.morning_count || (Array.isArray(dateData.morning) ? dateData.morning.length : 0);
          const ac = dateData.afternoon_count || (Array.isArray(dateData.afternoon) ? dateData.afternoon.length : 0);
          const ec = dateData.evening_count || (Array.isArray(dateData.evening) ? dateData.evening.length : 0);
          if (mc > 0) ps.push('Morning (' + mc + ')');
          if (ac > 0) ps.push('Afternoon (' + ac + ')');
          if (ec > 0) ps.push('Evening (' + ec + ')');
          reply = 'Please select a time period from the options below:\n[BUTTONS:timeperiod:' + ps.join('|') + ']';
        }
        nextState = 'BOOKING_PERIOD';
      }
      break;
    }

    case 'BOOKING_SLOT': {
      let timeMatch = messageBody.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

      // Match by index-based button ID (slot_1, slot_2)
      if (!timeMatch) {
        const slotIdxMatch = lowerMsg.match(/^slot_(\d+)$/);
        if (slotIdxMatch) {
          const idx = parseInt(slotIdxMatch[1], 10) - 1;
          const period = data.selectedPeriod || 'morning';
          const dateData = data.availabilityData?.slots_by_date?.[data.selectedDate!];
          const slots = dateData?.[period];
          if (Array.isArray(slots) && idx >= 0 && idx < slots.length) {
            data.selectedTime = slots[idx].time;
            timeMatch = [slots[idx].time, slots[idx].time] as unknown as RegExpMatchArray;
          }
        }
      }

      if (timeMatch) {
        if (!data.selectedTime) data.selectedTime = timeMatch[1].trim();
        const patientName = data.patientName || (data.someoneElse && data.someoneElse.name) || 'Patient';
        const patientAge = (data.someoneElse && data.someoneElse.age) || data.patientAge || '';

        reply = 'Please review your appointment details:\n\n' +
          '*Patient:* ' + patientName + '\n' +
          (patientAge ? '*Age:* ' + patientAge + '\n' : '') +
          '*Doctor:* Dr. ' + drName(data.doctor_name || '') + '\n' +
          '*Department:* ' + (data.specialty || '') + '\n' +
          '*Date:* ' + (data.selectedDate || '') + '\n' +
          '*Time:* ' + data.selectedTime + '\n\n' +
          'Would you like to confirm this appointment?\n[BUTTONS:yesno]';
        nextState = 'BOOKING_CONFIRM';
      } else {
        reply = msg('slot_retry', language);
        nextState = 'BOOKING_SLOT';
      }
      break;
    }

    case 'BOOKING_CONFIRM': {
      if (lowerMsg === 'yes' || lowerMsg === 'confirm_yes' || lowerMsg === 'हाँ' || lowerMsg === 'అవును') {
        const patientPhone = data.patientPhone || cleanPhone;
        const patientName = data.patientName || (data.someoneElse && data.someoneElse.name) || 'Patient';
        const patientAge = (data.someoneElse && data.someoneElse.age) || null;
        const startTime = formatStartTime(data.selectedDate || '', data.selectedTime || '');

        // Auto-register patient for someone_else
        if (data.bookingType === 'someone_else' && data.someoneElse) {
          try {
            await exec('save_patient', {
              phone: patientPhone,
              name: data.someoneElse.name || patientName,
              age: data.someoneElse.age || null,
              address: data.someoneElse.address || '',
            });
          } catch { /* non-critical */ }
        }

        const bookArgs = {
          phone: patientPhone,
          name: patientName,
          age: patientAge,
          email: data.patientEmail || '',
          start_time: startTime,
          doctor_id: data.doctor_id,
          doctor_name: data.doctor_name || '',
          specialty: data.specialty || '',
          booked_by_whatsapp_number: cleanPhone,
          relationship_to_patient: data.bookingType === 'someone_else' ? (data.relationship || 'OTHER') : 'SELF',
          patient_type: data.bookingType === 'someone_else' ? 'DEPENDENT' : 'SELF',
          dependent_id: data.dependentId || null,
        };

        const result = await exec('book_appointment', bookArgs);

        if (result && !result.error && result.success) {
          const payLink = result.payment_link || result.short_url || '';
          if (payLink) {
            data.lastPaymentLink = payLink;
            reply = 'Your appointment has been reserved successfully!\n\n' +
              '*Booking ID:* ' + (result.booking_id || '') + '\n' +
              '*Patient:* ' + (result.patient_name || patientName) + '\n' +
              '*Doctor:* Dr. ' + drName(result.doctor_name || data.doctor_name || '') + '\n' +
              '*Department:* ' + (result.specialty || data.specialty) + '\n' +
              '*Date:* ' + (result.date || data.selectedDate) + '\n' +
              '*Time:* ' + (result.time || data.selectedTime) + '\n' +
              '*Consultation Fee:* Rs ' + (result.consultation_fee || consultationFee) + '\n\n' +
              'To confirm your booking, please complete the payment using the link below:\n[PAYLINK:' + payLink + ']';
            nextState = 'AWAITING_PAYMENT';
          } else {
            reply = 'Your appointment has been confirmed!\n\n' +
              '*Booking ID:* ' + (result.booking_id || '') + '\n' +
              '*Patient:* ' + patientName + '\n' +
              '*Doctor:* Dr. ' + drName(data.doctor_name || '') + '\n' +
              '*Date:* ' + data.selectedDate + '\n' +
              '*Time:* ' + data.selectedTime + '\n\n' +
              'We look forward to seeing you. Is there anything else I can help you with?\n[BUTTONS:mainmenu]';
            nextState = 'MAIN_MENU';
          }
        } else {
          const errMsg = (result && result.error) || 'Unknown error';
          reply = 'We apologize, but the booking could not be completed.\n\n*Reason:* ' + errMsg + '\n\nWould you like to try again?\n[BUTTONS:mainmenu]';
          nextState = 'MAIN_MENU';
        }
      } else if (lowerMsg === 'no' || lowerMsg === 'confirm_no' || lowerMsg === 'नहीं' || lowerMsg === 'కాదు') {
        reply = msg('booking_cancelled_by_user', language);
        nextState = 'MAIN_MENU';
        data = {};
      } else {
        reply = msg('confirm_yesno_retry', language);
        nextState = 'BOOKING_CONFIRM';
      }
      break;
    }

    case 'AWAITING_PAYMENT': {
      if (lowerMsg.includes('pay') || lowerMsg.includes('link') || lowerMsg.includes('payment')) {
        if (data.lastPaymentLink) {
          reply = 'Here is your payment link again:\n[PAYLINK:' + data.lastPaymentLink + ']';
          nextState = 'AWAITING_PAYMENT';
        } else {
          reply = 'Your appointment is reserved. Please scroll up to find the payment link, or start a new booking from the menu.\n\n[BUTTONS:mainmenu]';
          nextState = 'MAIN_MENU';
        }
      } else {
        reply = 'Your appointment is reserved and awaiting payment.\n\nType *pay* to get the payment link again, or select an option below:\n[BUTTONS:mainmenu]';
        nextState = 'MAIN_MENU';
      }
      break;
    }

    // ----- VIEW APPOINTMENTS -----
    case 'VIEW_APPOINTMENTS': {
      const result = await exec('list_appointments', { phone: cleanPhone });
      const ap = Array.isArray(result) ? result : (result.appointments || result.data || []);
      const active = ap.filter((a: { status: string }) => a.status === 'confirmed' || a.status === 'pending_payment');

      if (active.length > 0) {
        let apptList = 'Here are your upcoming appointments:\n\n';
        active.forEach((a: { doctor_name?: string; specialty?: string; date?: string; time?: string; booking_id?: string; status?: string }, i: number) => {
          apptList += '*' + (i + 1) + '.* ' + (a.doctor_name || '') + '\n';
          apptList += '   Department: ' + (a.specialty || '') + '\n';
          apptList += '   Date: ' + (a.date || '') + ' | Time: ' + (a.time || '') + '\n';
          apptList += '   Booking ID: ' + (a.booking_id || '') + '\n';
          apptList += '   Status: ' + (a.status || '') + '\n\n';
        });
        apptList += 'Need to make changes?\n[BUTTONS:mainmenu]';
        reply = apptList;
      } else {
        reply = msg('no_appointments', language);
      }
      nextState = 'MAIN_MENU';
      break;
    }

    // ----- CANCEL FLOW -----
    case 'CANCEL_LIST': {
      const result = await exec('list_appointments', { phone: cleanPhone });
      const ap = Array.isArray(result) ? result : (result.appointments || result.data || []);
      const active = ap.filter((a: { status: string }) => a.status === 'confirmed' || a.status === 'pending_payment');

      if (active.length > 0) {
        data.appointmentsData = active;
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const entries = active.map((a: { booking_id?: string; patient_name?: string; doctor_name?: string; date?: string }) => {
          const bid = a.booking_id || '';
          const pn = a.patient_name || 'Patient';
          const dn = a.doctor_name || '';
          const ds = a.date || '';
          try {
            const parts = ds.split('-');
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            return bid + '-' + pn + '-' + dn + '-' + day + M[monthIdx];
          } catch { return bid + '-' + pn + '-' + dn + '-' + ds; }
        });
        reply = 'Here are your upcoming appointments. Please select the one you\'d like to cancel:\n\n[BUTTONS:appointmentlist:' + entries.join('|') + ']';
        nextState = 'CANCEL_SELECT';
      } else {
        reply = msg('cancel_no_appts', language);
        nextState = 'MAIN_MENU';
      }
      break;
    }

    case 'CANCEL_SELECT': {
      const bkMatch = messageBody.match(/\b(BK\d{10,})\b/);
      if (bkMatch) {
        data.selectedBookingId = bkMatch[1];
        const appt = (data.appointmentsData || []).find((a: { booking_id: string }) => a.booking_id === bkMatch[1]);
        if (appt) {
          data.selectedAppt = appt;
          reply = 'You\'re about to cancel the following appointment:\n\n' +
            '*Booking ID:* ' + appt.booking_id + '\n' +
            '*Patient:* ' + (appt.patient_name || '') + '\n' +
            '*Doctor:* Dr. ' + drName(appt.doctor_name) + '\n' +
            '*Date:* ' + (appt.date || '') + '\n' +
            '*Time:* ' + (appt.time || '') + '\n\n' +
            'Are you sure you want to proceed with the cancellation?\n[BUTTONS:yesno]';
          nextState = 'CANCEL_CONFIRM';
        }
      }
      if (!data.selectedBookingId) {
        reply = msg('appt_not_found', language);
        nextState = 'CANCEL_SELECT';
      }
      break;
    }

    case 'CANCEL_CONFIRM': {
      if (lowerMsg === 'yes' || lowerMsg === 'confirm_yes' || lowerMsg === 'हाँ' || lowerMsg === 'అవును') {
        const result = await exec('cancel_appointment', {
          booking_id: data.selectedBookingId,
          sender_phone: cleanPhone,
        });
        if (result && !result.error) {
          reply = 'Your appointment (*' + data.selectedBookingId + '*) has been cancelled successfully.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]';
        } else {
          reply = 'We apologize, but the cancellation could not be processed.\n\n*Reason:* ' + ((result && result.error) || 'Unknown error') + '\n\nPlease try again or contact us directly.\n[BUTTONS:mainmenu]';
        }
        nextState = 'MAIN_MENU';
        data = {};
      } else if (lowerMsg === 'no' || lowerMsg === 'confirm_no' || lowerMsg === 'नहीं' || lowerMsg === 'కాదు') {
        reply = msg('cancel_declined', language);
        nextState = 'MAIN_MENU';
        data = {};
      } else {
        reply = msg('cancel_yesno_retry', language);
        nextState = 'CANCEL_CONFIRM';
      }
      break;
    }

    // ----- RESCHEDULE FLOW -----
    case 'RESCHED_LIST': {
      const result = await exec('list_appointments', { phone: cleanPhone });
      const ap = Array.isArray(result) ? result : (result.appointments || result.data || []);
      const active = ap.filter((a: { status: string }) => a.status === 'confirmed' || a.status === 'pending_payment');

      if (active.length > 0) {
        data.appointmentsData = active;
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const entries = active.map((a: { booking_id?: string; patient_name?: string; doctor_name?: string; date?: string }) => {
          const bid = a.booking_id || '';
          const pn = a.patient_name || 'Patient';
          const dn = a.doctor_name || '';
          const ds = a.date || '';
          try {
            const parts = ds.split('-');
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            return bid + '-' + pn + '-' + dn + '-' + day + M[monthIdx];
          } catch { return bid + '-' + pn + '-' + dn + '-' + ds; }
        });
        reply = 'Here are your upcoming appointments. Please select the one you\'d like to reschedule:\n\n[BUTTONS:appointmentlist:' + entries.join('|') + ']';
        nextState = 'RESCHED_SELECT';
      } else {
        reply = msg('resched_no_appts', language);
        nextState = 'MAIN_MENU';
      }
      break;
    }

    case 'RESCHED_SELECT': {
      const bkMatch = messageBody.match(/\b(BK\d{10,})\b/);
      if (bkMatch) {
        data.oldBookingId = bkMatch[1];
        const appt = (data.appointmentsData || []).find((a: { booking_id: string }) => a.booking_id === bkMatch[1]);
        if (appt) {
          data.oldAppt = appt;
          reply = 'You\'d like to reschedule the following appointment:\n\n' +
            '*Booking ID:* ' + appt.booking_id + '\n' +
            '*Patient:* ' + (appt.patient_name || '') + '\n' +
            '*Doctor:* Dr. ' + drName(appt.doctor_name) + '\n' +
            '*Date:* ' + (appt.date || '') + '\n' +
            '*Time:* ' + (appt.time || '') + '\n\n' +
            'The current appointment will be cancelled and a new one will be booked. Would you like to proceed?\n[BUTTONS:yesno]';
          nextState = 'RESCHED_CONFIRM_OLD';
        }
      }
      if (!data.oldBookingId) {
        reply = msg('appt_not_found', language);
        nextState = 'RESCHED_SELECT';
      }
      break;
    }

    case 'RESCHED_CONFIRM_OLD': {
      if (lowerMsg === 'yes' || lowerMsg === 'confirm_yes' || lowerMsg === 'हाँ' || lowerMsg === 'అవును') {
        const opResult = await exec('check_op_pass', { phone: cleanPhone });
        if (opResult && opResult.valid && opResult.reschedules_remaining > 0) {
          data.opPassValid = true;
          data.reschedulesRemaining = opResult.reschedules_remaining;

          const specResult = await exec('list_specialties', {});
          data.specialtiesData = specResult;
          const names = extractSpecNames(specResult);
          reply = 'Your OP Pass is valid with *' + data.reschedulesRemaining + ' reschedule(s) remaining*. No additional payment will be required.\n\nPlease select the department for your new appointment:\n[BUTTONS:specialty:' + names.join('|') + ']';
          nextState = 'RESCHED_SPECIALTY';
        } else {
          reply = 'We\'re sorry, but you don\'t have a valid OP Pass or you\'ve exhausted all reschedule attempts.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]';
          nextState = 'MAIN_MENU';
        }
      } else if (lowerMsg === 'no' || lowerMsg === 'confirm_no' || lowerMsg === 'नहीं' || lowerMsg === 'కాదు') {
        reply = msg('resched_declined', language);
        nextState = 'MAIN_MENU';
        data = {};
      } else {
        reply = msg('resched_yesno_retry', language);
        nextState = 'RESCHED_CONFIRM_OLD';
      }
      break;
    }

    case 'RESCHED_SPECIALTY': {
      const sd = getSpecArray(data.specialtiesData);
      let matched = false;
      const normalizedMsgRS = lowerMsg.replace(/^spec_/, '').replace(/_/g, ' ');
      for (const s of sd) {
        const sName = (s.specialty || s.name || '').toLowerCase();
        if (sName && (normalizedMsgRS.includes(sName) || lowerMsg.includes(sName))) {
          data.newSpecialty = s.specialty || s.name;
          data.matchedDoctorsResched = s.doctors || [];
          matched = true;
          break;
        }
      }

      if (matched && data.matchedDoctorsResched && data.matchedDoctorsResched.length > 0) {
        if (data.matchedDoctorsResched.length === 1) {
          data.newDoctorId = data.matchedDoctorsResched[0].doctor_id;
          data.newDoctorName = data.matchedDoctorsResched[0].name;
          const avail = await exec('check_availability_7days', {
            doctor_id: data.newDoctorId,
            patient_phone: data.patientPhone || cleanPhone,
          });
          data.availabilityData = avail;

          if (avail && avail.available_dates && avail.available_dates.length > 0) {
            const entries = avail.available_dates
              .filter((d: { available_count: number }) => d.available_count > 0)
              .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
            reply = 'Dr. *' + drName(data.newDoctorName!) + '* is available on the following dates. Please select your preferred date:\n[BUTTONS:dates:' + entries.join('|') + ']';
            nextState = 'RESCHED_DATE';
          } else {
            reply = 'Unfortunately, no slots are available for this doctor in the next 7 days. Would you like to try a different department?\n[BUTTONS:mainmenu]';
            nextState = 'MAIN_MENU';
          }
        } else {
          const docNames = data.matchedDoctorsResched.map((d: { name?: string }) => (d.name || '') + ' (' + (data.newSpecialty || '') + ')');
          reply = 'Multiple doctors available. Please select:\n[BUTTONS:doctor:' + docNames.join('|') + ']';
          nextState = 'RESCHED_DOCTOR';
        }
      } else {
        const names = extractSpecNames(data.specialtiesData);
        reply = 'I couldn\'t match that selection. Please choose a department from the options below:\n[BUTTONS:specialty:' + names.join('|') + ']';
        nextState = 'RESCHED_SPECIALTY';
      }
      break;
    }

    case 'RESCHED_DOCTOR': {
      const docs = data.matchedDoctorsResched || [];
      let matched = false;
      const rDocIdxMatch = lowerMsg.match(/^doc_(\d+)$/);
      if (rDocIdxMatch) {
        const idx = parseInt(rDocIdxMatch[1], 10) - 1;
        if (idx >= 0 && idx < docs.length) {
          data.newDoctorId = docs[idx].doctor_id;
          data.newDoctorName = docs[idx].name;
          matched = true;
        }
      }
      if (!matched) {
        for (const d of docs) {
          if (lowerMsg.includes((d.name || '').toLowerCase().replace(/^dr\.?\s*/i, ''))) {
            data.newDoctorId = d.doctor_id;
            data.newDoctorName = d.name;
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        const avail = await exec('check_availability_7days', {
          doctor_id: data.newDoctorId,
          patient_phone: data.patientPhone || cleanPhone,
        });
        data.availabilityData = avail;
        if (avail && avail.available_dates && avail.available_dates.length > 0) {
          const entries = avail.available_dates
            .filter((d: { available_count: number }) => d.available_count > 0)
            .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
          reply = 'Dr. *' + drName(data.newDoctorName!) + '* is available. Please select your preferred date:\n[BUTTONS:dates:' + entries.join('|') + ']';
          nextState = 'RESCHED_DATE';
        } else {
          reply = 'No slots available. Try a different department?\n[BUTTONS:mainmenu]';
          nextState = 'MAIN_MENU';
        }
      } else {
        const docNames = docs.map((d: { name?: string }) => (d.name || '') + ' (' + (data.newSpecialty || '') + ')');
        reply = 'Please select a doctor from the list:\n[BUTTONS:doctor:' + docNames.join('|') + ']';
        nextState = 'RESCHED_DOCTOR';
      }
      break;
    }

    case 'RESCHED_DATE': {
      const avail = data.availabilityData;
      let matched = false;
      const rDateIdxMatch = lowerMsg.match(/^date_(\d+)$/);
      if (rDateIdxMatch && avail && avail.available_dates) {
        const idx = parseInt(rDateIdxMatch[1], 10) - 1;
        const availDates = avail.available_dates.filter((d: { available_count: number }) => d.available_count > 0);
        if (idx >= 0 && idx < availDates.length) {
          data.newSelectedDate = availDates[idx].date;
          matched = true;
        }
      }
      if (!matched && avail && avail.available_dates) {
        for (const d of avail.available_dates) {
          if (lowerMsg.includes((d.date || '').toLowerCase())) {
            data.newSelectedDate = d.date;
            matched = true;
            break;
          }
        }
      }
      if (matched && avail && avail.slots_by_date) {
        const dateData = avail.slots_by_date[data.newSelectedDate!];
        if (dateData) {
          const ps: string[] = [];
          const mc = Array.isArray(dateData.morning) ? dateData.morning.length : (dateData.morning_count || 0);
          const ac = Array.isArray(dateData.afternoon) ? dateData.afternoon.length : (dateData.afternoon_count || 0);
          const ec = Array.isArray(dateData.evening) ? dateData.evening.length : (dateData.evening_count || 0);
          if (mc > 0) ps.push('Morning (' + mc + ')');
          if (ac > 0) ps.push('Afternoon (' + ac + ')');
          if (ec > 0) ps.push('Evening (' + ec + ')');
          reply = 'For *' + data.newSelectedDate + '*, please select your preferred time period:\n[BUTTONS:timeperiod:' + ps.join('|') + ']';
          nextState = 'RESCHED_PERIOD';
        }
      }
      if (!matched) {
        const entries = (avail?.available_dates || [])
          .filter((d: { available_count: number }) => d.available_count > 0)
          .map((d: { date: string; available_count: number }) => d.date + ' (' + d.available_count + ')');
        reply = 'I couldn\'t match that date. Please select from the available dates below:\n[BUTTONS:dates:' + entries.join('|') + ']';
        nextState = 'RESCHED_DATE';
      }
      break;
    }

    case 'RESCHED_PERIOD': {
      let period: string | null = null;
      if (lowerMsg.includes('morning')) period = 'morning';
      else if (lowerMsg.includes('afternoon')) period = 'afternoon';
      else if (lowerMsg.includes('evening')) period = 'evening';

      if (period) {
        data.newSelectedPeriod = period;
        const dateData = data.availabilityData && data.availabilityData.slots_by_date && data.availabilityData.slots_by_date[data.newSelectedDate!];
        if (dateData && Array.isArray(dateData[period])) {
          const slots = dateData[period];
          const fs = slots.map((s: { time: string; capacity?: number }) => s.time + ' (' + (s.capacity || 1) + ')');
          reply = 'Here are the available ' + period + ' slots. Please select your preferred time:\n[BUTTONS:timeslots:' + fs.join('|') + ']';
          nextState = 'RESCHED_SLOT';
        }
      }
      if (!period) {
        reply = 'Please select a time period from the options: Morning, Afternoon, or Evening.';
        nextState = 'RESCHED_PERIOD';
      }
      break;
    }

    case 'RESCHED_SLOT': {
      let rTimeMatch = messageBody.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      // Match by index-based button ID (slot_1, slot_2)
      if (!rTimeMatch) {
        const rSlotIdxMatch = lowerMsg.match(/^slot_(\d+)$/);
        if (rSlotIdxMatch) {
          const idx = parseInt(rSlotIdxMatch[1], 10) - 1;
          const period = data.newSelectedPeriod || 'morning';
          const dateData = data.availabilityData?.slots_by_date?.[data.newSelectedDate!];
          const slots = dateData?.[period];
          if (Array.isArray(slots) && idx >= 0 && idx < slots.length) {
            data.newSelectedTime = slots[idx].time;
            rTimeMatch = [slots[idx].time, slots[idx].time] as unknown as RegExpMatchArray;
          }
        }
      }
      if (rTimeMatch) {
        if (!data.newSelectedTime) data.newSelectedTime = rTimeMatch[1].trim();
        const patientName = (data.oldAppt && data.oldAppt.patient_name) || data.patientName || 'Patient';
        reply = 'Please review your new appointment details:\n\n' +
          '*Patient:* ' + patientName + '\n' +
          '*Doctor:* Dr. ' + drName(data.newDoctorName || '') + '\n' +
          '*Department:* ' + (data.newSpecialty || '') + '\n' +
          '*New Date:* ' + (data.newSelectedDate || '') + '\n' +
          '*New Time:* ' + data.newSelectedTime + '\n\n' +
          'Would you like to confirm this reschedule?\n[BUTTONS:yesno]';
        nextState = 'RESCHED_CONFIRM_NEW';
      } else {
        reply = msg('slot_retry', language);
        nextState = 'RESCHED_SLOT';
      }
      break;
    }

    case 'RESCHED_CONFIRM_NEW': {
      if (lowerMsg === 'yes' || lowerMsg === 'confirm_yes' || lowerMsg === 'हाँ' || lowerMsg === 'అవును') {
        const newDateParts = (data.newSelectedDate || '').split(/\s+/);
        const months: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
        };
        const newDate = (newDateParts[2] || '2026') + '-' + (months[newDateParts[1]] || '01') + '-' + (newDateParts[0] || '01').padStart(2, '0');

        const tm = (data.newSelectedTime || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
        let hr = tm ? parseInt(tm[1], 10) : 10;
        if (tm && tm[3].toUpperCase() === 'PM' && hr < 12) hr += 12;
        if (tm && tm[3].toUpperCase() === 'AM' && hr === 12) hr = 0;
        const newTime = String(hr).padStart(2, '0') + ':' + (tm ? tm[2] : '00');

        const result = await exec('reschedule_appointment', {
          old_booking_id: data.oldBookingId,
          phone: data.patientPhone || cleanPhone,
          sender_phone: cleanPhone,
          new_doctor_id: data.newDoctorId,
          new_date: newDate,
          new_time: newTime,
          new_doctor_name: data.newDoctorName || '',
          new_specialty: data.newSpecialty || '',
          exclude_appointment_id: data.oldBookingId,
        });

        if (result && !result.error) {
          reply = 'Your appointment has been rescheduled successfully!\n\n' +
            '*New Date:* ' + data.newSelectedDate + '\n' +
            '*New Time:* ' + data.newSelectedTime + '\n' +
            '*Doctor:* Dr. ' + drName(data.newDoctorName || '') + '\n\n' +
            'We look forward to seeing you. Is there anything else I can help you with?\n[BUTTONS:mainmenu]';
        } else {
          reply = 'We apologize, but the reschedule could not be completed.\n\n*Reason:* ' + ((result && result.error) || 'Unknown error') + '\n\nPlease try again or contact us directly.\n[BUTTONS:mainmenu]';
        }
        nextState = 'MAIN_MENU';
        data = {};
      } else if (lowerMsg === 'no' || lowerMsg === 'confirm_no' || lowerMsg === 'नहीं' || lowerMsg === 'కాదు') {
        reply = msg('resched_new_declined', language);
        nextState = 'MAIN_MENU';
        data = {};
      } else {
        reply = msg('resched_new_yesno_retry', language);
        nextState = 'RESCHED_CONFIRM_NEW';
      }
      break;
    }

    // ----- FALLBACK: GPT INTENT DETECTION -----
    default: {
      try {
        const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + tenantOpenAIKey,
          },
          body: JSON.stringify({
            model: tenantOpenAIModel,
            messages: [
              {
                role: 'system',
                content: 'You are ' + botName + ', the professional digital health assistant for ' + hospitalName + '. You communicate in a warm, courteous, and professional manner. The user sent a message that doesn\'t match any button flow. Classify their intent as one of: BOOK_SELF, BOOK_OTHER, CANCEL, RESCHEDULE, GREETING, QUESTION, UNKNOWN. If it\'s a greeting, welcome them warmly and show the main menu. If it\'s a question, answer briefly and helpfully. Always end with [BUTTONS:mainmenu] if appropriate. Keep responses concise and professional. Today: ' + todayStr + '. Language: ' + (language || 'en'),
              },
              ...convoMessages.slice(-6),
              { role: 'user', content: messageBody },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (gptResp.ok) {
          const gptJson = await gptResp.json();
          const gptReply = gptJson?.choices?.[0]?.message?.content || '';

          if (gptReply.includes('BOOK_SELF') || gptReply.toLowerCase().includes('book for self')) {
            reply = 'I\'d be happy to help you with that! Please select an option below:\n[BUTTONS:mainmenu]';
          } else {
            reply = gptReply || 'I\'m sorry, I didn\'t quite understand that. Please select an option below and I\'ll be happy to assist you:\n[BUTTONS:mainmenu]';
          }
        } else {
          reply = msg('fallback_error', language);
        }
        nextState = 'MAIN_MENU';
      } catch {
        reply = msg('fallback_error', language);
        nextState = 'MAIN_MENU';
      }
      break;
    }
  } // end switch

  // Session expiry warning
  if (data._sessionWarning && reply) {
    reply = msg('session_warning', language) + reply;
    delete data._sessionWarning;
  }

  // Ensure we have a reply
  if (!reply) {
    reply = msg('fallback', language);
    nextState = 'MAIN_MENU';
  }

  return { reply, nextState, data, language };
}
