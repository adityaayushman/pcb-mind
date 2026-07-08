export default function ContactPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-4">Contact us</h1>
      <p className="text-neutral-400 text-lg mb-10">
        Questions about a Team or Enterprise plan, or want a walkthrough of the inspection
        pipeline? Reach out and we'll get back to you.
      </p>
      <a
        href="mailto:hello@pcbmind.ai"
        className="inline-block bg-brand-500 hover:bg-brand-600 transition-colors px-6 py-3 rounded-lg font-medium text-neutral-950"
      >
        hello@pcbmind.ai
      </a>
    </main>
  );
}
