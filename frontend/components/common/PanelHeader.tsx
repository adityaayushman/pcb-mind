import { cn } from "@/lib/utils";

/**
 * The standard header row for a data pane (chart/list card): an optional
 * leading icon + title on the left, and an optional mono sublabel or actions
 * on the right. Extracted so every pane across the app reads identically
 * instead of each page hand-rolling the same border-b + padding block.
 */
export function PanelHeader({
  title,
  sublabel,
  icon,
  actions,
  className,
}: {
  title: string;
  sublabel?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        {title}
      </h2>
      {actions ?? (sublabel && <span className="font-mono text-xs text-muted-foreground">{sublabel}</span>)}
    </div>
  );
}
