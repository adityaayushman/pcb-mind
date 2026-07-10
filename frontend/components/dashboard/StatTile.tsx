"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Accent = "neutral" | "primary" | "critical";

const ACCENT_VALUE: Record<Accent, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  critical: "text-destructive",
};

/** Animated count-up for numeric values; strings render as-is. */
function AnimatedValue({ value }: { value: string | number }) {
  const [display, setDisplay] = useState<string | number>(
    typeof value === "number" ? 0 : value
  );
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof value !== "number") {
      setDisplay(value);
      return;
    }
    if (reduce || !inView) {
      if (reduce) setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
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
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-muted-foreground/25",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <p className={cn("mt-3 font-mono text-3xl font-semibold tracking-tight", ACCENT_VALUE[accent])}>
        <AnimatedValue value={value} />
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
