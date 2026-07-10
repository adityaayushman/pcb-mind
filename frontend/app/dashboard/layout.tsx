"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircuitBoard, LayoutDashboard, Layers, ScanLine, Sparkles, TrendingUp, GraduationCap, ScanBarcode, LogOut, Settings, Users, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/templates", label: "Templates", icon: Layers },
  { href: "/dashboard/traceability", label: "Traceability", icon: ScanBarcode },
  { href: "/dashboard/upload", label: "New inspection", icon: ScanLine },
  { href: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/dashboard/training", label: "Training", icon: GraduationCap },
  { href: "/dashboard/copilot", label: "Copilot", icon: Sparkles },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const profileChecked = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setEmail(data.session.user.email ?? null);

      // Users who signed up through email confirmation never hit the
      // register page's bootstrap call again after confirming -- self-heal
      // here so a first-ever dashboard load always has a profiles row,
      // instead of every page's own API calls 404ing forever.
      if (!profileChecked.current) {
        profileChecked.current = true;
        try {
          await api.getMe();
        } catch {
          const fallbackName =
            (data.session.user.user_metadata?.full_name as string | undefined) ||
            data.session.user.email?.split("@")[0] ||
            "New user";
          try {
            await api.bootstrap(fallbackName, `${fallbackName}'s Organization`);
          } catch {
            // best-effort -- if this also fails, individual pages' own error
            // handling surfaces it rather than blocking the whole layout
          }
        }
      }

      setChecked(true);
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

  // Client-side guard only (session lives in localStorage; middleware can't
  // read it) — the API's own 403s remain the real security boundary. This
  // just avoids a flash of a page whose data fetches are about to fail.
  if (!checked) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
              <CircuitBoard className="size-5 text-primary" />
              <span>
                PCBMind <span className="text-primary">AI</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-surface-2 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="max-w-52 truncate font-mono font-normal">
                {email ?? "Signed in"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/team">
                  <Users /> Team
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-surface-2 font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
