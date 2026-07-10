import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    description: "For trying PCBMind AI on a single production line.",
    features: ["1 organization", "Up to 3 PCB templates", "Unlimited inspections", "PDF reports"],
    cta: { label: "Start free", href: "/register" },
  },
  {
    name: "Team",
    price: "Contact us",
    description: "For QA teams running inspections across multiple lines.",
    features: [
      "Unlimited PCB templates",
      "Role-based access (admin / QA engineer / operator)",
      "CSV & Excel export",
      "Priority support",
    ],
    cta: { label: "Talk to us", href: "/contact" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Contact us",
    description: "For manufacturers with compliance and integration needs.",
    features: [
      "Everything in Team",
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
            <p className="mt-2 text-2xl font-semibold tracking-tight">{tier.price}</p>
            <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
            <ul className="mt-6 flex-1 space-y-2.5">
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
