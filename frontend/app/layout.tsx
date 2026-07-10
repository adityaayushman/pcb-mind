import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import { CircuitField } from "@/components/common/CircuitField";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCBMind AI — Manufacturing Intelligence Platform",
  description: "AI-powered PCB inspection and defect detection for electronics manufacturers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          {/* Ambient depth glow + animated circuit field, behind all content */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              background:
                "radial-gradient(70% 55% at 50% -5%, hsl(var(--primary) / 0.07), transparent 70%)",
            }}
          />
          <CircuitField />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
