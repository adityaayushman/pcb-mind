"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ScanBarcode, Cpu, ArrowRight } from "lucide-react";
import { api, UnitDetail } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { StatusPill } from "@/components/common/StatusPill";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UnitDetailPage() {
  const { serial } = useParams<{ serial: string }>();
  const decoded = decodeURIComponent(serial);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getUnit(decoded).then(setUnit).catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [decoded]);

  return (
    <PageContainer width="lg">
      <Link
        href="/dashboard/traceability"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Traceability
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!unit && !error && (
        <div className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      )}

      {unit && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ScanBarcode className="size-6" />
              </span>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Unit</p>
                <h1 className="mt-1 font-mono text-xl font-semibold tabular">{unit.serial_number}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {unit.template_name ?? "No template"} · {unit.inspection_count} inspection
                  {unit.inspection_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {unit.latest_status && <StatusPill status={unit.latest_status} />}
          </div>

          {/* Inspection history */}
          <div>
            <h2 className="mb-3 text-sm font-medium">Inspection history</h2>
            <Card className="overflow-hidden">
              {unit.timeline.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No inspections recorded.</p>
              ) : (
                unit.timeline.map((t, i) => (
                  <Link
                    key={t.inspection_id}
                    href={`/dashboard/inspections/${t.inspection_id}`}
                    className="group flex items-center gap-4 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-surface-1"
                  >
                    <span className="font-mono text-xs text-muted-foreground/60">
                      #{unit.timeline.length - i}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm tabular">{new Date(t.created_at).toLocaleString()}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.defect_count} defect{t.defect_count === 1 ? "" : "s"}
                        {t.overall_confidence != null && ` · ${Math.round(t.overall_confidence * 100)}% confidence`}
                      </p>
                    </div>
                    <StatusPill status={t.status} size="sm" />
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </Link>
                ))
              )}
            </Card>
          </div>

          {/* Component genealogy */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Cpu className="size-4 text-muted-foreground" /> Component genealogy
            </h2>
            <Card className="overflow-hidden">
              {unit.genealogy.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No component data recorded for this unit.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2.5 text-left font-normal">Ref</th>
                        <th className="px-5 py-2.5 text-left font-normal">Part number</th>
                        <th className="px-5 py-2.5 text-left font-normal">Lot code</th>
                        <th className="px-5 py-2.5 text-left font-normal">Supplier</th>
                        <th className="px-5 py-2.5 text-left font-normal">Date code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unit.genealogy.map((c) => (
                        <tr key={c.component} className="border-b border-border last:border-0">
                          <td className="px-5 py-3 font-medium">{c.component}</td>
                          <td className="px-5 py-3 font-mono text-muted-foreground">{c.part_number}</td>
                          <td className="px-5 py-3 font-mono text-muted-foreground">{c.lot_code}</td>
                          <td className="px-5 py-3 text-muted-foreground">{c.supplier}</td>
                          <td className="px-5 py-3 font-mono text-muted-foreground">{c.date_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
