import { Severity } from "./api";

// Single source of truth for how severity is displayed across the app —
// previously it was styled four divergent ways (chart hex, text classes,
// solid badges, overlay borders). Everything below flows from the same
// tokens defined in globals.css (--severity-*), so a chart fill, a badge,
// a defect-row stripe, and a bounding box are always the same three colors.
//
// Mirrors backend/app/core/severity.py's DEFECT_SEVERITY — kept small on
// each side rather than codegen; the backend's copy is what actually gates
// pass/fail, this is the display concern.

const DEFECT_SEVERITY: Record<string, Severity> = {
  short: "critical",
  open_circuit: "critical",
  missing_hole: "major",
  spurious_copper: "major",
  other: "major",
  mouse_bite: "minor",
  spur: "minor",
};

export function getDefectSeverity(defectType: string): Severity {
  return DEFECT_SEVERITY[defectType] ?? "major";
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

// Hex values for Recharts fills / canvas / inline SVG where a Tailwind class
// can't reach. Kept in lockstep with the --severity-* tokens in globals.css.
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#ef4444",
  major: "#f59e0b",
  minor: "#facc15",
};
/** @deprecated use SEVERITY_HEX — kept as an alias so existing imports don't break. */
export const SEVERITY_COLOR = SEVERITY_HEX;

// Tailwind class fragments, driven by the severity.* colors wired in
// tailwind.config.ts. Text/border use the color at full strength; the
// soft "tint" is the same hue at low alpha for pill/stripe backgrounds.
export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-severity-critical",
  major: "text-severity-major",
  minor: "text-severity-minor",
};
export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-severity-critical",
  major: "border-severity-major",
  minor: "border-severity-minor",
};
export const SEVERITY_BG: Record<Severity, string> = {
  critical: "bg-severity-critical",
  major: "bg-severity-major",
  minor: "bg-severity-minor",
};
// Soft tinted background + matching text, for pills that sit on the app ground.
export const SEVERITY_TINT: Record<Severity, string> = {
  critical: "bg-severity-critical/12 text-severity-critical",
  major: "bg-severity-major/12 text-severity-major",
  minor: "bg-severity-minor/15 text-severity-minor",
};
