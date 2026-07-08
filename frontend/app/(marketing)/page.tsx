import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-24">
      <p className="text-brand-500 font-medium tracking-wide text-sm uppercase mb-4">
        Manufacturing Intelligence
      </p>
      <h1 className="text-5xl font-semibold tracking-tight mb-6">
        Catch PCB fabrication defects before they leave the line.
      </h1>
      <p className="text-neutral-400 text-lg max-w-2xl mb-10">
        PCBMind AI inspects every bare board with a trained defect-detection
        model — missing holes, mouse bites, opens, shorts, spurs, and
        spurious copper — in seconds, with a severity-ranked report your QA
        team can act on, not just a pass/fail stamp.
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="bg-brand-500 hover:bg-brand-600 transition-colors px-6 py-3 rounded-lg font-medium text-neutral-950"
        >
          Start free
        </Link>
        <Link
          href="/login"
          className="border border-neutral-700 hover:border-neutral-500 transition-colors px-6 py-3 rounded-lg font-medium"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
