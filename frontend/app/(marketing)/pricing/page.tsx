import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Quotas mirror backend/app/core/plans.py — kept in sync by hand (small,
// rarely-changing) so this marketing page states exactly what each tier grants.
const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For a single engineer trying PCBMind on a line.",
    quota: [
      { label: "Starter templates seeded", value: "5" },
      { label: "PCB templates", value: "Up to 15" },
      { label: "Inspections / month", value: "50" },
      { label: "Golden versions per board", value: "1" },
    ],
    features: ["AI defect detection", "Golden-board comparison", "PDF reports"],
    cta: { label: "Start free", href: "/register" },
  },
  {
    name: "Pro",
    price: "$149",
    cadence: "per month",
    description: "For a QA team running continuous inspection.",
    quota: [
      { label: "Starter templates seeded", value: "40" },
      { label: "PCB templates", value: "Up to 300" },
      { label: "Inspections / month", value: "2,000" },
      { label: "Golden versions per board", value: "10" },
    ],
    features: [
      "Everything in Free",
      "Role-based access (admin / QA / operator)",
      "Analytics, Copilot & CSV/Excel export",
      "Priority support",
    ],
    cta: { label: "Start free", href: "/register" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "contact us",
    description: "For multi-line factories with unlimited scale.",
    quota: [
      { label: "Starter templates seeded", value: "150" },
      { label: "PCB templates", value: "Unlimited" },
      { label: "Inspections / month", value: "Unlimited" },
      { label: "Golden versions per board", value: "100" },
    ],
    features: [
      "Everything in Pro",
      "Custom retention & data residency",
      "SSO (coming soon)",
      "Dedicated onboarding",
    ],
    cta: { label: "Talk to us", href: "/contact" },
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Pricing</p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Start free. Scale when your line does.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
        Talk to us when you&apos;re ready to roll inspection out across your QA team.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col rounded-lg border bg-card p-6",
              tier.highlighted ? "border-primary/50 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.35)]" : "border-border"
            )}
          >
            {tier.highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Most popular
              </span>
            )}
            <h3 className="font-medium">{tier.name}</h3>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
              <span className="text-xs text-muted-foreground">{tier.cadence}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>

            {/* What you get — the concrete data limits per plan */}
            <dl className="mt-6 space-y-2 rounded-md border border-border bg-surface-1/50 p-3">
              {tier.quota.map((q) => (
                <div key={q.label} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{q.label}</dt>
                  <dd className="font-mono font-medium tabular">{q.value}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-5 flex-1 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={tier.highlighted ? "default" : "outline"}
              asChild
            >
              <Link href={tier.cta.href}>{tier.cta.label}</Link>
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
