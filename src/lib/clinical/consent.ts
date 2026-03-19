/**
 * Digital Consent Forms Module
 *
 * Manages informed consent for medical procedures, surgeries,
 * anesthesia, and general admission. Supports:
 * - Template-based consent generation
 * - Patient/guardian acknowledgment tracking
 * - Multilingual consent (English + Hindi)
 * - Audit trail for regulatory compliance
 */

export type ConsentType =
  | "general_admission"
  | "surgical_procedure"
  | "anesthesia"
  | "blood_transfusion"
  | "discharge_against_advice"
  | "high_risk_procedure"
  | "investigation"
  | "telemedicine"

export type ConsentStatus = "pending" | "signed" | "revoked" | "expired"

export interface ConsentForm {
  consent_id: string
  tenant_id: string
  patient_phone: string
  patient_name: string
  admission_id?: string
  surgery_id?: string

  type: ConsentType
  status: ConsentStatus

  // Content
  title: string
  body: string // The consent text shown to patient
  risks?: string[] // Specific risks disclosed
  alternatives?: string[] // Alternative treatments discussed

  // Signatory
  signed_by: string // Patient name or guardian name
  relationship?: string // "self" | "spouse" | "parent" | "guardian" | etc.
  signed_at?: string
  signed_ip?: string // IP address for digital consent

  // Witness
  witness_name?: string
  witness_role?: string // "Doctor" | "Nurse" | "Staff"

  // Doctor who explained
  explained_by: string
  explained_by_id?: string

  // Revocation
  revoked_at?: string
  revocation_reason?: string

  created_at?: string
}

// ─── Consent Templates ─────────────────────────────────────────────────

export interface ConsentTemplate {
  type: ConsentType
  title: string
  titleHi: string
  body: string
  bodyHi: string
  risks: string[]
  requiresWitness: boolean
}

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
  {
    type: "general_admission",
    title: "General Consent for Admission & Treatment",
    titleHi: "भर्ती और उपचार के लिए सामान्य सहमति",
    body: `I, the undersigned, hereby consent to admission and general medical treatment at this hospital. I understand that:

1. The medical team will conduct examinations, investigations, and treatment as deemed necessary.
2. I will be informed about any significant procedures before they are performed.
3. I have disclosed my complete medical history, allergies, and current medications.
4. I authorize the hospital to share my medical records with my insurance provider if applicable.
5. I understand that medicine and surgery involve risks and no guarantees of cure have been made.`,
    bodyHi: `मैं, अधोहस्ताक्षरकर्ता, इस अस्पताल में भर्ती होने और सामान्य चिकित्सा उपचार के लिए सहमति देता/देती हूँ। मैं समझता/समझती हूँ कि:

1. चिकित्सा दल आवश्यकतानुसार जांच, परीक्षण और उपचार करेगा।
2. कोई भी महत्वपूर्ण प्रक्रिया से पहले मुझे सूचित किया जाएगा।
3. मैंने अपना पूरा चिकित्सा इतिहास, एलर्जी और वर्तमान दवाइयां बताई हैं।
4. मैं अस्पताल को अपने बीमा प्रदाता के साथ मेरे चिकित्सा रिकॉर्ड साझा करने की अनुमति देता/देती हूँ।
5. मैं समझता/समझती हूँ कि चिकित्सा और शल्यक्रिया में जोखिम शामिल हैं और इलाज की कोई गारंटी नहीं दी गई है।`,
    risks: [],
    requiresWitness: false,
  },
  {
    type: "surgical_procedure",
    title: "Informed Consent for Surgical Procedure",
    titleHi: "शल्य प्रक्रिया के लिए सूचित सहमति",
    body: `I, the undersigned, hereby give my informed consent for the surgical procedure described by my treating doctor.

I confirm that:
1. The nature of the procedure, its purpose, and expected outcomes have been explained to me.
2. The potential risks, complications, and side effects have been discussed.
3. Alternative treatment options have been explained.
4. I have had the opportunity to ask questions and my questions have been answered satisfactorily.
5. I understand that during the procedure, unforeseen conditions may arise requiring additional procedures.
6. I consent to the administration of anesthesia as determined by the anesthesiologist.
7. I understand that no guarantee has been given regarding the results of the procedure.`,
    bodyHi: `मैं, अधोहस्ताक्षरकर्ता, अपने उपचार करने वाले चिकित्सक द्वारा वर्णित शल्य प्रक्रिया के लिए अपनी सूचित सहमति देता/देती हूँ।

मैं पुष्टि करता/करती हूँ कि:
1. प्रक्रिया की प्रकृति, उद्देश्य और अपेक्षित परिणाम मुझे समझाए गए हैं।
2. संभावित जोखिम, जटिलताएं और दुष्प्रभावों पर चर्चा की गई है।
3. वैकल्पिक उपचार विकल्प समझाए गए हैं।
4. मुझे प्रश्न पूछने का अवसर दिया गया है और मेरे प्रश्नों का संतोषजनक उत्तर दिया गया है।
5. मैं समझता/समझती हूँ कि प्रक्रिया के दौरान अप्रत्याशित स्थितियां उत्पन्न हो सकती हैं जिनमें अतिरिक्त प्रक्रियाओं की आवश्यकता हो सकती है।
6. मैं एनेस्थीसिया के प्रशासन के लिए सहमति देता/देती हूँ।
7. मैं समझता/समझती हूँ कि प्रक्रिया के परिणामों के बारे में कोई गारंटी नहीं दी गई है।`,
    risks: [
      "Bleeding",
      "Infection",
      "Adverse reaction to anesthesia",
      "Blood clots",
      "Organ/tissue damage",
      "Need for further surgery",
    ],
    requiresWitness: true,
  },
  {
    type: "anesthesia",
    title: "Consent for Anesthesia",
    titleHi: "एनेस्थीसिया के लिए सहमति",
    body: `I consent to the administration of anesthesia (general, regional, or local) as deemed appropriate by the anesthesiologist for my planned procedure.

I understand the risks associated with anesthesia including but not limited to:
- Nausea, vomiting, sore throat
- Allergic reactions
- Dental damage
- Nerve damage
- Respiratory complications
- In rare cases, serious complications including death`,
    bodyHi: `मैं अपनी नियोजित प्रक्रिया के लिए एनेस्थेसियोलॉजिस्ट द्वारा उचित समझे जाने वाले एनेस्थीसिया (सामान्य, क्षेत्रीय या स्थानीय) के प्रशासन के लिए सहमति देता/देती हूँ।

मैं एनेस्थीसिया से जुड़े जोखिमों को समझता/समझती हूँ जिनमें शामिल हैं:
- मतली, उल्टी, गले में खराश
- एलर्जी प्रतिक्रियाएं
- दांतों को नुकसान
- तंत्रिका क्षति
- श्वसन संबंधी जटिलताएं
- दुर्लभ मामलों में, मृत्यु सहित गंभीर जटिलताएं`,
    risks: [
      "Nausea and vomiting",
      "Allergic reaction",
      "Respiratory complications",
      "Nerve damage",
      "Dental damage",
    ],
    requiresWitness: true,
  },
  {
    type: "blood_transfusion",
    title: "Consent for Blood Transfusion",
    titleHi: "रक्त आधान के लिए सहमति",
    body: `I consent to receive blood or blood products as deemed necessary by my treating physician.

I understand that:
1. Blood has been cross-matched and tested for known infections.
2. Despite testing, there remains a small risk of transfusion reactions and infection transmission.
3. I have been informed about alternatives to blood transfusion.
4. I have the right to refuse blood transfusion.`,
    bodyHi: `मैं अपने उपचार चिकित्सक द्वारा आवश्यक समझे जाने पर रक्त या रक्त उत्पाद प्राप्त करने के लिए सहमति देता/देती हूँ।

मैं समझता/समझती हूँ कि:
1. रक्त का क्रॉस-मैच किया गया है और ज्ञात संक्रमणों के लिए परीक्षण किया गया है।
2. परीक्षण के बावजूद, आधान प्रतिक्रियाओं और संक्रमण संचरण का एक छोटा जोखिम बना रहता है।
3. मुझे रक्त आधान के विकल्पों के बारे में सूचित किया गया है।
4. मुझे रक्त आधान से इनकार करने का अधिकार है।`,
    risks: [
      "Transfusion reaction (fever, chills, rash)",
      "Allergic reaction",
      "Risk of infection (very rare with modern screening)",
    ],
    requiresWitness: false,
  },
  {
    type: "discharge_against_advice",
    title: "Discharge Against Medical Advice (DAMA)",
    titleHi: "चिकित्सा सलाह के विरुद्ध छुट्टी (DAMA)",
    body: `I am choosing to leave the hospital against the advice of my treating doctor(s).

I understand that:
1. My medical condition requires continued hospital treatment.
2. Leaving prematurely may result in worsening of my condition, complications, or death.
3. The hospital and doctors bear no responsibility for any consequences of this decision.
4. I take full responsibility for this decision and its consequences.
5. I have been advised about the risks and have chosen to leave despite these risks.`,
    bodyHi: `मैं अपने उपचार करने वाले चिकित्सक(कों) की सलाह के विरुद्ध अस्पताल छोड़ने का चयन कर रहा/रही हूँ।

मैं समझता/समझती हूँ कि:
1. मेरी चिकित्सा स्थिति में निरंतर अस्पताल उपचार की आवश्यकता है।
2. समय से पहले जाने से मेरी स्थिति बिगड़ सकती है, जटिलताएं हो सकती हैं, या मृत्यु हो सकती है।
3. इस निर्णय के किसी भी परिणाम के लिए अस्पताल और चिकित्सक जिम्मेदार नहीं हैं।
4. मैं इस निर्णय और इसके परिणामों की पूरी जिम्मेदारी लेता/लेती हूँ।`,
    risks: [],
    requiresWitness: true,
  },
]

// ─── Consent Status Configuration ──────────────────────────────────────

export const CONSENT_STATUS_CONFIG: Record<ConsentStatus, { label: string; color: string }> = {
  pending: { label: "Pending Signature", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  signed: { label: "Signed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  revoked: { label: "Revoked", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground" },
}

/**
 * Get the appropriate consent template for a consent type.
 */
export function getConsentTemplate(type: ConsentType): ConsentTemplate | undefined {
  return CONSENT_TEMPLATES.find((t) => t.type === type)
}

/**
 * Generate consent body text with patient-specific details filled in.
 */
export function generateConsentText(
  type: ConsentType,
  lang: "en" | "hi",
  details?: {
    procedureName?: string
    doctorName?: string
    patientName?: string
    date?: string
  }
): { title: string; body: string; risks: string[] } {
  const template = getConsentTemplate(type)
  if (!template) {
    return { title: type, body: "", risks: [] }
  }

  const title = lang === "hi" ? template.titleHi : template.title
  let body = lang === "hi" ? template.bodyHi : template.body

  // Replace placeholders if details provided
  if (details?.procedureName) {
    body = body.replace(/\{procedure\}/g, details.procedureName)
  }
  if (details?.doctorName) {
    body = body.replace(/\{doctor\}/g, details.doctorName)
  }
  if (details?.patientName) {
    body = body.replace(/\{patient\}/g, details.patientName)
  }

  return { title, body, risks: template.risks }
}
