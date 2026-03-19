/**
 * ICD-10 code search utility.
 * Provides a local subset of commonly used ICD-10 codes
 * for instant autocomplete during diagnosis entry.
 *
 * NOTE: For comprehensive coding, integrate with WHO ICD-10 API
 * or a full code database. This covers the most frequent codes
 * encountered in Indian clinical practice.
 */

export interface ICD10Code {
  code: string
  description: string
  category: string
}

// High-frequency ICD-10 codes for Indian clinical practice
// Organized by category for quick browsing
const ICD10_DATABASE: ICD10Code[] = [
  // Infectious diseases (common in India)
  { code: "A01.0", description: "Typhoid fever", category: "Infectious" },
  { code: "A09", description: "Infectious gastroenteritis and colitis, unspecified", category: "Infectious" },
  { code: "A15.0", description: "Tuberculosis of lung", category: "Infectious" },
  { code: "A90", description: "Dengue fever [classical dengue]", category: "Infectious" },
  { code: "A91", description: "Dengue haemorrhagic fever", category: "Infectious" },
  { code: "B50.9", description: "Plasmodium falciparum malaria, unspecified", category: "Infectious" },
  { code: "B54", description: "Unspecified malaria", category: "Infectious" },
  { code: "B17.1", description: "Acute hepatitis C", category: "Infectious" },
  { code: "B18.1", description: "Chronic viral hepatitis B", category: "Infectious" },
  { code: "B20", description: "Human immunodeficiency virus [HIV] disease", category: "Infectious" },

  // Diabetes
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia", category: "Endocrine" },
  { code: "E11.40", description: "Type 2 diabetes mellitus with diabetic neuropathy", category: "Endocrine" },
  { code: "E11.21", description: "Type 2 diabetes mellitus with diabetic nephropathy", category: "Endocrine" },
  { code: "E11.319", description: "Type 2 diabetes with unspecified diabetic retinopathy", category: "Endocrine" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications", category: "Endocrine" },
  { code: "E03.9", description: "Hypothyroidism, unspecified", category: "Endocrine" },
  { code: "E05.90", description: "Thyrotoxicosis, unspecified", category: "Endocrine" },
  { code: "E78.5", description: "Dyslipidemia, unspecified", category: "Endocrine" },
  { code: "E66.01", description: "Morbid obesity due to excess calories", category: "Endocrine" },

  // Cardiovascular
  { code: "I10", description: "Essential (primary) hypertension", category: "Cardiovascular" },
  { code: "I11.9", description: "Hypertensive heart disease without heart failure", category: "Cardiovascular" },
  { code: "I20.9", description: "Angina pectoris, unspecified", category: "Cardiovascular" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified", category: "Cardiovascular" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "I48.91", description: "Unspecified atrial fibrillation", category: "Cardiovascular" },
  { code: "I50.9", description: "Heart failure, unspecified", category: "Cardiovascular" },
  { code: "I63.9", description: "Cerebral infarction, unspecified", category: "Cardiovascular" },
  { code: "I64", description: "Stroke, not specified as haemorrhage or infarction", category: "Cardiovascular" },
  { code: "I73.9", description: "Peripheral vascular disease, unspecified", category: "Cardiovascular" },

  // Respiratory
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { code: "J12.89", description: "Other viral pneumonia", category: "Respiratory" },
  { code: "J18.9", description: "Pneumonia, unspecified organism", category: "Respiratory" },
  { code: "J20.9", description: "Acute bronchitis, unspecified", category: "Respiratory" },
  { code: "J44.1", description: "Chronic obstructive pulmonary disease with acute exacerbation", category: "Respiratory" },
  { code: "J45.20", description: "Mild intermittent asthma, uncomplicated", category: "Respiratory" },
  { code: "J45.50", description: "Severe persistent asthma, uncomplicated", category: "Respiratory" },
  { code: "J96.00", description: "Acute respiratory failure, unspecified", category: "Respiratory" },

  // GI
  { code: "K21.0", description: "Gastro-esophageal reflux disease with esophagitis", category: "GI" },
  { code: "K25.9", description: "Gastric ulcer, unspecified", category: "GI" },
  { code: "K29.70", description: "Gastritis, unspecified, without bleeding", category: "GI" },
  { code: "K35.80", description: "Unspecified acute appendicitis", category: "GI" },
  { code: "K40.90", description: "Unilateral inguinal hernia, without obstruction or gangrene", category: "GI" },
  { code: "K74.60", description: "Unspecified cirrhosis of liver", category: "GI" },
  { code: "K80.20", description: "Calculus of gallbladder without cholecystitis", category: "GI" },
  { code: "K92.2", description: "Gastrointestinal haemorrhage, unspecified", category: "GI" },

  // Renal
  { code: "N17.9", description: "Acute kidney failure, unspecified", category: "Renal" },
  { code: "N18.9", description: "Chronic kidney disease, unspecified", category: "Renal" },
  { code: "N18.3", description: "Chronic kidney disease, stage 3", category: "Renal" },
  { code: "N18.5", description: "Chronic kidney disease, stage 5", category: "Renal" },
  { code: "N20.0", description: "Calculus of kidney", category: "Renal" },
  { code: "N39.0", description: "Urinary tract infection, site not specified", category: "Renal" },

  // Musculoskeletal
  { code: "M54.5", description: "Low back pain", category: "Musculoskeletal" },
  { code: "M17.9", description: "Osteoarthritis of knee, unspecified", category: "Musculoskeletal" },
  { code: "M79.3", description: "Panniculitis, unspecified", category: "Musculoskeletal" },
  { code: "M81.0", description: "Age-related osteoporosis without current pathological fracture", category: "Musculoskeletal" },

  // Mental health
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified", category: "Mental Health" },
  { code: "F41.1", description: "Generalized anxiety disorder", category: "Mental Health" },
  { code: "F10.20", description: "Alcohol dependence, uncomplicated", category: "Mental Health" },

  // Obstetric
  { code: "O80", description: "Encounter for full-term uncomplicated delivery", category: "Obstetric" },
  { code: "O24.419", description: "Gestational diabetes mellitus in pregnancy, unspecified", category: "Obstetric" },
  { code: "O13.9", description: "Gestational hypertension without significant proteinuria", category: "Obstetric" },
  { code: "O14.90", description: "Unspecified pre-eclampsia", category: "Obstetric" },
  { code: "O99.019", description: "Anaemia complicating pregnancy, unspecified trimester", category: "Obstetric" },

  // Anaemia (very common in India)
  { code: "D50.9", description: "Iron deficiency anaemia, unspecified", category: "Blood" },
  { code: "D64.9", description: "Anaemia, unspecified", category: "Blood" },
  { code: "D56.1", description: "Beta thalassemia", category: "Blood" },

  // Injuries
  { code: "S06.0", description: "Concussion", category: "Injury" },
  { code: "S52.509A", description: "Unspecified fracture of the lower end of radius", category: "Injury" },
  { code: "S72.009A", description: "Fracture of unspecified part of neck of femur", category: "Injury" },
  { code: "T78.2", description: "Anaphylactic shock, unspecified", category: "Injury" },

  // Neoplasms (common types)
  { code: "C50.919", description: "Malignant neoplasm of unspecified site of breast", category: "Neoplasm" },
  { code: "C34.90", description: "Malignant neoplasm of unspecified part of bronchus or lung", category: "Neoplasm" },
  { code: "C53.9", description: "Malignant neoplasm of cervix uteri, unspecified", category: "Neoplasm" },

  // Skin
  { code: "L30.9", description: "Dermatitis, unspecified", category: "Skin" },
  { code: "L50.9", description: "Urticaria, unspecified", category: "Skin" },
  { code: "B35.4", description: "Tinea corporis", category: "Skin" },

  // Eye
  { code: "H10.9", description: "Unspecified conjunctivitis", category: "Eye" },
  { code: "H25.9", description: "Unspecified age-related cataract", category: "Eye" },

  // General symptoms
  { code: "R50.9", description: "Fever, unspecified", category: "Symptoms" },
  { code: "R10.9", description: "Unspecified abdominal pain", category: "Symptoms" },
  { code: "R05.9", description: "Cough, unspecified", category: "Symptoms" },
  { code: "R51.9", description: "Headache, unspecified", category: "Symptoms" },
  { code: "R42", description: "Dizziness and giddiness", category: "Symptoms" },
  { code: "R11.10", description: "Vomiting, unspecified", category: "Symptoms" },
  { code: "R19.7", description: "Diarrhoea, unspecified", category: "Symptoms" },
  { code: "R06.02", description: "Shortness of breath", category: "Symptoms" },
  { code: "R07.9", description: "Chest pain, unspecified", category: "Symptoms" },
  { code: "R00.0", description: "Tachycardia, unspecified", category: "Symptoms" },
]

/**
 * Search ICD-10 codes by keyword or code prefix.
 * Matches against both code and description.
 * Returns up to `limit` results (default 10).
 */
export function searchICD10(query: string, limit = 10): ICD10Code[] {
  if (!query || query.trim().length === 0) return []

  const q = query.toLowerCase().trim()

  // Score each code for relevance
  const scored = ICD10_DATABASE.map((entry) => {
    const codeLower = entry.code.toLowerCase()
    const descLower = entry.description.toLowerCase()

    let score = 0

    // Exact code match (highest priority)
    if (codeLower === q) score += 100
    // Code starts with query (e.g., "E11" matches E11.*)
    else if (codeLower.startsWith(q)) score += 80
    // Code contains query
    else if (codeLower.includes(q)) score += 60

    // Description exact word match
    const words = q.split(/\s+/)
    const allWordsMatch = words.every((w) => descLower.includes(w))
    if (allWordsMatch) score += 40

    // Partial description match
    if (descLower.includes(q)) score += 30

    // Category match
    if (entry.category.toLowerCase().includes(q)) score += 10

    return { entry, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry)
}

/**
 * Get all unique categories from the database.
 */
export function getICD10Categories(): string[] {
  return [...new Set(ICD10_DATABASE.map((e) => e.category))].sort()
}

/**
 * Get codes by category.
 */
export function getICD10ByCategory(category: string): ICD10Code[] {
  return ICD10_DATABASE.filter((e) => e.category === category)
}

/**
 * Validate if a string looks like an ICD-10 code format.
 * Format: Letter + 2 digits, optionally followed by . and more digits/letters.
 */
export function isValidICD10Format(code: string): boolean {
  return /^[A-Z]\d{2}(\.\d{1,4}[A-Z]?)?$/i.test(code.trim())
}
