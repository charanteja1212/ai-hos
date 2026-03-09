/**
 * WhatsApp Bot Translations
 * All multilingual messages (English, Hindi, Telugu)
 */

import type { Language } from './types';

type TranslationEntry = Record<Language, string>;

// ============================================================
// MSGS — State machine messages with {placeholder} variables
// ============================================================

export const MSGS: Record<string, TranslationEntry> = {
  // --- Welcome & Language ---
  welcome: {
    en: 'Welcome to *{hospital}* \n\nI\'m {bot}, your digital health assistant. I\'m here to help you with appointment bookings, rescheduling, cancellations, and more.\n\nTo get started, please select your preferred language:\n[BUTTONS:language]',
    hi: '*{hospital}* में आपका स्वागत है \n\nमैं {bot} हूं, आपका डिजिटल स्वास्थ्य सहायक। मैं अपॉइंटमेंट बुकिंग, रीशेड्यूल, रद्द करने और अन्य सेवाओं में आपकी मदद के लिए यहां हूं।\n\nशुरू करने के लिए, कृपया अपनी भाषा चुनें:\n[BUTTONS:language]',
    te: '*{hospital}* కి స్వాగతం \n\nనేను {bot}, మీ డిజిటల్ హెల్త్ అసిస్టెంట్. అపాయింట్\u200Cమెంట్ బుకింగ్, రీషెడ్యూల్, రద్దు మరియు ఇతర సేవల్లో మీకు సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను.\n\nప్రారంభించడానికి, దయచేసి మీ భాషను ఎంచుకోండి:\n[BUTTONS:language]',
  },
  lang_success: {
    en: 'Thank you for choosing your language.\n\nHow may I assist you today? Please select an option below:\n[BUTTONS:mainmenu]',
    hi: 'भाषा चुनने के लिए धन्यवाद।\n\nआज मैं आपकी कैसे मदद कर सकता हूं? कृपया नीचे एक विकल्प चुनें:\n[BUTTONS:mainmenu]',
    te: 'భాషను ఎంచుకున్నందుకు ధన్యవాదాలు.\n\nఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను? దయచేసి క్రింద ఒక ఎంపిక ఎంచుకోండి:\n[BUTTONS:mainmenu]',
  },
  lang_retry: {
    en: 'I couldn\'t recognize your selection. Please tap one of the language options below:\n[BUTTONS:language]',
    hi: 'मैं आपकी पसंद पहचान नहीं सका। कृपया नीचे दी गई भाषाओं में से एक चुनें:\n[BUTTONS:language]',
    te: 'మీ ఎంపికను గుర్తించలేకపోయాను. దయచేసి క్రింది భాషా ఎంపికల్లో ఒకదాన్ని ఎంచుకోండి:\n[BUTTONS:language]',
  },
  main_menu: {
    en: 'How may I assist you today? Please select an option below:\n[BUTTONS:mainmenu]',
    hi: 'आज मैं आपकी कैसे मदद कर सकता हूं? कृपया नीचे एक विकल्प चुनें:\n[BUTTONS:mainmenu]',
    te: 'ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను? దయచేసి క్రింద ఒక ఎంపిక ఎంచుకోండి:\n[BUTTONS:mainmenu]',
  },

  // --- Self Booking ---
  welcome_back: {
    en: 'Welcome back, *{name}*!\n\nWe\'re glad to see you again. Please select the department you\'d like to book an appointment with:\n[BUTTONS:specialty:{specs}]',
    hi: 'वापसी पर स्वागत है, *{name}*!\n\nआपको फिर से देखकर खुशी हुई। कृपया वह विभाग चुनें जिसमें आप अपॉइंटमेंट बुक करना चाहते हैं:\n[BUTTONS:specialty:{specs}]',
    te: 'తిరిగి స్వాగతం, *{name}*!\n\nమిమ్మల్ని మళ్ళీ చూసి సంతోషం. దయచేసి మీరు అపాయింట్\u200Cమెంట్ బుక్ చేయాలనుకునే విభాగాన్ని ఎంచుకోండి:\n[BUTTONS:specialty:{specs}]',
  },
  new_user_reg: {
    en: 'It looks like you\'re visiting us for the first time. To proceed with the booking, we\'ll need a few details.\n\nPlease fill in the registration form below:\n[FLOW:registration]',
    hi: 'ऐसा लगता है कि आप पहली बार हमसे मिल रहे हैं। बुकिंग आगे बढ़ाने के लिए हमें कुछ जानकारी चाहिए।\n\nकृपया नीचे रजिस्ट्रेशन फॉर्म भरें:\n[FLOW:registration]',
    te: 'మీరు మొదటిసారి వస్తున్నట్లు కనిపిస్తోంది. బుకింగ్ కొనసాగించడానికి మాకు కొన్ని వివరాలు అవసరం.\n\nదయచేసి క్రింది రిజిస్ట్రేషన్ ఫారమ్ నింపండి:\n[FLOW:registration]',
  },
  reg_success: {
    en: 'Thank you, *{name}*! Your registration is complete.\n\nYou\'re all set. Please select the department you\'d like to book an appointment with:\n[BUTTONS:specialty:{specs}]',
    hi: 'धन्यवाद, *{name}*! आपका रजिस्ट्रेशन पूरा हो गया।\n\nसब तैयार है। कृपया वह विभाग चुनें जिसमें अपॉइंटमेंट बुक करना चाहते हैं:\n[BUTTONS:specialty:{specs}]',
    te: 'ధన్యవాదాలు, *{name}*! మీ రిజిస్ట్రేషన్ పూర్తయింది.\n\nమీరు సిద్ధంగా ఉన్నారు. దయచేసి మీరు అపాయింట్\u200Cమెంట్ బుక్ చేయాలనుకునే విభాగాన్ని ఎంచుకోండి:\n[BUTTONS:specialty:{specs}]',
  },
  reg_retry: {
    en: 'We still need your registration details to proceed. Please fill in the form below:\n[FLOW:registration]',
    hi: 'आगे बढ़ने के लिए हमें अभी भी आपकी रजिस्ट्रेशन जानकारी चाहिए। कृपया नीचे फॉर्म भरें:\n[FLOW:registration]',
    te: 'కొనసాగించడానికి మాకు ఇంకా మీ రిజిస్ట్రేషన్ వివరాలు అవసరం. దయచేసి క్రింద ఫారమ్ నింపండి:\n[FLOW:registration]',
  },

  // --- Someone Else Booking ---
  other_found: {
    en: 'Great, *{name}*! To book an appointment for someone else, please provide the patient\'s details in the form below:\n[FLOW:dependent]',
    hi: 'बहुत अच्छा, *{name}*! किसी और के लिए अपॉइंटमेंट बुक करने के लिए, कृपया नीचे मरीज़ की जानकारी भरें:\n[FLOW:dependent]',
    te: 'బాగుంది, *{name}*! మరొకరి కోసం అపాయింట్\u200Cమెంట్ బుక్ చేయడానికి, దయచేసి క్రింద రోగి వివరాలు నింపండి:\n[FLOW:dependent]',
  },
  other_reg_first: {
    en: 'Before we proceed, we need to register your details first. This is a one-time process.\n\nPlease fill in the registration form below:\n[FLOW:registration]',
    hi: 'आगे बढ़ने से पहले, हमें पहले आपकी जानकारी दर्ज करनी होगी। यह एक बार की प्रक्रिया है।\n\nकृपया नीचे रजिस्ट्रेशन फॉर्म भरें:\n[FLOW:registration]',
    te: 'ముందుకు వెళ్ళే ముందు, మీ వివరాలను ముందుగా నమోదు చేయాలి. ఇది ఒకసారి చేసే ప్రక్రియ.\n\nదయచేసి క్రింద రిజిస్ట్రేషన్ ఫారమ్ నింపండి:\n[FLOW:registration]',
  },
  caller_reg_done: {
    en: 'Your registration is complete! Now, please provide the patient\'s details in the form below:\n[FLOW:dependent]',
    hi: 'आपका रजिस्ट्रेशन पूरा हो गया! अब, कृपया नीचे मरीज़ की जानकारी भरें:\n[FLOW:dependent]',
    te: 'మీ రిజిస్ట్రేషన్ పూర్తయింది! ఇప్పుడు, దయచేసి క్రింద రోగి వివరాలు నింపండి:\n[FLOW:dependent]',
  },
  dep_details_done: {
    en: 'Thank you for providing the patient\'s details.\n\nDoes the patient have their own mobile number?\n[BUTTONS:hasmobile]',
    hi: 'मरीज़ की जानकारी देने के लिए धन्यवाद।\n\nक्या मरीज़ का अपना मोबाइल नंबर है?\n[BUTTONS:hasmobile]',
    te: 'రోగి వివరాలు అందించినందుకు ధన్యవాదాలు.\n\nరోగికి వారి స్వంత మొబైల్ నంబర్ ఉందా?\n[BUTTONS:hasmobile]',
  },
  dep_retry: {
    en: 'We still need the patient\'s details. Please fill in the form below:\n[FLOW:dependent]',
    hi: 'हमें अभी भी मरीज़ की जानकारी चाहिए। कृपया नीचे फॉर्म भरें:\n[FLOW:dependent]',
    te: 'మాకు ఇంకా రోగి వివరాలు అవసరం. దయచేసి క్రింద ఫారమ్ నింపండి:\n[FLOW:dependent]',
  },

  // --- Has Mobile ---
  enter_phone: {
    en: 'Please enter the patient\'s 10-digit mobile number:',
    hi: 'कृपया मरीज़ का 10 अंकों का मोबाइल नंबर दर्ज करें:',
    te: 'దయచేసి రోగి యొక్క 10 అంకెల మొబైల్ నంబర్ ఎంటర్ చేయండి:',
  },
  use_my_phone: {
    en: 'No problem, we\'ll use your number for the patient\'s records.\n\nPlease select your relationship with the patient:\n[BUTTONS:relationship]',
    hi: 'कोई बात नहीं, हम मरीज़ के रिकॉर्ड के लिए आपका नंबर इस्तेमाल करेंगे।\n\nकृपया मरीज़ से अपना रिश्ता चुनें:\n[BUTTONS:relationship]',
    te: 'ఫర్వాలేదు, రోగి రికార్డ్\u200Cల కోసం మీ నంబర్ వాడతాము.\n\nదయచేసి రోగితో మీ సంబంధాన్ని ఎంచుకోండి:\n[BUTTONS:relationship]',
  },
  hasmobile_retry: {
    en: 'Please let us know — does the patient have their own mobile number?\n[BUTTONS:hasmobile]',
    hi: 'कृपया बताएं — क्या मरीज़ का अपना मोबाइल नंबर है?\n[BUTTONS:hasmobile]',
    te: 'దయచేసి తెలియజేయండి — రోగికి వారి స్వంత మొబైల్ నంబర్ ఉందా?\n[BUTTONS:hasmobile]',
  },
  phone_saved: {
    en: 'Mobile number saved.\n\nPlease select your relationship with the patient:\n[BUTTONS:relationship]',
    hi: 'मोबाइल नंबर सेव हो गया।\n\nकृपया मरीज़ से अपना रिश्ता चुनें:\n[BUTTONS:relationship]',
    te: 'మొబైల్ నంబర్ సేవ్ అయింది.\n\nదయచేసి రోగితో మీ సంబంధాన్ని ఎంచుకోండి:\n[BUTTONS:relationship]',
  },
  phone_invalid: {
    en: 'That doesn\'t appear to be a valid number. Please enter a 10-digit mobile number:',
    hi: 'यह एक मान्य नंबर नहीं लगता। कृपया 10 अंकों का मोबाइल नंबर दर्ज करें:',
    te: 'ఇది చెల్లుబాటు అయ్యే నంబర్ కాదు. దయచేసి 10 అంకెల మొబైల్ నంబర్ ఎంటర్ చేయండి:',
  },
  rel_retry: {
    en: 'Please select your relationship with the patient:\n[BUTTONS:relationship]',
    hi: 'कृपया मरीज़ से अपना रिश्ता चुनें:\n[BUTTONS:relationship]',
    te: 'దయచేసి రోగితో మీ సంబంధాన్ని ఎంచుకోండి:\n[BUTTONS:relationship]',
  },
  dep_registered: {
    en: 'The patient has been registered successfully.\n\nNow let\'s book the appointment. Please select the department:\n[BUTTONS:specialty:{specs}]',
    hi: 'मरीज़ का रजिस्ट्रेशन सफल रहा।\n\nअब अपॉइंटमेंट बुक करते हैं। कृपया विभाग चुनें:\n[BUTTONS:specialty:{specs}]',
    te: 'రోగి రిజిస్ట్రేషన్ విజయవంతమైంది.\n\nఇప్పుడు అపాయింట్\u200Cమెంట్ బుక్ చేద్దాం. దయచేసి విభాగాన్ని ఎంచుకోండి:\n[BUTTONS:specialty:{specs}]',
  },

  // --- Booking Flow ---
  select_doctor: {
    en: 'Multiple doctors are available in *{spec}*. Please select your preferred doctor:\n[BUTTONS:doctor:{docs}]',
    hi: '*{spec}* में कई डॉक्टर उपलब्ध हैं। कृपया अपना पसंदीदा डॉक्टर चुनें:\n[BUTTONS:doctor:{docs}]',
    te: '*{spec}* లో అనేక డాక్టర్లు అందుబాటులో ఉన్నారు. దయచేసి మీకు ఇష్టమైన డాక్టర్\u200Cను ఎంచుకోండి:\n[BUTTONS:doctor:{docs}]',
  },
  select_date: {
    en: 'Dr. *{doctor}* is available on the following dates. Please select your preferred date:\n[BUTTONS:dates:{dates}]',
    hi: 'डॉ. *{doctor}* निम्नलिखित तारीखों पर उपलब्ध हैं। कृपया अपनी पसंदीदा तारीख चुनें:\n[BUTTONS:dates:{dates}]',
    te: 'డాక్టర్ *{doctor}* క్రింది తేదీల్లో అందుబాటులో ఉన్నారు. దయచేసి మీకు అనుకూలమైన తేదీని ఎంచుకోండి:\n[BUTTONS:dates:{dates}]',
  },
  no_slots_7days: {
    en: 'Unfortunately, Dr. *{doctor}* has no available slots in the next 7 days.\n\nWould you like to try a different department?\n[BUTTONS:mainmenu]',
    hi: 'दुर्भाग्य से, डॉ. *{doctor}* के पास अगले 7 दिनों में कोई उपलब्ध स्लॉट नहीं है।\n\nक्या आप कोई दूसरा विभाग आज़माना चाहेंगे?\n[BUTTONS:mainmenu]',
    te: 'దురదృష్టవశాత్తు, డాక్టర్ *{doctor}* కు రాబోయే 7 రోజుల్లో స్లాట్\u200Cలు అందుబాటులో లేవు.\n\nమీరు వేరే విభాగం ప్రయత్నించాలనుకుంటున్నారా?\n[BUTTONS:mainmenu]',
  },
  spec_retry: {
    en: 'I couldn\'t match that selection. Please choose a department from the options below:\n[BUTTONS:specialty:{specs}]',
    hi: 'मैं उस चयन को पहचान नहीं सका। कृपया नीचे दिए गए विकल्पों में से एक विभाग चुनें:\n[BUTTONS:specialty:{specs}]',
    te: 'ఆ ఎంపికను గుర్తించలేకపోయాను. దయచేసి క్రింది ఎంపికల నుండి విభాగాన్ని ఎంచుకోండి:\n[BUTTONS:specialty:{specs}]',
  },
  doc_retry: {
    en: 'I couldn\'t match that doctor. Please select from the list:\n[BUTTONS:doctor:{docs}]',
    hi: 'मैं उस डॉक्टर को पहचान नहीं सका। कृपया सूची से चुनें:\n[BUTTONS:doctor:{docs}]',
    te: 'ఆ డాక్టర్\u200Cను గుర్తించలేకపోయాను. దయచేసి జాబితా నుండి ఎంచుకోండి:\n[BUTTONS:doctor:{docs}]',
  },
  select_period: {
    en: 'Great choice! For *{date}*, please select your preferred time period:\n[BUTTONS:timeperiod:{periods}]',
    hi: 'बढ़िया! *{date}* के लिए, कृपया अपना पसंदीदा समय चुनें:\n[BUTTONS:timeperiod:{periods}]',
    te: 'మంచి ఎంపిక! *{date}* కోసం, దయచేసి మీకు అనుకూలమైన సమయాన్ని ఎంచుకోండి:\n[BUTTONS:timeperiod:{periods}]',
  },
  date_full: {
    en: 'Sorry, all slots for *{date}* are fully booked. Please choose a different date.',
    hi: 'क्षमा करें, *{date}* के सभी स्लॉट भरे हुए हैं। कृपया कोई दूसरी तारीख चुनें।',
    te: 'క్షమించండి, *{date}* కోసం అన్ని స్లాట్\u200Cలు పూర్తిగా బుక్ అయ్యాయి. దయచేసి వేరే తేదీ ఎంచుకోండి.',
  },
  date_retry: {
    en: 'I couldn\'t match that date. Please select from the available dates below:\n[BUTTONS:dates:{dates}]',
    hi: 'मैं उस तारीख को पहचान नहीं सका। कृपया नीचे उपलब्ध तारीखों में से चुनें:\n[BUTTONS:dates:{dates}]',
    te: 'ఆ తేదీని గుర్తించలేకపోయాను. దయచేసి క్రింది అందుబాటు తేదీల నుండి ఎంచుకోండి:\n[BUTTONS:dates:{dates}]',
  },
  select_slot: {
    en: 'Here are the available {period} slots. Please select your preferred time:\n[BUTTONS:timeslots:{slots}]',
    hi: 'यहां {period} के उपलब्ध स्लॉट हैं। कृपया अपना पसंदीदा समय चुनें:\n[BUTTONS:timeslots:{slots}]',
    te: 'ఇక్కడ అందుబాటులో ఉన్న {period} స్లాట్\u200Cలు ఉన్నాయి. దయచేసి మీకు అనుకూలమైన సమయాన్ని ఎంచుకోండి:\n[BUTTONS:timeslots:{slots}]',
  },
  period_no_slots: {
    en: 'Sorry, no {period} slots are available. Please choose a different time period.',
    hi: 'क्षमा करें, {period} में कोई स्लॉट उपलब्ध नहीं है। कृपया कोई दूसरा समय चुनें।',
    te: 'క్షమించండి, {period} స్లాట్\u200Cలు అందుబాటులో లేవు. దయచేసి వేరే సమయం ఎంచుకోండి.',
  },
  period_retry: {
    en: 'Please select a time period from the options below:\n[BUTTONS:timeperiod:{periods}]',
    hi: 'कृपया नीचे दिए गए विकल्पों में से एक समय चुनें:\n[BUTTONS:timeperiod:{periods}]',
    te: 'దయచేసి క్రింది ఎంపికల నుండి సమయాన్ని ఎంచుకోండి:\n[BUTTONS:timeperiod:{periods}]',
  },
  slot_retry: {
    en: 'I couldn\'t identify the time slot. Please select one from the options above.',
    hi: 'मैं समय स्लॉट पहचान नहीं सका। कृपया ऊपर दिए गए विकल्पों में से एक चुनें।',
    te: 'సమయ స్లాట్\u200Cను గుర్తించలేకపోయాను. దయచేసి పైన ఉన్న ఎంపికల నుండి ఒకటి ఎంచుకోండి.',
  },

  // --- Confirmation ---
  confirm_review: {
    en: 'Please review your appointment details:\n\n*Patient:* {patient}\n{age}*Doctor:* Dr. {doctor}\n*Department:* {spec}\n*Date:* {date}\n*Time:* {time}\n\nWould you like to confirm this appointment?\n[BUTTONS:yesno]',
    hi: 'कृपया अपने अपॉइंटमेंट की जानकारी देखें:\n\n*मरीज़:* {patient}\n{age}*डॉक्टर:* डॉ. {doctor}\n*विभाग:* {spec}\n*तारीख:* {date}\n*समय:* {time}\n\nक्या आप इस अपॉइंटमेंट की पुष्टि करना चाहते हैं?\n[BUTTONS:yesno]',
    te: 'దయచేసి మీ అపాయింట్\u200Cమెంట్ వివరాలను సమీక్షించండి:\n\n*రోగి:* {patient}\n{age}*డాక్టర్:* డా. {doctor}\n*విభాగం:* {spec}\n*తేదీ:* {date}\n*సమయం:* {time}\n\nఈ అపాయింట్\u200Cమెంట్\u200Cను నిర్ధారించాలనుకుంటున్నారా?\n[BUTTONS:yesno]',
  },
  confirm_yesno_retry: {
    en: 'Would you like to confirm this appointment? Please select Yes or No.\n[BUTTONS:yesno]',
    hi: 'क्या आप इस अपॉइंटमेंट की पुष्टि करना चाहते हैं? कृपया हाँ या नहीं चुनें।\n[BUTTONS:yesno]',
    te: 'ఈ అపాయింట్\u200Cమెంట్\u200Cను నిర్ధారించాలనుకుంటున్నారా? దయచేసి అవును లేదా కాదు ఎంచుకోండి.\n[BUTTONS:yesno]',
  },
  booked_with_pay: {
    en: 'Your appointment has been reserved successfully!\n\n*Booking ID:* {booking_id}\n*Patient:* {patient}\n*Doctor:* Dr. {doctor}\n*Department:* {spec}\n*Date:* {date}\n*Time:* {time}\n*Consultation Fee:* Rs {fee}\n\nTo confirm your booking, please complete the payment using the link below:\n[PAYLINK:{paylink}]',
    hi: 'आपका अपॉइंटमेंट सफलतापूर्वक आरक्षित हो गया!\n\n*बुकिंग ID:* {booking_id}\n*मरीज़:* {patient}\n*डॉक्टर:* डॉ. {doctor}\n*विभाग:* {spec}\n*तारीख:* {date}\n*समय:* {time}\n*परामर्श शुल्क:* Rs {fee}\n\nबुकिंग की पुष्टि के लिए, कृपया नीचे दिए गए लिंक से भुगतान करें:\n[PAYLINK:{paylink}]',
    te: 'మీ అపాయింట్\u200Cమెంట్ విజయవంతంగా రిజర్వ్ అయింది!\n\n*బుకింగ్ ID:* {booking_id}\n*రోగి:* {patient}\n*డాక్టర్:* డా. {doctor}\n*విభాగం:* {spec}\n*తేదీ:* {date}\n*సమయం:* {time}\n*సంప్రదింపు రుసుము:* Rs {fee}\n\nబుకింగ్ నిర్ధారించడానికి, దయచేసి క్రింది లింక్ ద్వారా చెల్లింపు చేయండి:\n[PAYLINK:{paylink}]',
  },
  booked_no_pay: {
    en: 'Your appointment has been confirmed!\n\n*Booking ID:* {booking_id}\n*Patient:* {patient}\n*Doctor:* Dr. {doctor}\n*Date:* {date}\n*Time:* {time}\n\nWe look forward to seeing you. Is there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'आपका अपॉइंटमेंट कन्फर्म हो गया!\n\n*बुकिंग ID:* {booking_id}\n*मरीज़:* {patient}\n*डॉक्टर:* डॉ. {doctor}\n*तारीख:* {date}\n*समय:* {time}\n\nहम आपसे मिलने के लिए उत्सुक हैं। क्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'మీ అపాయింట్\u200Cమెంట్ నిర్ధారించబడింది!\n\n*బుకింగ్ ID:* {booking_id}\n*రోగి:* {patient}\n*డాక్టర్:* డా. {doctor}\n*తేదీ:* {date}\n*సమయం:* {time}\n\nమిమ్మల్ని చూడటానికి ఎదురు చూస్తున్నాము. మీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  booking_failed: {
    en: 'We apologize, but the booking could not be completed.\n\n*Reason:* {error}\n\nWould you like to try again?\n[BUTTONS:mainmenu]',
    hi: 'क्षमा करें, बुकिंग पूरी नहीं हो सकी।\n\n*कारण:* {error}\n\nक्या आप फिर से कोशिश करना चाहेंगे?\n[BUTTONS:mainmenu]',
    te: 'క్షమించండి, బుకింగ్ పూర్తి కాలేదు.\n\n*కారణం:* {error}\n\nమీరు మళ్ళీ ప్రయత్నించాలనుకుంటున్నారా?\n[BUTTONS:mainmenu]',
  },
  booking_cancelled_by_user: {
    en: 'No worries! The booking has been cancelled.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'कोई बात नहीं! बुकिंग रद्द कर दी गई है।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ఫర్వాలేదు! బుకింగ్ రద్దు చేయబడింది.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },

  // --- Payment ---
  awaiting_pay: {
    en: 'Your appointment is reserved and awaiting payment.\n\nType *pay* to get the payment link again, or select an option below:\n[BUTTONS:mainmenu]',
    hi: 'आपका अपॉइंटमेंट आरक्षित है और भुगतान की प्रतीक्षा में है।\n\nभुगतान लिंक दोबारा पाने के लिए *pay* टाइप करें, या नीचे एक विकल्प चुनें:\n[BUTTONS:mainmenu]',
    te: 'మీ అపాయింట్\u200Cమెంట్ రిజర్వ్ అయింది మరియు చెల్లింపు కోసం వేచి ఉంది.\n\nచెల్లింపు లింక్ మళ్ళీ పొందడానికి *pay* టైప్ చేయండి, లేదా క్రింద ఎంపిక ఎంచుకోండి:\n[BUTTONS:mainmenu]',
  },
  pay_link_again: {
    en: 'Here is your payment link again:\n[PAYLINK:{link}]',
    hi: 'यहां आपका भुगतान लिंक फिर से है:\n[PAYLINK:{link}]',
    te: 'ఇక్కడ మీ చెల్లింపు లింక్ మళ్ళీ ఉంది:\n[PAYLINK:{link}]',
  },
  pay_link_scroll: {
    en: 'Your appointment is reserved. Please scroll up to find the payment link, or start a new booking from the menu.\n\n[BUTTONS:mainmenu]',
    hi: 'आपका अपॉइंटमेंट आरक्षित है। कृपया भुगतान लिंक खोजने के लिए ऊपर स्क्रॉल करें, या मेनू से नई बुकिंग शुरू करें।\n\n[BUTTONS:mainmenu]',
    te: 'మీ అపాయింట్\u200Cమెంట్ రిజర్వ్ అయింది. దయచేసి చెల్లింపు లింక్ కోసం పైకి స్క్రోల్ చేయండి, లేదా మెనూ నుండి కొత్త బుకింగ్ ప్రారంభించండి.\n\n[BUTTONS:mainmenu]',
  },

  // --- View Appointments ---
  no_appointments: {
    en: 'You don\'t have any upcoming appointments.\n\nWould you like to book one?\n[BUTTONS:mainmenu]',
    hi: 'आपका कोई आगामी अपॉइंटमेंट नहीं है।\n\nक्या आप एक बुक करना चाहेंगे?\n[BUTTONS:mainmenu]',
    te: 'మీకు రాబోయే అపాయింట్\u200Cమెంట్\u200Cలు లేవు.\n\nమీరు ఒకటి బుక్ చేయాలనుకుంటున్నారా?\n[BUTTONS:mainmenu]',
  },

  // --- Cancel Flow ---
  cancel_select: {
    en: 'Here are your upcoming appointments. Please select the one you\'d like to cancel:\n\n[BUTTONS:appointmentlist:{entries}]',
    hi: 'यहां आपके आगामी अपॉइंटमेंट हैं। कृपया जिसे रद्द करना चाहते हैं वह चुनें:\n\n[BUTTONS:appointmentlist:{entries}]',
    te: 'ఇక్కడ మీ రాబోయే అపాయింట్\u200Cమెంట్\u200Cలు ఉన్నాయి. దయచేసి మీరు రద్దు చేయాలనుకునేది ఎంచుకోండి:\n\n[BUTTONS:appointmentlist:{entries}]',
  },
  cancel_no_appts: {
    en: 'You don\'t have any active appointments at the moment.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'इस समय आपका कोई सक्रिय अपॉइंटमेंट नहीं है।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ప్రస్తుతం మీకు ఏ యాక్టివ్ అపాయింట్\u200Cమెంట్\u200Cలు లేవు.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  cancel_confirm_prompt: {
    en: 'You\'re about to cancel the following appointment:\n\n*Booking ID:* {bid}\n*Patient:* {patient}\n*Doctor:* Dr. {doctor}\n*Date:* {date}\n*Time:* {time}\n\nAre you sure you want to proceed with the cancellation?\n[BUTTONS:yesno]',
    hi: 'आप निम्न अपॉइंटमेंट रद्द करने वाले हैं:\n\n*बुकिंग ID:* {bid}\n*मरीज़:* {patient}\n*डॉक्टर:* डॉ. {doctor}\n*तारीख:* {date}\n*समय:* {time}\n\nक्या आप वाकई रद्द करना चाहते हैं?\n[BUTTONS:yesno]',
    te: 'మీరు క్రింది అపాయింట్\u200Cమెంట్\u200Cను రద్దు చేయబోతున్నారు:\n\n*బుకింగ్ ID:* {bid}\n*రోగి:* {patient}\n*డాక్టర్:* డా. {doctor}\n*తేదీ:* {date}\n*సమయం:* {time}\n\nమీరు ఖచ్చితంగా రద్దు చేయాలనుకుంటున్నారా?\n[BUTTONS:yesno]',
  },
  cancel_success: {
    en: 'Your appointment (*{bid}*) has been cancelled successfully.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'आपका अपॉइंटमेंट (*{bid}*) सफलतापूर्वक रद्द हो गया।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'మీ అపాయింట్\u200Cమెంట్ (*{bid}*) విజయవంతంగా రద్దు చేయబడింది.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  cancel_failed: {
    en: 'We apologize, but the cancellation could not be processed.\n\n*Reason:* {error}\n\nPlease try again or contact us directly.\n[BUTTONS:mainmenu]',
    hi: 'क्षमा करें, रद्दीकरण प्रक्रिया पूरी नहीं हो सकी।\n\n*कारण:* {error}\n\nकृपया फिर से कोशिश करें या हमसे सीधे संपर्क करें।\n[BUTTONS:mainmenu]',
    te: 'క్షమించండి, రద్దు ప్రక్రియ పూర్తి కాలేదు.\n\n*కారణం:* {error}\n\nదయచేసి మళ్ళీ ప్రయత్నించండి లేదా మమ్మల్ని నేరుగా సంప్రదించండి.\n[BUTTONS:mainmenu]',
  },
  cancel_declined: {
    en: 'No worries! Your appointment has not been cancelled.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'कोई बात नहीं! आपका अपॉइंटमेंट रद्द नहीं किया गया।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ఫర్వాలేదు! మీ అపాయింట్\u200Cమెంట్ రద్దు చేయబడలేదు.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  cancel_yesno_retry: {
    en: 'Would you like to proceed with the cancellation? Please select Yes or No.\n[BUTTONS:yesno]',
    hi: 'क्या आप रद्दीकरण आगे बढ़ाना चाहते हैं? कृपया हाँ या नहीं चुनें।\n[BUTTONS:yesno]',
    te: 'రద్దు కొనసాగించాలనుకుంటున్నారా? దయచేసి అవును లేదా కాదు ఎంచుకోండి.\n[BUTTONS:yesno]',
  },
  appt_not_found: {
    en: 'I couldn\'t identify the appointment. Please select one from the list above.',
    hi: 'मैं अपॉइंटमेंट पहचान नहीं सका। कृपया ऊपर दी गई सूची में से चुनें।',
    te: 'అపాయింట్\u200Cమెంట్\u200Cను గుర్తించలేకపోయాను. దయచేసి పైన ఉన్న జాబితా నుండి ఎంచుకోండి.',
  },

  // --- Reschedule Flow ---
  resched_select: {
    en: 'Here are your upcoming appointments. Please select the one you\'d like to reschedule:\n\n[BUTTONS:appointmentlist:{entries}]',
    hi: 'यहां आपके आगामी अपॉइंटमेंट हैं। कृपया जिसे रीशेड्यूल करना चाहते हैं वह चुनें:\n\n[BUTTONS:appointmentlist:{entries}]',
    te: 'ఇక్కడ మీ రాబోయే అపాయింట్\u200Cమెంట్\u200Cలు ఉన్నాయి. దయచేసి మీరు రీషెడ్యూల్ చేయాలనుకునేది ఎంచుకోండి:\n\n[BUTTONS:appointmentlist:{entries}]',
  },
  resched_no_appts: {
    en: 'You don\'t have any active appointments to reschedule at the moment.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'इस समय रीशेड्यूल के लिए कोई सक्रिय अपॉइंटमेंट नहीं है।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ప్రస్తుతం రీషెడ్యూల్ చేయడానికి ఏ యాక్టివ్ అపాయింట్\u200Cమెంట్\u200Cలు లేవు.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  resched_confirm_old: {
    en: 'You\'d like to reschedule the following appointment:\n\n*Booking ID:* {bid}\n*Patient:* {patient}\n*Doctor:* Dr. {doctor}\n*Date:* {date}\n*Time:* {time}\n\nThe current appointment will be cancelled and a new one will be booked. Would you like to proceed?\n[BUTTONS:yesno]',
    hi: 'आप निम्न अपॉइंटमेंट रीशेड्यूल करना चाहते हैं:\n\n*बुकिंग ID:* {bid}\n*मरीज़:* {patient}\n*डॉक्टर:* डॉ. {doctor}\n*तारीख:* {date}\n*समय:* {time}\n\nवर्तमान अपॉइंटमेंट रद्द होगा और नया बुक होगा। क्या आगे बढ़ना चाहते हैं?\n[BUTTONS:yesno]',
    te: 'మీరు క్రింది అపాయింట్\u200Cమెంట్\u200Cను రీషెడ్యూల్ చేయాలనుకుంటున్నారు:\n\n*బుకింగ్ ID:* {bid}\n*రోగి:* {patient}\n*డాక్టర్:* డా. {doctor}\n*తేదీ:* {date}\n*సమయం:* {time}\n\nప్రస్తుత అపాయింట్\u200Cమెంట్ రద్దు చేయబడుతుంది మరియు కొత్తది బుక్ అవుతుంది. కొనసాగించాలనుకుంటున్నారా?\n[BUTTONS:yesno]',
  },
  resched_op_valid: {
    en: 'Your OP Pass is valid with *{remaining} reschedule(s) remaining*. No additional payment will be required.\n\nPlease select the department for your new appointment:\n[BUTTONS:specialty:{specs}]',
    hi: 'आपका OP Pass मान्य है, *{remaining} रीशेड्यूल बाकी हैं*। कोई अतिरिक्त भुगतान नहीं लगेगा।\n\nकृपया नए अपॉइंटमेंट के लिए विभाग चुनें:\n[BUTTONS:specialty:{specs}]',
    te: 'మీ OP Pass చెల్లుబాటు అవుతోంది, *{remaining} రీషెడ్యూల్(లు) మిగిలి ఉన్నాయి*. అదనపు చెల్లింపు అవసరం లేదు.\n\nదయచేసి మీ కొత్త అపాయింట్\u200Cమెంట్ కోసం విభాగాన్ని ఎంచుకోండి:\n[BUTTONS:specialty:{specs}]',
  },
  resched_op_invalid: {
    en: 'We\'re sorry, but you don\'t have a valid OP Pass or you\'ve exhausted all reschedule attempts.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'क्षमा करें, आपके पास मान्य OP Pass नहीं है या सभी रीशेड्यूल प्रयास समाप्त हो गए हैं।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'క్షమించండి, మీ వద్ద చెల్లుబాటు అయ్యే OP Pass లేదు లేదా అన్ని రీషెడ్యూల్ ప్రయత్నాలు అయిపోయాయి.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  resched_yesno_retry: {
    en: 'Would you like to proceed with rescheduling? Please select Yes or No.\n[BUTTONS:yesno]',
    hi: 'क्या आप रीशेड्यूल करना चाहते हैं? कृपया हाँ या नहीं चुनें।\n[BUTTONS:yesno]',
    te: 'రీషెడ్యూల్ కొనసాగించాలనుకుంటున్నారా? దయచేసి అవును లేదా కాదు ఎంచుకోండి.\n[BUTTONS:yesno]',
  },
  resched_declined: {
    en: 'No worries! Your appointment remains unchanged.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'कोई बात नहीं! आपका अपॉइंटमेंट यथावत है।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ఫర్వాలేదు! మీ అపాయింట్\u200Cమెంట్ మారలేదు.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  resched_success: {
    en: 'Your appointment has been rescheduled successfully!\n\n*New Date:* {date}\n*New Time:* {time}\n*Doctor:* Dr. {doctor}\n\nWe look forward to seeing you. Is there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'आपका अपॉइंटमेंट सफलतापूर्वक रीशेड्यूल हो गया!\n\n*नई तारीख:* {date}\n*नया समय:* {time}\n*डॉक्टर:* डॉ. {doctor}\n\nहम आपसे मिलने के लिए उत्सुक हैं। क्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'మీ అపాయింట్\u200Cమెంట్ విజయవంతంగా రీషెడ్యూల్ అయింది!\n\n*కొత్త తేదీ:* {date}\n*కొత్త సమయం:* {time}\n*డాక్టర్:* డా. {doctor}\n\nమిమ్మల్ని చూడటానికి ఎదురు చూస్తున్నాము. మీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },
  resched_failed: {
    en: 'We apologize, but the reschedule could not be completed.\n\n*Reason:* {error}\n\nPlease try again or contact us directly.\n[BUTTONS:mainmenu]',
    hi: 'क्षमा करें, रीशेड्यूल पूरा नहीं हो सका।\n\n*कारण:* {error}\n\nकृपया फिर से कोशिश करें या हमसे सीधे संपर्क करें।\n[BUTTONS:mainmenu]',
    te: 'క్షమించండి, రీషెడ్యూల్ పూర్తి కాలేదు.\n\n*కారణం:* {error}\n\nదయచేసి మళ్ళీ ప్రయత్నించండి లేదా మమ్మల్ని నేరుగా సంప్రదించండి.\n[BUTTONS:mainmenu]',
  },
  resched_confirm_new_prompt: {
    en: 'Please review your new appointment details:\n\n*Patient:* {patient}\n*Doctor:* Dr. {doctor}\n*Department:* {spec}\n*New Date:* {date}\n*New Time:* {time}\n\nWould you like to confirm this reschedule?\n[BUTTONS:yesno]',
    hi: 'कृपया अपने नए अपॉइंटमेंट की जानकारी देखें:\n\n*मरीज़:* {patient}\n*डॉक्टर:* डॉ. {doctor}\n*विभाग:* {spec}\n*नई तारीख:* {date}\n*नया समय:* {time}\n\nक्या आप इस रीशेड्यूल की पुष्टि करना चाहते हैं?\n[BUTTONS:yesno]',
    te: 'దయచేసి మీ కొత్త అపాయింట్\u200Cమెంట్ వివరాలను సమీక్షించండి:\n\n*రోగి:* {patient}\n*డాక్టర్:* డా. {doctor}\n*విభాగం:* {spec}\n*కొత్త తేదీ:* {date}\n*కొత్త సమయం:* {time}\n\nఈ రీషెడ్యూల్\u200Cను నిర్ధారించాలనుకుంటున్నారా?\n[BUTTONS:yesno]',
  },
  resched_new_yesno_retry: {
    en: 'Would you like to confirm this reschedule? Please select Yes or No.\n[BUTTONS:yesno]',
    hi: 'क्या आप इस रीशेड्यूल की पुष्टि करना चाहते हैं? कृपया हाँ या नहीं चुनें।\n[BUTTONS:yesno]',
    te: 'ఈ రీషెడ్యూల్\u200Cను నిర్ధారించాలనుకుంటున్నారా? దయచేసి అవును లేదా కాదు ఎంచుకోండి.\n[BUTTONS:yesno]',
  },
  resched_new_declined: {
    en: 'No worries! Your original appointment remains unchanged.\n\nIs there anything else I can help you with?\n[BUTTONS:mainmenu]',
    hi: 'कोई बात नहीं! आपका मूल अपॉइंटमेंट यथावत है।\n\nक्या और कुछ मदद चाहिए?\n[BUTTONS:mainmenu]',
    te: 'ఫర్వాలేదు! మీ అసలు అపాయింట్\u200Cమెంట్ మారలేదు.\n\nమీకు ఇంకేమైనా సహాయం కావాలా?\n[BUTTONS:mainmenu]',
  },

  // --- Fallback ---
  fallback: {
    en: 'I\'m here to help! Please select an option below:\n[BUTTONS:mainmenu]',
    hi: 'मैं मदद के लिए यहां हूं! कृपया नीचे एक विकल्प चुनें:\n[BUTTONS:mainmenu]',
    te: 'నేను సహాయం కోసం ఇక్కడ ఉన్నాను! దయచేసి క్రింద ఒక ఎంపిక ఎంచుకోండి:\n[BUTTONS:mainmenu]',
  },
  fallback_error: {
    en: 'I\'m sorry, I couldn\'t process that. Please select an option below:\n[BUTTONS:mainmenu]',
    hi: 'क्षमा करें, मैं इसे प्रोसेस नहीं कर सका। कृपया नीचे एक विकल्प चुनें:\n[BUTTONS:mainmenu]',
    te: 'క్షమించండి, దాన్ని ప్రాసెస్ చేయలేకపోయాను. దయచేసి క్రింద ఒక ఎంపిక ఎంచుకోండి:\n[BUTTONS:mainmenu]',
  },
  session_warning: {
    en: '_Your session will expire in 5 minutes due to inactivity._\n\n',
    hi: '_निष्क्रियता के कारण आपका सत्र 5 मिनट में समाप्त हो जाएगा।_\n\n',
    te: '_నిష్క్రియ కారణంగా మీ సెషన్ 5 నిమిషాల్లో ముగుస్తుంది._\n\n',
  },
};

// ============================================================
// T — Button/UI label translations (from send_reply.txt)
// ============================================================

export const T: Record<string, TranslationEntry> = {
  // Main menu
  mainmenu_button: { en: 'View Options', hi: 'विकल्प देखें', te: 'ఎంపికలు చూడండి' },
  mainmenu_title: { en: 'Main Menu', hi: 'मुख्य मेनू', te: 'ప్రధాన మెనూ' },
  book_self: { en: 'Book for Self', hi: 'अपने लिए बुक करें', te: 'నా కోసం బుక్' },
  book_self_desc: { en: 'Book an appointment for yourself', hi: 'अपने लिए अपॉइंटमेंट बुक करें', te: 'మీ కోసం అపాయింట్\u200Cమెంట్ బుక్ చేయండి' },
  book_other: { en: 'Book for Someone', hi: 'किसी और के लिए', te: 'ఇతరుల కోసం బుక్' },
  book_other_desc: { en: 'Book for a family member', hi: 'परिवार के किसी सदस्य के लिए बुक करें', te: 'కుటుంబ సభ్యుని కోసం బుక్ చేయండి' },
  reschedule: { en: 'Reschedule', hi: 'रीशेड्यूल करें', te: 'రీషెడ్యూల్' },
  reschedule_desc: { en: 'Change appointment date/time', hi: 'अपॉइंटमेंट तारीख/समय बदलें', te: 'తేదీ/సమయం మార్చండి' },
  cancel: { en: 'Cancel Appointment', hi: 'रद्द करें', te: 'రద్దు చేయండి' },
  cancel_desc: { en: 'Cancel an existing appointment', hi: 'मौजूदा अपॉइंटमेंट रद्द करें', te: 'ఇప్పటి అపాయింట్\u200Cమెంట్ రద్దు చేయండి' },

  // Yes/No
  yes: { en: 'Yes', hi: 'हाँ', te: 'అవును' },
  no: { en: 'No', hi: 'नहीं', te: 'కాదు' },

  // Gender
  male: { en: 'Male', hi: 'पुरुष', te: 'పురుషుడు' },
  female: { en: 'Female', hi: 'महिला', te: 'స్త్రీ' },
  other: { en: 'Other', hi: 'अन्य', te: 'ఇతరం' },

  // Booking type
  for_self: { en: 'Book for Self', hi: 'अपने लिए', te: 'నా కోసం' },
  for_other: { en: 'Book for Other', hi: 'किसी और के लिए', te: 'ఇతరుల కోసం' },

  // Specialties
  specialties_button: { en: 'View Specialties', hi: 'विशेषताएँ देखें', te: 'స్పెషాలిటీలు' },
  specialties_title: { en: 'Specialties', hi: 'विशेषताएँ', te: 'స్పెషాలిటీలు' },

  // Doctors
  doctors_button: { en: 'View Doctors', hi: 'डॉक्टर देखें', te: 'డాక్టర్లు చూడండి' },
  doctors_title: { en: 'Doctors', hi: 'डॉक्टर', te: 'డాక్టర్లు' },

  // Dates
  dates_button: { en: 'View Dates', hi: 'तारीखें देखें', te: 'తేదీలు చూడండి' },
  dates_title: { en: 'Available Dates', hi: 'उपलब्ध तारीखें', te: 'అందుబాటు తేదీలు' },
  slots_available: { en: 'slots available', hi: 'स्लॉट उपलब्ध', te: 'స్లాట్\u200Cలు అందుబాటులో' },
  slot_available: { en: 'slot available', hi: 'स्लॉट उपलब्ध', te: 'స్లాట్ అందుబాటులో' },

  // Time slots
  timeslots_button: { en: 'View Time Slots', hi: 'समय स्लॉट देखें', te: 'సమయ స్లాట్\u200Cలు' },
  timeslots_title: { en: 'Time Slots', hi: 'समय स्लॉट', te: 'సమయ స్లాట్\u200Cలు' },
  capacity: { en: 'Capacity', hi: 'क्षमता', te: 'సామర్థ్యం' },

  // Post booking
  postbooking_button: { en: 'More Options', hi: 'और विकल्प', te: 'మరిన్ని ఎంపికలు' },
  postbooking_title: { en: 'What Next?', hi: 'आगे क्या?', te: 'తర్వాత ఏమిటి?' },
  book_another: { en: 'Book Another', hi: 'एक और बुक करें', te: 'మరొకటి బుక్' },
  book_another_desc: { en: 'Schedule a new appointment', hi: 'नया अपॉइंटमेंट शेड्यूल करें', te: 'కొత్త అపాయింట్\u200Cమెంట్ షెడ్యూల్' },
  view_appts: { en: 'View Appointments', hi: 'अपॉइंटमेंट देखें', te: 'అపాయింట్\u200Cమెంట్\u200Cలు' },
  view_appts_desc: { en: 'See all your appointments', hi: 'अपने सभी अपॉइंटमेंट देखें', te: 'మీ అన్ని అపాయింట్\u200Cమెంట్\u200Cలు చూడండి' },

  // Appointments
  appts_button: { en: 'View Appointments', hi: 'अपॉइंटमेंट देखें', te: 'అపాయింట్\u200Cమెంట్\u200Cలు' },
  appts_title: { en: 'Your Appointments', hi: 'आपके अपॉइंटमेंट', te: 'మీ అపాయింట్\u200Cమెంట్\u200Cలు' },

  // Relationship
  rel_button: { en: 'Select Relationship', hi: 'रिश्ता चुनें', te: 'సంబంధం ఎంచుకోండి' },
  rel_title: { en: 'Relationship', hi: 'रिश्ता', te: 'సంబంధం' },
  parent: { en: 'Parent', hi: 'माता-पिता', te: 'తల్లిదండ్రి' },
  spouse: { en: 'Spouse', hi: 'पति/पत्नी', te: 'భార్య/భర్త' },
  child: { en: 'Child', hi: 'बच्चा', te: 'పిల్లవాడు' },
  friend: { en: 'Friend', hi: 'दोस्त', te: 'స్నేహితుడు' },

  // Reason
  reason_button: { en: 'Select Reason', hi: 'कारण चुनें', te: 'కారణం ఎంచుకోండి' },
  reason_title: { en: 'Visit Reasons', hi: 'विज़िट कारण', te: 'సందర్శన కారణాలు' },
  general_checkup: { en: 'General Checkup', hi: 'सामान्य जांच', te: 'సాధారణ చెకప్' },
  followup: { en: 'Follow-up Visit', hi: 'फॉलो-अप विज़िट', te: 'ఫాలో-అప్' },
  new_symptoms: { en: 'New Symptoms', hi: 'नए लक्षण', te: 'కొత్త లక్షణాలు' },
  screening: { en: 'Routine Screening', hi: 'नियमित जांच', te: 'నిత్య పరీక్ష' },
  lab_results: { en: 'Lab Results Review', hi: 'लैब रिपोर्ट समीक्षा', te: 'ల్యాబ్ ఫలితాల సమీక్ష' },
  prescription_renew: { en: 'Prescription Renewal', hi: 'प्रिस्क्रिप्शन', te: 'ప్రిస్క్రిప్షన్' },
  hasmobile_yes: { en: 'Yes, they do', hi: 'हाँ, है', te: 'అవును, ఉంది' },
  hasmobile_no: { en: 'No, use mine', hi: 'नहीं, मेरा उपयोग करें', te: 'లేదు, నాది వాడండి' },
  emergency: { en: 'Emergency Concern', hi: 'आपातकालीन', te: 'అత్యవసరం' },

  // Fallback
  select_option: { en: 'Please select an option:', hi: 'कृपया एक विकल्प चुनें:', te: 'దయచేసి ఒక ఎంపిక ఎంచుకోండి:' },
  more_slots: { en: 'More time slots', hi: 'और समय स्लॉट', te: 'మరిన్ని టైమ్ స్లాట్\u200Cలు' },

  // Pay
  pay_now: { en: 'Pay Now', hi: 'भुगतान करें', te: 'చెల్లించండి' },

  // Flow
  enter_details: { en: 'Enter Details', hi: 'विवरण दर्ज करें', te: 'వివరాలు నమోదు' },
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
