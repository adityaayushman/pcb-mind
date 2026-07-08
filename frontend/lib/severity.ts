import { Severity } from "./api";

// Mirrors backend/app/core/severity.py's DEFECT_SEVERITY — kept in this one
// small file on each side rather than shared codegen, since it's a display
// concern here (chart bar color) and the source of truth for what actually
// gates behavior is the backend's copy.
const DEFECT_SEVERITY: Record<string, Severity> = {
  short: "critical",
  open_circuit: "critical",
  missing_hole: "major",
  spurious_copper: "major",
  other: "major",
  mouse_bite: "minor",
  spur: "minor",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ef4444",
  major: "#f59e0b",
  minor: "#facc15",
};

export function getDefectSeverity(defectType: string): Severity {
  return DEFECT_SEVERITY[defectType] ?? "major";
}
