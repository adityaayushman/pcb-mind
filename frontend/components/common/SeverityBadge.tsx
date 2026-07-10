import { Severity } from "@/lib/api";
import { SEVERITY_TINT } from "@/lib/severity";
import { cn } from "@/lib/utils";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        SEVERITY_TINT[severity],
        className
      )}
    >
      {severity}
    </span>
  );
}
