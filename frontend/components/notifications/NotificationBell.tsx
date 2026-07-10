"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, XCircle, AlertTriangle, CircuitBoard, CheckCheck, ShieldAlert } from "lucide-react";
import { api, AppNotification } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const TYPE_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  inspection_passed: { icon: CheckCircle2, tint: "text-primary" },
  inspection_failed: { icon: XCircle, tint: "text-destructive" },
  inspection_error: { icon: AlertTriangle, tint: "text-severity-major" },
  golden_ready: { icon: CircuitBoard, tint: "text-primary" },
  process_drift: { icon: ShieldAlert, tint: "text-destructive" },
};

const POLL_MS = 45_000;

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setItems(data.items);
      setUnread(data.unread_count);
    } catch {
      // header bell is best-effort; a failed poll shouldn't surface an error
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function handleClick(n: AppNotification) {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.markNotificationRead(n.id).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      load();
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => {
              const cfg = TYPE_ICON[n.type] ?? { icon: Bell, tint: "text-muted-foreground" };
              const Icon = cfg.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-1",
                    !n.is_read && "bg-primary/[0.04]"
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", cfg.tint)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{n.title}</span>
                      {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
