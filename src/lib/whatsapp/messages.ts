/**
 * WhatsApp Message Builders
 * Build interactive WhatsApp Cloud API payloads:
 * buttons, lists, CTA URLs, Flow messages, text messages
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
function buildListMessage(toPhone: string, text: string, buttonLabel: string, sectionTitle: string, rows: { id: string; title: string; description?: string }[]): any {
  const cappedRows = rows.slice(0, 10).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = { id: truncate(row.id, 200), title: truncate(row.title, 24) };
    if (row.description) item.description = truncate(row.description, 72);
    return item;
  });
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'interactive',
    interactive: {
      type: 'list', body: { text },
      action: { button: truncate(buttonLabel, 20), sections: [{ title: truncate(sectionTitle, 24), rows: cappedRows }] },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCtaUrl(toPhone: string, text: string, displayText: string, url: string): any {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
    type: 'interactive',
    interactive: { type: 'cta_url', body: { text }, action: { name: 'cta_url', parameters: { display_text: truncate(displayText, 20), url } } },
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
 * Parse the AI reply string (with markers like [BUTTONS:...], [FLOW:...], [PAYLINK:...])
 * and build the appropriate WhatsApp API payload(s).
 */
export function buildMessagePayloads(
  aiReply: string,
  toPhone: string,
  language: Language | null,
  tenantConfig: {
    flow_registration_id?: string | null;
    flow_dependent_id?: string | null;
  }
): BuildResult {
  const lang = language || 'en';

  // Parse markers
  const buttonRegex = /\[BUTTONS:([^\]]+)\]/;
  const paylinkRegex = /\[PAYLINK:(https?:\/\/[^\]]+)\]/;
  const flowRegex = /\[FLOW:([^\]]+)\]/;

  let sentType = 'text';
  let markerMatch: RegExpExecArray | null = null;
  let markerIndex = -1;

  const btnMatch = buttonRegex.exec(aiReply);
  const payMatch = paylinkRegex.exec(aiReply);
  const flowMatch = flowRegex.exec(aiReply);

  if (flowMatch) {
    markerMatch = flowMatch;
    markerIndex = flowMatch.index;
  } else if (btnMatch && payMatch) {
    markerMatch = btnMatch.index <= payMatch.index ? btnMatch : payMatch;
    markerIndex = markerMatch.index;
  } else if (btnMatch) {
    markerMatch = btnMatch;
    markerIndex = btnMatch.index;
  } else if (payMatch) {
    markerMatch = payMatch;
    markerIndex = payMatch.index;
  }

  let bodyText = '';
  if (markerIndex >= 0) {
    bodyText = aiReply.substring(0, markerIndex).trim();
  } else {
    bodyText = aiReply.trim();
  }

  if (!bodyText) bodyText = t('select_option', lang);
  bodyText = truncate(bodyText, 1024);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloads: any[] = [];

  // ---- FLOW ----
  if (markerMatch && markerMatch[0].startsWith('[FLOW:')) {
    const flowType = markerMatch[1].trim().toLowerCase();
    const flowToken = 'reg_' + Date.now();
    let flowId: string;
    let flowScreen: string;
    if (flowType === 'dependent') {
      flowId = tenantConfig.flow_dependent_id || '1419191023017222';
      flowScreen = 'DEPENDENT_REG';
    } else {
      flowId = tenantConfig.flow_registration_id || '1245065397719313';
      flowScreen = 'REGISTRATION';
    }
    payloads.push({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone,
      type: 'interactive',
      interactive: {
        type: 'flow', body: { text: bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3', flow_token: flowToken, flow_id: flowId,
            flow_cta: t('enter_details', lang),
            flow_action: 'navigate',
            flow_action_payload: { screen: flowScreen },
          },
        },
      },
    });
    sentType = 'flow';
    return { payloads, sentType };
  }

  // ---- PAYLINK ----
  if (markerMatch && markerMatch[0].startsWith('[PAYLINK:')) {
    payloads.push(buildCtaUrl(toPhone, bodyText, t('pay_now', lang), markerMatch[1]));
    sentType = 'cta_url';
    return { payloads, sentType };
  }

  // ---- BUTTONS ----
  if (markerMatch && markerMatch[0].startsWith('[BUTTONS:')) {
    const markerContent = markerMatch[1];
    const colonIndex = markerContent.indexOf(':');
    let markerType = '';
    let markerData = '';
    if (colonIndex === -1) {
      markerType = markerContent.trim().toLowerCase();
    } else {
      markerType = markerContent.substring(0, colonIndex).trim().toLowerCase();
      markerData = markerContent.substring(colonIndex + 1).trim();
    }

    switch (markerType) {
      case 'language': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'lang_en', title: 'English' },
          { id: 'lang_hi', title: 'हिन्दी' },
          { id: 'lang_te', title: 'తెలుగు' },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'hasmobile': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'hasmobile_yes', title: t('hasmobile_yes', lang) },
          { id: 'hasmobile_no', title: t('hasmobile_no', lang) },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'mainmenu': {
        payloads.push(buildListMessage(toPhone, bodyText, t('mainmenu_button', lang), t('mainmenu_title', lang), [
          { id: 'menu_book_self', title: t('book_self', lang), description: t('book_self_desc', lang) },
          { id: 'menu_book_other', title: t('book_other', lang), description: t('book_other_desc', lang) },
          { id: 'menu_view_appts', title: t('view_appts', lang), description: t('view_appts_desc', lang) },
          { id: 'menu_reschedule', title: t('reschedule', lang), description: t('reschedule_desc', lang) },
          { id: 'menu_cancel', title: t('cancel', lang), description: t('cancel_desc', lang) },
          { id: 'menu_prescriptions', title: t('my_prescriptions', lang), description: t('my_prescriptions_desc', lang) },
          { id: 'menu_talk_human', title: t('talk_to_human', lang), description: t('talk_to_human_desc', lang) },
        ]));
        sentType = 'list';
        break;
      }
      case 'prescriptionlist': {
        const prescriptions = markerData.split('|').filter(p => p.trim());
        const rows = prescriptions.map((p) => {
          const parts = p.trim().split('~');
          const rxId = parts[0] || '';
          const doctor = parts[1] || '';
          const date = parts[2] || '';
          return {
            id: 'rx_' + rxId,
            title: 'Dr. ' + truncate(doctor, 18),
            description: truncate(date + ' - ' + rxId, 72),
          };
        });
        payloads.push(buildListMessage(toPhone, bodyText, 'View List', 'Prescriptions', rows));
        sentType = 'list';
        break;
      }
      case 'bookingtype': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'booking_self', title: t('for_self', lang) },
          { id: 'booking_other', title: t('for_other', lang) },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'yesno': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'confirm_yes', title: t('yes', lang) },
          { id: 'confirm_no', title: t('no', lang) },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'gender': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'gender_male', title: t('male', lang) },
          { id: 'gender_female', title: t('female', lang) },
          { id: 'gender_other', title: t('other', lang) },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'rating': {
        const rows = [
          { id: 'rating_5', title: '⭐⭐⭐⭐⭐ Excellent' },
          { id: 'rating_4', title: '⭐⭐⭐⭐ Good' },
          { id: 'rating_3', title: '⭐⭐⭐ Average' },
          { id: 'rating_2', title: '⭐⭐ Poor' },
          { id: 'rating_1', title: '⭐ Very Poor' },
        ];
        payloads.push(buildListMessage(toPhone, bodyText, 'Rate Now', 'Select Rating', rows));
        sentType = 'list';
        break;
      }
      case 'skip': {
        payloads.push(buildReplyButtons(toPhone, bodyText, [
          { id: 'skip_feedback', title: 'Skip' },
        ]));
        sentType = 'buttons';
        break;
      }
      case 'specialty': {
        const specialties = markerData.split('|').filter(s => s.trim());
        const rows = specialties.map((s) => ({
          id: 'spec_' + s.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
          title: s.trim(),
        }));
        payloads.push(buildListMessage(toPhone, bodyText, t('specialties_button', lang), t('specialties_title', lang), rows));
        sentType = 'list';
        break;
      }
      case 'doctor': {
        const doctors = markerData.split('|').filter(d => d.trim());
        const rows = doctors.map((d, idx) => {
          const name = d.trim();
          const parenMatch = /\(([^)]+)\)/.exec(name);
          const row: { id: string; title: string; description?: string } = {
            id: 'doc_' + (idx + 1),
            title: name.replace(/\s*\([^)]*\)\s*$/, '').trim(),
          };
          if (parenMatch) row.description = parenMatch[1];
          return row;
        });
        payloads.push(buildListMessage(toPhone, bodyText, t('doctors_button', lang), t('doctors_title', lang), rows));
        sentType = 'list';
        break;
      }
      case 'dates': {
        const dates = markerData.split('|').filter(d => d.trim());
        const rows = dates.map((d, idx) => {
          const dateStr = d.trim();
          const countMatch = /\((\d+)\)/.exec(dateStr);
          const dateName = dateStr.replace(/\s*\(\d+\)\s*$/, '').trim();
          const slots = countMatch ? countMatch[1] : '';
          return {
            id: 'date_' + (idx + 1),
            title: dateName,
            description: slots ? `${slots} ${slots === '1' ? t('slot_available', lang) : t('slots_available', lang)}` : '',
          };
        });
        payloads.push(buildListMessage(toPhone, bodyText, t('dates_button', lang), t('dates_title', lang), rows));
        sentType = 'list';
        break;
      }
      case 'timeperiod': {
        const periods = markerData.split('|').filter(p => p.trim());
        const validPeriods: { id: string; title: string }[] = [];
        for (const p of periods) {
          const periodStr = p.trim();
          const countMatch = /\((\d+)\)/.exec(periodStr);
          const count = countMatch ? parseInt(countMatch[1], 10) : 1;
          if (count > 0) {
            validPeriods.push({
              id: 'period_' + periodStr.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
              title: periodStr,
            });
          }
        }
        payloads.push(buildReplyButtons(toPhone, bodyText, validPeriods.slice(0, 3)));
        sentType = 'buttons';
        break;
      }
      case 'timeslots': {
        const slots = markerData.split('|').filter(s => s.trim());
        const rows = slots.map((s, idx) => {
          const slotStr = s.trim();
          const countMatch = /\(\d+\)/.exec(slotStr);
          const slotName = slotStr.replace(/\s*\(\d+\)\s*$/, '').trim();
          const cap = countMatch ? countMatch[0].replace(/[()]/g, '') : '';
          return {
            id: 'slot_' + (idx + 1),
            title: slotName,
            description: cap ? `${t('capacity', lang)}: ${cap}` : '',
          };
        });
        if (rows.length > 10) {
          // Send in chunks of 10
          for (let ci = 0; ci < rows.length; ci += 10) {
            const chunk = rows.slice(ci, ci + 10);
            const partNum = Math.floor(ci / 10) + 1;
            const msgText = ci === 0 ? bodyText : t('more_slots', lang) + ' (Part ' + partNum + '):';
            payloads.push(buildListMessage(toPhone, msgText, t('timeslots_button', lang), t('timeslots_title', lang), chunk));
          }
          sentType = 'list_multi';
        } else {
          payloads.push(buildListMessage(toPhone, bodyText, t('timeslots_button', lang), t('timeslots_title', lang), rows));
          sentType = 'list';
        }
        break;
      }
      case 'postbooking': {
        payloads.push(buildListMessage(toPhone, bodyText, t('postbooking_button', lang), t('postbooking_title', lang), [
          { id: 'post_book_another', title: t('book_another', lang), description: t('book_another_desc', lang) },
          { id: 'post_reschedule', title: t('reschedule', lang), description: t('reschedule_desc', lang) },
          { id: 'post_cancel', title: t('cancel', lang), description: t('cancel_desc', lang) },
          { id: 'post_view', title: t('view_appts', lang), description: t('view_appts_desc', lang) },
        ]));
        sentType = 'list';
        break;
      }
      case 'appointmentlist': {
        const appointments = markerData.split('|').filter(a => a.trim());
        const rows = appointments.map((a) => {
          const apptStr = a.trim();
          const parts = apptStr.split('-');
          const bookingId = parts[0] || apptStr;
          let patientName = '';
          let doctorName = '';
          let dateInfo = '';
          if (parts.length >= 4) {
            patientName = parts[1] || '';
            doctorName = parts.slice(2, -1).join('-');
            dateInfo = parts[parts.length - 1] || '';
          } else if (parts.length === 3) {
            doctorName = parts[1] || '';
            dateInfo = parts[2] || '';
          } else {
            doctorName = parts[1] || '';
            dateInfo = parts.length > 1 ? parts[parts.length - 1] : '';
          }
          return {
            id: 'appt_' + bookingId,
            title: bookingId,
            description: truncate([patientName, doctorName, dateInfo].filter(Boolean).join(' - '), 72),
          };
        });
        payloads.push(buildListMessage(toPhone, bodyText, t('appts_button', lang), t('appts_title', lang), rows));
        sentType = 'list';
        break;
      }
      case 'relationship': {
        payloads.push(buildListMessage(toPhone, bodyText, t('rel_button', lang), t('rel_title', lang), [
          { id: 'rel_parent', title: t('parent', lang) },
          { id: 'rel_spouse', title: t('spouse', lang) },
          { id: 'rel_child', title: t('child', lang) },
          { id: 'rel_friend', title: t('friend', lang) },
          { id: 'rel_other', title: t('other', lang) },
        ]));
        sentType = 'list';
        break;
      }
      case 'reason': {
        payloads.push(buildListMessage(toPhone, bodyText, t('reason_button', lang), t('reason_title', lang), [
          { id: 'reason_general', title: t('general_checkup', lang) },
          { id: 'reason_followup', title: t('followup', lang) },
          { id: 'reason_symptoms', title: t('new_symptoms', lang) },
          { id: 'reason_screening', title: t('screening', lang) },
          { id: 'reason_labresults', title: t('lab_results', lang) },
          { id: 'reason_prescription', title: t('prescription_renew', lang) },
          { id: 'reason_emergency', title: t('emergency', lang) },
          { id: 'reason_other', title: t('other', lang) },
        ]));
        sentType = 'list';
        break;
      }
      default: {
        payloads.push(buildTextMessage(toPhone, aiReply.trim()));
        sentType = 'text';
        break;
      }
    }

    return { payloads, sentType };
  }

  // No marker — plain text
  payloads.push(buildTextMessage(toPhone, bodyText));
  sentType = 'text';
  return { payloads, sentType };
}
