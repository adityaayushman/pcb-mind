import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "queued" | "processing" | "passed" | "failed" | "error";

const CONFIG: Record<
  Status,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }>; spin?: boolean }
> = {
  passed: { label: "Passed", className: "bg-primary/15 text-primary", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive", icon: XCircle },
  processing: {
    label: "Processing",
    className: "bg-severity-major/15 text-severity-major",
    icon: Loader2,
    spin: true,
  },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground", icon: Clock },
  error: { label: "Error", className: "bg-destructive/15 text-destructive", icon: AlertTriangle },
};

export function StatusPill({
  status,
  className,
  size = "default",
}: {
  status: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const cfg = CONFIG[(status as Status)] ?? CONFIG.queued;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        cfg.className,
        className
      )}
    >
      <Icon className={cn(size === "sm" ? "size-3" : "size-3.5", cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
