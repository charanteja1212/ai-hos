/**
 * WhatsApp Bot Translations (Simplified)
 * Only messages needed for: welcome, language, web menu, live agent
 */

import type { Language } from './types';

type TranslationEntry = Record<Language, string>;

// ============================================================
// MSGS — State machine messages with {placeholder} variables
// ============================================================

export const MSGS: Record<string, TranslationEntry> = {
  // --- Welcome & Language ---
  welcome: {
    en: 'Welcome to *{hospital}* 🏥\n\nI\'m {bot}, your digital health assistant.\n\nTo get started, please select your preferred language:\n[BUTTONS:language]',
    hi: '*{hospital}* में आपका स्वागत है 🏥\n\nमैं {bot} हूं, आपका डिजिटल स्वास्थ्य सहायक।\n\nशुरू करने के लिए, कृपया अपनी भाषा चुनें:\n[BUTTONS:language]',
    te: '*{hospital}* కి స్వాగతం 🏥\n\nనేను {bot}, మీ డిజిటల్ హెల్త్ అసిస్టెంట్.\n\nప్రారంభించడానికి, దయచేసి మీ భాషను ఎంచుకోండి:\n[BUTTONS:language]',
  },
  lang_retry: {
    en: 'I couldn\'t recognize your selection. Please tap one of the language options below:\n[BUTTONS:language]',
    hi: 'मैं आपकी पसंद पहचान नहीं सका। कृपया नीचे दी गई भाषाओं में से एक चुनें:\n[BUTTONS:language]',
    te: 'మీ ఎంపికను గుర్తించలేకపోయాను. దయచేసి క్రింది భాషా ఎంపికల్లో ఒకదాన్ని ఎంచుకోండి:\n[BUTTONS:language]',
  },

  // --- Web Menu ---
  menu_greeting: {
    en: '🏥 *{hospital}*\n\nHow can I help you today? Tap any link below to get started:',
    hi: '🏥 *{hospital}*\n\nआज मैं आपकी कैसे मदद कर सकता हूं? शुरू करने के लिए नीचे कोई भी लिंक टैप करें:',
    te: '🏥 *{hospital}*\n\nఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను? ప్రారంభించడానికి క్రింద ఏదైనా లింక్ ట్యాప్ చేయండి:',
  },
  menu_greeting_known: {
    en: '🏥 *{hospital}*\n\nWelcome back, *{name}*! Tap any link below:',
    hi: '🏥 *{hospital}*\n\nवापसी पर स्वागत है, *{name}*! नीचे कोई भी लिंक टैप करें:',
    te: '🏥 *{hospital}*\n\nతిరిగి స్వాగతం, *{name}*! క్రింద ఏదైనా లింక్ ట్యాప్ చేయండి:',
  },

  // --- Link Labels ---
  link_book_self: {
    en: 'Book Appointment',
    hi: 'अपॉइंटमेंट बुक करें',
    te: 'అపాయింట్\u200Cమెంట్ బుక్',
  },
  link_book_other: {
    en: 'Book for Family Member',
    hi: 'परिवार के लिए बुक करें',
    te: 'కుటుంబ సభ్యుని కోసం బుక్',
  },
  link_appointments: {
    en: 'View My Appointments',
    hi: 'मेरे अपॉइंटमेंट देखें',
    te: 'నా అపాయింట్\u200Cమెంట్\u200Cలు చూడండి',
  },
  link_reschedule: {
    en: 'Reschedule Appointment',
    hi: 'अपॉइंटमेंट रीशेड्यूल करें',
    te: 'అపాయింట్\u200Cమెంట్ రీషెడ్యూల్',
  },
  link_cancel: {
    en: 'Cancel Appointment',
    hi: 'अपॉइंटमेंट रद्द करें',
    te: 'అపాయింట్\u200Cమెంట్ రద్దు',
  },
  link_prescriptions: {
    en: 'My Prescriptions',
    hi: 'मेरे प्रिस्क्रिप्शन',
    te: 'నా ప్రిస్క్రిప్షన్లు',
  },
  link_talk_staff: {
    en: 'Talk to Staff',
    hi: 'स्टाफ से बात करें',
    te: 'సిబ్బందితో మాట్లాడండి',
  },
  link_talk_staff_hint: {
    en: 'Type "talk to staff" to connect with reception',
    hi: '"talk to staff" टाइप करके रिसेप्शन से जुड़ें',
    te: 'రిసెప్షన్‌తో కనెక్ట్ అవ్వడానికి "talk to staff" టైప్ చేయండి',
  },
  desc_book_self: {
    en: 'Schedule a visit for yourself',
    hi: 'अपने लिए विज़िट शेड्यूल करें',
    te: 'మీ కోసం విజిట్ షెడ్యూల్ చేయండి',
  },
  desc_book_other: {
    en: 'Book for a family member',
    hi: 'परिवार के सदस्य के लिए बुक करें',
    te: 'కుటుంబ సభ్యుని కోసం బుక్ చేయండి',
  },
  desc_appointments: {
    en: 'View your upcoming visits',
    hi: 'आगामी विज़िट देखें',
    te: 'మీ రాబోయే విజిట్‌లు చూడండి',
  },
  desc_reschedule: {
    en: 'Change date or time',
    hi: 'तारीख या समय बदलें',
    te: 'తేదీ లేదా సమయం మార్చండి',
  },
  desc_cancel: {
    en: 'Cancel an existing booking',
    hi: 'मौजूदा बुकिंग रद्द करें',
    te: 'ఇప్పటి బుకింగ్ రద్దు చేయండి',
  },
  desc_prescriptions: {
    en: 'View your medications',
    hi: 'अपनी दवाइयाँ देखें',
    te: 'మీ మందులు చూడండి',
  },
  desc_talk_staff: {
    en: 'Chat with hospital reception',
    hi: 'अस्पताल रिसेप्शन से चैट करें',
    te: 'ఆసుపత్రి రిసెప్షన్‌తో చాట్ చేయండి',
  },
  menu_button: {
    en: 'View Services',
    hi: 'सेवाएँ देखें',
    te: 'సేవలు చూడండి',
  },
  menu_section_title: {
    en: 'Hospital Services',
    hi: 'अस्पताल सेवाएँ',
    te: 'ఆసుపత్రి సేవలు',
  },
  link_tap_below: {
    en: 'Tap the link below to continue:',
    hi: 'जारी रखने के लिए नीचे दिए गए लिंक पर टैप करें:',
    te: 'కొనసాగించడానికి క్రింద లింక్ ట్యాప్ చేయండి:',
  },

  // --- Live Agent ---
  live_agent_connected: {
    en: 'You are now connected to a live agent. A staff member will assist you shortly.\n\nType *end chat* to return to the main menu.',
    hi: 'अब आप लाइव एजेंट से जुड़ गए हैं। एक स्टाफ सदस्य जल्द ही आपकी सहायता करेगा।\n\nमुख्य मेनू पर लौटने के लिए *end chat* टाइप करें।',
    te: 'మీరు ఇప్పుడు లైవ్ ఏజెంట్\u200Cతో కనెక్ట్ అయ్యారు. ఒక సిబ్బంది సభ్యుడు త్వరలో మీకు సహాయం చేస్తారు.\n\nప్రధాన మెనూకు తిరిగి రావడానికి *end chat* టైప్ చేయండి.',
  },
  live_agent_ended: {
    en: 'Your live chat session has ended. Thank you for reaching out!\n\nType *menu* to see options again.',
    hi: 'आपकी लाइव चैट समाप्त हो गई। संपर्क करने के लिए धन्यवाद!\n\nविकल्प फिर से देखने के लिए *menu* टाइप करें।',
    te: 'మీ లైవ్ చాట్ సెషన్ ముగిసింది. సంప్రదించినందుకు ధన్యవాదాలు!\n\nఎంపికలు మళ్ళీ చూడటానికి *menu* టైప్ చేయండి.',
  },
};

// ============================================================
// T — Button/UI label translations
// ============================================================

export const T: Record<string, TranslationEntry> = {
  select_option: { en: 'Please select an option:', hi: 'कृपया एक विकल्प चुनें:', te: 'దయచేసి ఒక ఎంపిక ఎంచుకోండి:' },
};

/**
 * Get a translated message string with variable substitution
 */
export function msg(key: string, language: Language | null, vars?: Record<string, string>): string {
  const entry = MSGS[key];
  if (!entry) return key;
  const lang = language || 'en';
  let text = entry[lang] || entry['en'] || key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      text = text.split('{' + k + '}').join(vars[k] || '');
    }
  }
  return text;
}

/**
 * Get a translated UI label
 */
export function t(key: string, language: Language | null): string {
  const entry = T[key];
  if (!entry) return key;
  const lang = language || 'en';
  return entry[lang] || entry['en'] || key;
}
