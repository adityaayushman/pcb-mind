const DEFECTS = [
  { name: "Missing hole", severity: "major", desc: "A drilled hole expected by the design is absent." },
  { name: "Mouse bite", severity: "minor", desc: "Small semicircular notches eaten into a copper pad or trace edge." },
  { name: "Open circuit", severity: "critical", desc: "A trace that should connect two points is broken." },
  { name: "Short", severity: "critical", desc: "Two traces or pads that should be isolated are bridged." },
  { name: "Spur", severity: "minor", desc: "An unwanted stub of copper branching off a trace." },
  { name: "Spurious copper", severity: "major", desc: "Copper present where the design calls for bare substrate — a latent short risk." },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  major: "text-amber-400",
  minor: "text-yellow-300",
};

const CAPABILITIES = [
  {
    title: "Trained defect detection",
    body: "A YOLO-based model trained specifically on bare-board fabrication defects — not a generic object detector repurposed for PCBs.",
  },
  {
    title: "Severity-ranked results",
    body: "Every defect is classified critical, major, or minor, so your team knows what to fix first, not just what was found.",
  },
  {
    title: "Confidence heatmaps",
    body: "See exactly where the model found defects and how confident it was, alongside the standard bounding-box view.",
  },
  {
    title: "Golden PCB templates",
    body: "Organize inspections by board template and keep a reference library your whole team shares.",
  },
  {
    title: "Reports & export",
    body: "Per-inspection PDF reports, plus org-wide CSV/Excel export for QA leads tracking trends across every board.",
  },
  {
    title: "Role-based access",
    body: "Admins and QA engineers manage templates and export data; operators run inspections — everyone sees what they need.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-4">Features</h1>
      <p className="text-neutral-400 text-lg max-w-2xl mb-16">
        Everything you need to catch bare-board fabrication defects before they reach the next
        stage of assembly.
      </p>

      <div className="grid md:grid-cols-2 gap-8 mb-20">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="border border-neutral-800 rounded-xl p-6">
            <h3 className="font-medium mb-2">{c.title}</h3>
            <p className="text-sm text-neutral-400">{c.body}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mb-6">Defects we detect</h2>
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        {DEFECTS.map((d) => (
          <div
            key={d.name}
            className="flex items-start gap-4 px-6 py-4 border-b border-neutral-800 last:border-0"
          >
            <span className={`text-xs font-medium uppercase w-16 shrink-0 pt-0.5 ${SEVERITY_COLOR[d.severity]}`}>
              {d.severity}
            </span>
            <div>
              <p className="font-medium text-sm">{d.name}</p>
              <p className="text-sm text-neutral-500">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
