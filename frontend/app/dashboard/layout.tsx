"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/upload", label: "New inspection" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setChecked(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // This guard only stops rendering client-side (sessions live in
  // localStorage, which Next.js Middleware can't read) — the API's own 403s
  // remain the real security boundary; this just avoids a flash of a page
  // that's about to fail its data fetches anyway.
  if (!checked) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-semibold text-brand-500">
              PCBMind AI
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    pathname === link.href
                      ? "bg-neutral-100 text-neutral-950 font-medium"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
