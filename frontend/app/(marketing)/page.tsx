import Link from "next/link";
import {
  ArrowRight,
  ScanLine,
  FileText,
  GitCompareArrows,
  CircuitBoard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFECT_MARKS = [
  { x: "22%", y: "30%", severity: "critical", label: "short 91%" },
  { x: "64%", y: "22%", severity: "major", label: "spurious copper 84%" },
  { x: "43%", y: "62%", severity: "minor", label: "mouse bite 77%" },
  { x: "78%", y: "58%", severity: "critical", label: "open circuit 88%" },
] as const;

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-trace-grid absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-20 md:pt-28 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-primary">
              <CircuitBoard className="size-3.5" />
              Manufacturing intelligence
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl lg:text-[3.4rem]">
              Catch PCB defects before they leave the line.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              PCBMind AI inspects every board with a trained defect-detection model — missing
              holes, mouse bites, opens, shorts, spurs, spurious copper — in seconds, with a
              severity-ranked verdict your QA team can act on. Not just a pass/fail stamp.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start inspecting free <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/why-pcbmind-ai">Why PCBMind</Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              6 defect classes · severity-ranked · golden-board comparison · PDF reports
            </p>
          </div>

          {/* Inspection readout visual */}
          <div className="animate-fade-up [animation-delay:150ms]">
            <div className="relative rounded-xl border border-border bg-surface-1/80 p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-xs text-muted-foreground">inspection · live</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  scanning
                </span>
              </div>
              {/* Stylized board */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-background">
                <div className="bg-trace-grid absolute inset-0 opacity-70" />
                {/* trace lines */}
                <svg className="absolute inset-0 size-full" viewBox="0 0 400 300" fill="none" aria-hidden>
                  <path d="M0 80 H120 L150 110 H400" stroke="hsl(var(--primary) / 0.35)" strokeWidth="2" />
                  <path d="M0 190 H90 L120 160 H260 L290 190 H400" stroke="hsl(var(--primary) / 0.25)" strokeWidth="2" />
                  <path d="M60 0 V70 L90 100 V300" stroke="hsl(var(--primary) / 0.2)" strokeWidth="2" />
                  <path d="M320 0 V120 L290 150 V300" stroke="hsl(var(--primary) / 0.3)" strokeWidth="2" />
                  <circle cx="150" cy="110" r="6" fill="hsl(var(--primary) / 0.35)" />
                  <circle cx="290" cy="150" r="6" fill="hsl(var(--primary) / 0.35)" />
                  <circle cx="90" cy="100" r="6" fill="hsl(var(--primary) / 0.25)" />
                </svg>
                {/* defect markers */}
                {DEFECT_MARKS.map((m) => (
                  <div key={m.label} className="absolute" style={{ left: m.x, top: m.y }}>
                    <span
                      className="block size-9 -translate-x-1/2 -translate-y-1/2 rounded-md border-2"
                      style={{ borderColor: `hsl(var(--severity-${m.severity}))` }}
                    />
                    <span
                      className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-medium text-background"
                      style={{ background: `hsl(var(--severity-${m.severity}))` }}
                    >
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              {/* readout row */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-background/60 font-mono text-center">
                <div className="p-3">
                  <p className="text-lg font-semibold text-destructive tabular">4</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">defects</p>
                </div>
                <div className="p-3">
                  <p className="text-lg font-semibold tabular">85%</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">confidence</p>
                </div>
                <div className="p-3">
                  <p className="text-lg font-semibold text-primary tabular">2.1s</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">inference</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Pipeline</p>
          <h2 className="mt-2 max-w-lg text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            From photo to verdict in one pass.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Step
              icon={<ScanLine className="size-5" />}
              n="01"
              title="Upload & detect"
              body="Upload a board photo. A YOLO model trained on 2,700 PCB images finds and localizes six classes of fabrication defect in seconds."
            />
            <Step
              icon={<GitCompareArrows className="size-5" />}
              n="02"
              title="Compare to golden"
              body="Each inspection is registered against your golden reference board — known reference artifacts get flagged, so only genuine defects count."
            />
            <Step
              icon={<FileText className="size-5" />}
              n="03"
              title="Verdict & report"
              body="Severity-ranked rules decide pass or fail, an AI summary explains it in plain English, and a PDF report is one click away."
            />
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center">
          <div>
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              Put a QA engineer&apos;s eye on every board.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free to start — create a template, upload a golden board, inspect in minutes.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/register">
              Start free <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function Step({
  icon,
  n,
  title,
  body,
}: {
  icon: React.ReactNode;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-muted-foreground/25">
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="font-mono text-xs text-muted-foreground/60">{n}</span>
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
