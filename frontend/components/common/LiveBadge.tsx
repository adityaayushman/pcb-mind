"use client";

import { useEffect, useState } from "react";

// A "Live" pill for auto-refreshing surfaces: a pulsing dot plus a relative
// "updated Ns ago" label that ticks on its own so the page it sits in doesn't
// have to re-render to keep the timestamp fresh.
export function LiveBadge({ lastUpdated }: { lastUpdated: Date | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const label = lastUpdated ? relativeShort(lastUpdated) : null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-xs">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <span className="font-medium text-foreground">Live</span>
      {label && <span className="tabular text-muted-foreground">· {label}</span>}
    </span>
  );
}

function relativeShort(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}
