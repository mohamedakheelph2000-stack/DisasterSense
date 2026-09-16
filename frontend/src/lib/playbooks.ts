export type HazardType = "flood" | "landslide";
export type SeverityLevel = "critical" | "high" | "moderate" | "low";

export interface PlaybookGuidance {
  hazard: HazardType;
  level: SeverityLevel;
  instructions: string[];
}

const PLAYBOOKS: Record<HazardType, Record<SeverityLevel, string[]>> = {
  flood: {
    critical: [
      "Move to safer/higher ground immediately.",
      "Follow official evacuation instructions without delay.",
      "Do not walk or drive through floodwaters.",
      "Monitor official emergency communications continuously."
    ],
    high: [
      "Prepare for potential evacuation.",
      "Move essential documents and medication to higher ground.",
      "Avoid traveling through low-lying areas.",
      "Monitor official emergency communications."
    ],
    moderate: [
      "Stay alert and monitor local weather updates.",
      "Clear drainage paths around your property.",
      "Avoid parking vehicles near water bodies."
    ],
    low: [
      "No immediate action required.",
      "Maintain general situational awareness."
    ]
  },
  landslide: {
    critical: [
      "Evacuate immediately if instructed by authorities.",
      "Move away from unstable slopes or steep terrain.",
      "Do not approach an active slide area.",
      "Monitor official emergency communications continuously."
    ],
    high: [
      "Avoid recently affected roads or slopes.",
      "Watch for signs of additional land movement.",
      "Prepare essential items in case of rapid evacuation.",
      "Monitor official emergency communications."
    ],
    moderate: [
      "Be aware of changing ground conditions.",
      "Avoid driving through steep hilly areas during heavy rain.",
      "Stay alert to local authority warnings."
    ],
    low: [
      "No immediate action required.",
      "Maintain general situational awareness."
    ]
  }
};

export function getSafetyGuidance(hazard: HazardType, severity: SeverityLevel): string[] {
  return PLAYBOOKS[hazard]?.[severity] || ["Follow local authority instructions."];
}
