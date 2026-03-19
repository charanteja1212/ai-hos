/**
 * Drug interaction checking utility.
 * Uses a local database of common drug-drug interactions
 * for instant client-side checking during prescription.
 *
 * NOTE: This is a decision SUPPORT tool, not a replacement for
 * pharmacist review. Always flag interactions but don't block prescribing.
 */

export type InteractionSeverity = "minor" | "moderate" | "major" | "contraindicated"

export interface DrugInteraction {
  drug1: string
  drug2: string
  severity: InteractionSeverity
  description: string
  recommendation: string
}

// Common drug-drug interactions relevant to Indian clinical practice
// This is a subset — full checking should use a service like DrugBank API
const INTERACTIONS: DrugInteraction[] = [
  // Anticoagulants
  {
    drug1: "warfarin",
    drug2: "aspirin",
    severity: "major",
    description: "Increased risk of bleeding",
    recommendation: "Monitor INR closely. Consider alternative antiplatelet if possible.",
  },
  {
    drug1: "warfarin",
    drug2: "ibuprofen",
    severity: "major",
    description: "NSAIDs increase bleeding risk with warfarin",
    recommendation: "Avoid combination. Use paracetamol for pain relief.",
  },
  // Metformin
  {
    drug1: "metformin",
    drug2: "contrast dye",
    severity: "major",
    description: "Risk of lactic acidosis with iodinated contrast",
    recommendation: "Hold metformin 48h before and after contrast procedures.",
  },
  // Antibiotics + interactions
  {
    drug1: "ciprofloxacin",
    drug2: "theophylline",
    severity: "major",
    description: "Ciprofloxacin inhibits theophylline metabolism",
    recommendation: "Reduce theophylline dose by 30-50% or use alternative antibiotic.",
  },
  {
    drug1: "metronidazole",
    drug2: "alcohol",
    severity: "major",
    description: "Disulfiram-like reaction (nausea, vomiting, flushing)",
    recommendation: "Advise patient to avoid alcohol during and 48h after treatment.",
  },
  {
    drug1: "azithromycin",
    drug2: "amiodarone",
    severity: "major",
    description: "QT prolongation risk",
    recommendation: "Avoid combination. Monitor ECG if unavoidable.",
  },
  // ACE inhibitors
  {
    drug1: "enalapril",
    drug2: "spironolactone",
    severity: "moderate",
    description: "Risk of hyperkalemia",
    recommendation: "Monitor potassium levels. Avoid in renal impairment.",
  },
  {
    drug1: "ramipril",
    drug2: "potassium supplements",
    severity: "moderate",
    description: "Risk of hyperkalemia",
    recommendation: "Monitor serum potassium regularly.",
  },
  // Diabetes
  {
    drug1: "glimepiride",
    drug2: "fluconazole",
    severity: "moderate",
    description: "Fluconazole increases sulfonylurea levels",
    recommendation: "Monitor blood glucose closely. Consider dose reduction.",
  },
  // Statins
  {
    drug1: "atorvastatin",
    drug2: "clarithromycin",
    severity: "major",
    description: "Increased statin levels — risk of rhabdomyolysis",
    recommendation: "Use azithromycin as alternative or temporarily hold statin.",
  },
  // Common OTC
  {
    drug1: "paracetamol",
    drug2: "warfarin",
    severity: "moderate",
    description: "High-dose paracetamol may increase INR",
    recommendation: "Limit to <2g/day. Monitor INR with prolonged use.",
  },
  // Antihypertensives
  {
    drug1: "amlodipine",
    drug2: "simvastatin",
    severity: "moderate",
    description: "Amlodipine increases simvastatin exposure",
    recommendation: "Limit simvastatin to 20mg/day with amlodipine.",
  },
]

/** Normalize drug name for matching */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
}

/**
 * Check for interactions between a list of drug names.
 * Returns all found interactions sorted by severity.
 */
export function checkDrugInteractions(drugNames: string[]): DrugInteraction[] {
  if (drugNames.length < 2) return []

  const normalized = drugNames.map(normalize)
  const found: DrugInteraction[] = []

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      for (const interaction of INTERACTIONS) {
        const d1 = normalize(interaction.drug1)
        const d2 = normalize(interaction.drug2)

        const matches =
          (normalized[i].includes(d1) && normalized[j].includes(d2)) ||
          (normalized[i].includes(d2) && normalized[j].includes(d1))

        if (matches) {
          found.push({
            ...interaction,
            drug1: drugNames[i],
            drug2: drugNames[j],
          })
        }
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<InteractionSeverity, number> = {
    contraindicated: 0,
    major: 1,
    moderate: 2,
    minor: 3,
  }
  return found.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

/**
 * Check if a new drug has interactions with existing medications.
 */
export function checkNewDrugInteraction(
  newDrug: string,
  existingDrugs: string[]
): DrugInteraction[] {
  return checkDrugInteractions([newDrug, ...existingDrugs])
    .filter((i) => normalize(i.drug1) === normalize(newDrug) || normalize(i.drug2) === normalize(newDrug))
}

/** Severity metadata for UI display */
export const SEVERITY_CONFIG: Record<InteractionSeverity, { label: string; color: string; bgColor: string }> = {
  contraindicated: { label: "Contraindicated", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30" },
  major: { label: "Major", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  moderate: { label: "Moderate", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30" },
  minor: { label: "Minor", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
}
