import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  if (value === true) return <Check className="mx-auto size-4 text-primary" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export default function WhyPcbMindAiPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Positioning</p>
      <h1 className="mt-2 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Why PCBMind AI
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
        Not another defect-detection model. A complete manufacturing intelligence platform for the
        full PCB inspection lifecycle.
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Most existing solutions stop at spotting defects in an image — high accuracy, but no
        workflow, no user management, no reporting, no way to turn a single inspection into an
        understanding of your production line. PCBMind AI integrates detection, analytics, and
        team collaboration into one platform instead of another standalone model.
      </p>

      <h2 className="mt-16 text-xl font-semibold tracking-tight md:text-2xl">
        The full inspection lifecycle
      </h2>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {WORKFLOW.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground">
              {step}
            </span>
            {i < WORKFLOW.length - 1 && (
              <ArrowRight className="size-3.5 text-muted-foreground/40" />
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-xl font-semibold tracking-tight md:text-2xl">
        What makes it different
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {DIFFERENTIATORS.map((d) => (
          <div
            key={d.title}
            className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-muted-foreground/25"
          >
            <h3 className="font-medium">{d.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-xl font-semibold tracking-tight md:text-2xl">How it compares</h2>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 text-center font-medium">Research projects</th>
                <th className="px-4 py-3 text-center font-medium">Traditional AOI</th>
                <th className="px-4 py-3 text-center font-medium text-primary">PCBMind AI</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([feature, research, aoi, pcbmind]) => (
                <tr key={feature} className="border-b border-border last:border-0">
                  <td className="px-6 py-3">{feature}</td>
                  <td className="px-4 py-3 text-center">
                    <ComparisonCell value={research} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ComparisonCell value={aoi} />
                  </td>
                  <td className="bg-primary/[0.04] px-4 py-3 text-center">
                    <ComparisonCell value={pcbmind} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-lg border border-border bg-card p-8 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            A digital quality assurance ecosystem
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Reduce manual inspection effort, centralize quality data, and turn every inspection
            into a data point your team can act on — not just a pass/fail image.
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/register">
            Start free <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}
