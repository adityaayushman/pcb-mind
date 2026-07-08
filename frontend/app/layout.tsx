import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCBMind AI — Manufacturing Intelligence Platform",
  description: "AI-powered PCB inspection and defect detection for electronics manufacturers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased min-h-screen">{children}</body>
    </html>
  );
}
