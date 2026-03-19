import { describe, it, expect } from "vitest"
import {
  checkDrugInteractions,
  checkNewDrugInteraction,
  SEVERITY_CONFIG,
  type InteractionSeverity,
} from "@/lib/clinical/drug-interactions"

describe("Drug Interaction Checker", () => {
  describe("checkDrugInteractions", () => {
    it("returns empty array for fewer than 2 drugs", () => {
      expect(checkDrugInteractions([])).toEqual([])
      expect(checkDrugInteractions(["warfarin"])).toEqual([])
    })

    it("detects warfarin + aspirin interaction", () => {
      const result = checkDrugInteractions(["Warfarin", "Aspirin"])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("major")
      expect(result[0].description).toContain("bleeding")
    })

    it("detects warfarin + ibuprofen interaction", () => {
      const result = checkDrugInteractions(["warfarin", "ibuprofen"])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("major")
    })

    it("is case-insensitive", () => {
      const result = checkDrugInteractions(["WARFARIN", "aspirin"])
      expect(result).toHaveLength(1)
    })

    it("matches partial names (brand names containing generic)", () => {
      const result = checkDrugInteractions(["warfarin sodium", "aspirin 75mg"])
      expect(result).toHaveLength(1)
    })

    it("detects multiple interactions from one drug list", () => {
      const result = checkDrugInteractions(["warfarin", "aspirin", "ibuprofen"])
      // warfarin+aspirin, warfarin+ibuprofen
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it("returns no interactions for non-interacting drugs", () => {
      const result = checkDrugInteractions(["paracetamol", "amoxicillin"])
      expect(result).toHaveLength(0)
    })

    it("sorts results by severity (most severe first)", () => {
      const result = checkDrugInteractions([
        "warfarin",
        "aspirin",
        "paracetamol",
      ])
      // warfarin+aspirin is major, paracetamol+warfarin is moderate
      if (result.length >= 2) {
        const severityOrder: Record<InteractionSeverity, number> = {
          contraindicated: 0,
          major: 1,
          moderate: 2,
          minor: 3,
        }
        for (let i = 1; i < result.length; i++) {
          expect(severityOrder[result[i].severity]).toBeGreaterThanOrEqual(
            severityOrder[result[i - 1].severity]
          )
        }
      }
    })

    it("uses original drug names in output (not normalized)", () => {
      const result = checkDrugInteractions(["Warfarin 5mg", "Aspirin 75mg"])
      expect(result[0].drug1).toBe("Warfarin 5mg")
      expect(result[0].drug2).toBe("Aspirin 75mg")
    })

    it("detects atorvastatin + clarithromycin (statin interaction)", () => {
      const result = checkDrugInteractions(["atorvastatin", "clarithromycin"])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("major")
      expect(result[0].description).toContain("rhabdomyolysis")
    })

    it("detects metronidazole + alcohol interaction", () => {
      const result = checkDrugInteractions(["metronidazole", "alcohol"])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("major")
    })

    it("detects amlodipine + simvastatin interaction", () => {
      const result = checkDrugInteractions(["amlodipine", "simvastatin"])
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe("moderate")
    })
  })

  describe("checkNewDrugInteraction", () => {
    it("returns only interactions involving the new drug", () => {
      const result = checkNewDrugInteraction("aspirin", ["warfarin", "metformin"])
      expect(result.length).toBeGreaterThanOrEqual(1)
      result.forEach((interaction) => {
        const names = [interaction.drug1.toLowerCase(), interaction.drug2.toLowerCase()]
        expect(names.some((n) => n.includes("aspirin"))).toBe(true)
      })
    })

    it("returns empty if new drug has no interactions with existing", () => {
      const result = checkNewDrugInteraction("amoxicillin", ["paracetamol", "cetirizine"])
      expect(result).toHaveLength(0)
    })
  })

  describe("SEVERITY_CONFIG", () => {
    it("has all four severity levels", () => {
      const severities: InteractionSeverity[] = ["minor", "moderate", "major", "contraindicated"]
      for (const severity of severities) {
        expect(SEVERITY_CONFIG[severity]).toBeDefined()
        expect(SEVERITY_CONFIG[severity].label).toBeTruthy()
        expect(SEVERITY_CONFIG[severity].color).toBeTruthy()
        expect(SEVERITY_CONFIG[severity].bgColor).toBeTruthy()
      }
    })

    it("contraindicated is the most severe label", () => {
      expect(SEVERITY_CONFIG.contraindicated.label).toBe("Contraindicated")
    })
  })
})
