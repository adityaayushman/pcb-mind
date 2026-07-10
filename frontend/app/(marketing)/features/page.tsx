import {
  ScanLine,
  SignalHigh,
  Flame,
  Layers,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { Severity } from "@/lib/api";

const DEFECTS: { name: string; severity: Severity; desc: string }[] = [
  { name: "Missing hole", severity: "major", desc: "A drilled hole expected by the design is absent." },
  { name: "Mouse bite", severity: "minor", desc: "Small semicircular notches eaten into a copper pad or trace edge." },
  { name: "Open circuit", severity: "critical", desc: "A trace that should connect two points is broken." },
  { name: "Short", severity: "critical", desc: "Two traces or pads that should be isolated are bridged." },
  { name: "Spur", severity: "minor", desc: "An unwanted stub of copper branching off a trace." },
  { name: "Spurious copper", severity: "major", desc: "Copper present where the design calls for bare substrate — a latent short risk." },
];

const CAPABILITIES = [
  {
    icon: ScanLine,
    title: "Trained defect detection",
    body: "A YOLO-based model trained specifically on bare-board fabrication defects — not a generic object detector repurposed for PCBs.",
  },
  {
    icon: SignalHigh,
    title: "Severity-ranked results",
    body: "Every defect is classified critical, major, or minor, so your team knows what to fix first, not just what was found.",
  },
  {
    icon: Flame,
    title: "Confidence heatmaps",
    body: "See exactly where the model found defects and how confident it was, alongside the standard bounding-box view.",
  },
  {
    icon: Layers,
    title: "Golden PCB templates",
    body: "Organize inspections by board template and keep a reference library your whole team shares.",
  },
  {
    icon: FileText,
    title: "Reports & export",
    body: "Per-inspection PDF reports, plus org-wide CSV/Excel export for QA leads tracking trends across every board.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Admins and QA engineers manage templates and export data; operators run inspections — everyone sees what they need.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Capabilities</p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Features
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
        Everything you need to catch bare-board fabrication defects before they reach the next
        stage of assembly.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-muted-foreground/25"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-20 text-xl font-semibold tracking-tight md:text-2xl">Defects we detect</h2>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        {DEFECTS.map((d) => (
          <div
            key={d.name}
            className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <span
              className="mt-1 h-8 w-1 shrink-0 rounded-full"
              style={{ background: `hsl(var(--severity-${d.severity}))` }}
            />
            <SeverityBadge severity={d.severity} className="mt-0.5 w-16 justify-center" />
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
