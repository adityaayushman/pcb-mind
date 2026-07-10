"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Accent = "neutral" | "primary" | "critical";

const ACCENT_VALUE: Record<Accent, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  critical: "text-destructive",
};

/** Animated count-up for numeric values; strings render as-is. Counts from
 *  the previously shown number to the new one, so it animates on live data
 *  updates, not just the first mount. */
function AnimatedValue({ value }: { value: string | number }) {
  const [display, setDisplay] = useState<string | number>(
    typeof value === "number" ? 0 : value
  );
  const prev = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof value !== "number") {
      setDisplay(value);
      return;
    }
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    if (!inView) return;
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, reduce]);

  return (
    <span ref={ref} className="tabular">
      {display}
    </span>
  );
}

export function StatTile({
  label,
  value,
  accent = "neutral",
  hint,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  accent?: Accent;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // A brief green wash whenever the value changes on a live refresh, so an
  // update is felt, not just silently swapped. `pulse` stays 0 on first
  // render (no flash on initial load) and increments on every later change.
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((p) => p + 1);
  }, [value]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-all hover:border-muted-foreground/25",
        "shadow-[0_1px_0_0_hsl(var(--foreground)/0.05)_inset,0_1px_2px_-1px_rgb(0_0_0/0.3),0_16px_32px_-24px_rgb(0_0_0/0.55)]",
        className
      )}
    >
      {!reduce && pulse > 0 && (
        <motion.span
          key={pulse}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-primary/[0.14]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}
      <div className="relative flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <p
        className={cn(
          "relative mt-3 font-mono text-3xl font-semibold tracking-tight",
          ACCENT_VALUE[accent]
        )}
      >
        <AnimatedValue value={value} />
      </p>
      {hint && <p className="relative mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
