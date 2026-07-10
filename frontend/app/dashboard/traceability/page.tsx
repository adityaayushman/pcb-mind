"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, ScanBarcode, ArrowRight } from "lucide-react";
import { api, Unit } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { StatusPill } from "@/components/common/StatusPill";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function TraceabilityPage() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (q: string) => {
    try {
      setUnits(await api.listUnits(q || undefined));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load units");
      setUnits([]);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  return (
    <PageContainer width="lg">
      <SectionHeading
        eyebrow="Unit history"
        title="Traceability"
        description="Every serial-numbered board and its full inspection history — search a serial to trace what happened to a unit."
      />

      <div className="mt-8 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by serial number…"
            className="pl-9 font-mono"
          />
        </div>
      </div>

      <div className="mt-6">
        {units === null ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : units.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {search.trim()
              ? `No units match "${search.trim()}".`
              : "No serial-numbered units yet — add a serial when running an inspection to start tracing."}
          </p>
        ) : (
          <div className="space-y-3">
            {units.map((u) => (
              <Link key={u.id} href={`/dashboard/traceability/${encodeURIComponent(u.serial_number)}`}>
                <Card className="group flex items-center gap-4 p-5 transition-colors hover:border-muted-foreground/25 hover:bg-surface-1">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ScanBarcode className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-medium tabular">{u.serial_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {u.template_name ?? "No template"} · {u.inspection_count} inspection
                      {u.inspection_count === 1 ? "" : "s"}
                      {u.last_inspected_at && ` · last ${new Date(u.last_inspected_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {u.latest_status && <StatusPill status={u.latest_status} size="sm" />}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
