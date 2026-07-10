import { cn } from "@/lib/utils";

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
} as const;

export function PageContainer({
  children,
  width = "2xl",
  className,
}: {
  children: React.ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-6 py-10 md:py-12", WIDTHS[width], className)}>
      {children}
    </div>
  );
}
