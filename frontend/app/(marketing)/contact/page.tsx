import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Contact</p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Talk to us
      </h1>
      <p className="mt-4 text-muted-foreground md:text-lg">
        Questions about a Team or Enterprise plan, or want a walkthrough of the inspection
        pipeline? Reach out and we&apos;ll get back to you.
      </p>
      <Button size="lg" className="mt-10" asChild>
        <a href="mailto:adityaasahoo@gmail.com">
          <Mail /> adityaasahoo@gmail.com
        </a>
      </Button>
    </main>
  );
}
