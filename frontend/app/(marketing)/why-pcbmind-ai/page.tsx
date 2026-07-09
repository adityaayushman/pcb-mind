import Link from "next/link";

const DIFFERENTIATORS = [
  {
    title: "End-to-end manufacturing platform",
    body: "Most projects stop after predicting defects. PCBMind AI manages the full lifecycle: upload, AI inspection, quality validation, reporting, analytics, and historical tracking.",
  },
  {
    title: "Enterprise SaaS architecture",
    body: "Cloud-native from the ground up — secure auth, multi-user organizations, role-based access, and an API-first design instead of a desktop app or notebook.",
  },
  {
    title: "Golden PCB comparison",
    body: "Every inspection can be checked against a verified reference board, catching missing, extra, misplaced, or misoriented components — not just surface defects.",
  },
  {
    title: "Manufacturing intelligence, not just detections",
    body: "Beyond “where is the defect,” PCBMind AI surfaces severity, likely cause, and whether a defect type is recurring across your production history.",
  },
  {
    title: "Automated inspection reports",
    body: "Every inspection produces a downloadable, shareable PDF report — annotated image, defect breakdown, confidence scores, and severity, with no manual assembly.",
  },
  {
    title: "Manufacturing analytics",
    body: "Pass rate, yield, defect trends, and common failure types tracked over time, not just per-image results that disappear after inference.",
  },
];

const WORKFLOW = [
  "Upload PCB",
  "AI inspection",
  "Defect detection",
  "Quality validation",
  "Inspection report",
  "Analytics",
  "Manufacturing insights",
];

const COMPARISON_ROWS = [
  ["AI defect detection", true, true, true],
  ["Cloud-based SaaS", false, "limited", true],
  ["User authentication & roles", false, "limited", true],
  ["Inspection dashboard", false, "basic", true],
  ["Golden PCB comparison", false, "partial", true],
  ["Automated reports", false, "basic", true],
  ["Manufacturing analytics", false, "limited", true],
  ["Historical tracking", false, "partial", true],
  ["Multi-organization support", false, false, true],
  ["API-first architecture", false, false, true],
] as const;

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-brand-500">✓</span>;
  if (value === false) return <span className="text-neutral-600">✗</span>;
  return <span className="text-neutral-400 text-xs">{value}</span>;
}

export default function WhyPcbMindAiPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-4">Why PCBMind AI</h1>
      <p className="text-neutral-400 text-lg max-w-2xl mb-6">
        Not another defect-detection model. A complete manufacturing intelligence platform for
        the full PCB inspection lifecycle.
      </p>
      <p className="text-neutral-500 max-w-2xl mb-16">
        Most existing solutions stop at spotting defects in an image — high accuracy, but no
        workflow, no user management, no reporting, no way to turn a single inspection into an
        understanding of your production line. PCBMind AI integrates detection, analytics, and
        team collaboration into one platform instead of another standalone model.
      </p>

      <h2 className="text-2xl font-semibold mb-6">The full inspection lifecycle</h2>
      <div className="flex flex-wrap items-center gap-2 mb-20">
        {WORKFLOW.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="text-sm border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-300">
              {step}
            </span>
            {i < WORKFLOW.length - 1 && <span className="text-neutral-700">→</span>}
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mb-6">What makes it different</h2>
      <div className="grid md:grid-cols-2 gap-8 mb-20">
        {DIFFERENTIATORS.map((d) => (
          <div key={d.title} className="border border-neutral-800 rounded-xl p-6">
            <h3 className="font-medium mb-2">{d.title}</h3>
            <p className="text-sm text-neutral-400">{d.body}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mb-6">How it compares</h2>
      <div className="border border-neutral-800 rounded-xl overflow-hidden mb-20 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-500">
              <th className="px-6 py-3 font-medium">Feature</th>
              <th className="px-4 py-3 font-medium text-center">Research projects</th>
              <th className="px-4 py-3 font-medium text-center">Traditional AOI</th>
              <th className="px-4 py-3 font-medium text-center text-brand-500">PCBMind AI</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(([feature, research, aoi, pcbmind]) => (
              <tr key={feature} className="border-b border-neutral-800 last:border-0">
                <td className="px-6 py-3 text-neutral-300">{feature}</td>
                <td className="px-4 py-3 text-center">
                  <ComparisonCell value={research} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ComparisonCell value={aoi} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ComparisonCell value={pcbmind} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-neutral-800 rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h3 className="font-medium mb-2">A digital quality assurance ecosystem</h3>
          <p className="text-sm text-neutral-400 max-w-xl">
            Reduce manual inspection effort, centralize quality data, and turn every inspection
            into a data point your team can act on — not just a pass/fail image.
          </p>
        </div>
        <Link
          href="/register"
          className="shrink-0 bg-brand-500 hover:bg-brand-600 transition-colors px-5 py-2.5 rounded-lg text-sm font-medium text-neutral-950"
        >
          Start free
        </Link>
      </div>
    </main>
  );
}
