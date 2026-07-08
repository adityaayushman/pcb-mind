import Link from "next/link";

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
    <main className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-4">Pricing</h1>
      <p className="text-neutral-400 text-lg max-w-2xl mb-16">
        Start free. Talk to us when you're ready to scale across your QA team.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-xl p-6 border ${
              tier.highlighted ? "border-brand-500 bg-neutral-900" : "border-neutral-800"
            }`}
          >
            <h3 className="font-medium mb-1">{tier.name}</h3>
            <p className="text-2xl font-semibold mb-3">{tier.price}</p>
            <p className="text-sm text-neutral-400 mb-6">{tier.description}</p>
            <ul className="space-y-2 mb-6">
              {tier.features.map((f) => (
                <li key={f} className="text-sm text-neutral-300 flex items-start gap-2">
                  <span className="text-brand-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.cta.href}
              className={`block text-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tier.highlighted
                  ? "bg-brand-500 hover:bg-brand-600 text-neutral-950"
                  : "border border-neutral-700 hover:border-neutral-500"
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
