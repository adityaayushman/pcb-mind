import Link from "next/link";
import { CircuitBoard, ScanLine, GitCompareArrows, FileText } from "lucide-react";

const POINTS = [
  { icon: ScanLine, text: "Six defect classes detected in seconds, severity-ranked." },
  { icon: GitCompareArrows, text: "Every board compared against your golden reference." },
  { icon: FileText, text: "AI-written summaries and one-click PDF reports." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="bg-trace-grid absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_30%,black,transparent)]" />
        <Link href="/" className="relative flex items-center gap-2 font-semibold tracking-tight">
          <CircuitBoard className="size-5 text-primary" />
          <span>
            PCBMind <span className="text-primary">AI</span>
          </span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-balance text-2xl font-semibold tracking-tight">
            Put a QA engineer&apos;s eye on every board.
          </h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-xs text-muted-foreground/60">
          missing_hole · mouse_bite · open_circuit · short · spur · spurious_copper
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
            <CircuitBoard className="size-5 text-primary" />
            <span>
              PCBMind <span className="text-primary">AI</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
