"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ScanLine,
  CircuitBoard,
  CheckCircle2,
  XCircle,
  Gauge,
  Download,
  ArrowRight,
} from "lucide-react";
import { api, DashboardStats } from "@/lib/api";
import { getDefectSeverity, SEVERITY_HEX } from "@/lib/severity";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
    api
      .getMe()
      .then((p) => setCanExport(p.role === "admin" || p.role === "qa_engineer"))
      .catch(() => setCanExport(false));
  }, []);

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      await api.exportInspections(format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const breakdownData = stats
    ? Object.entries(stats.defect_breakdown)
        .map(([name, value]) => ({
          name: name.replace(/_/g, " "),
          value,
          severity: getDefectSeverity(name),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const passRate = stats?.total_inspections
    ? Math.round((stats.passed / stats.total_inspections) * 100)
    : null;

  return (
    <PageContainer>
      <SectionHeading
        eyebrow="Manufacturing intelligence"
        title="Dashboard"
        description="Quality signal across every board your team has inspected."
        actions={
          canExport && stats ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exporting !== null}
              >
                <Download /> {exporting === "csv" ? "Exporting…" : "CSV"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={exporting !== null}
              >
                <Download /> {exporting === "xlsx" ? "Exporting…" : "Excel"}
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!stats && !error && <DashboardSkeleton />}

      {stats && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Total inspections"
              value={stats.total_inspections}
              icon={<ScanLine className="size-4" />}
            />
            <StatTile
              label="Passed"
              value={stats.passed}
              accent="primary"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatTile
              label="Failed"
              value={stats.failed}
              accent="critical"
              icon={<XCircle className="size-4" />}
            />
            <StatTile
              label="Pass rate"
              value={passRate != null ? `${passRate}%` : "—"}
              accent={passRate != null && passRate >= 50 ? "primary" : "critical"}
              icon={<Gauge className="size-4" />}
              hint={passRate != null ? `${stats.passed} of ${stats.total_inspections} boards` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-medium">Defect breakdown</h2>
                <span className="font-mono text-xs text-muted-foreground">by frequency</span>
              </div>
              <div className="p-3" style={{ height: 280 }}>
                {breakdownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={breakdownData}
                      layout="vertical"
                      margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        style={{ fontFamily: "var(--font-geist-mono)" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={116}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--surface-2))" }}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: "var(--font-geist-mono)",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive={false}>
                        {breakdownData.map((entry, i) => (
                          <Cell key={i} fill={SEVERITY_HEX[entry.severity]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No defects recorded yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-medium">Yield</h2>
                <span className="font-mono text-xs text-muted-foreground">pass / fail</span>
              </div>
              <div className="flex flex-col items-center justify-center p-6">
                <PassRateRing passRate={passRate} />
                <div className="mt-6 grid w-full grid-cols-2 gap-3 text-center">
                  <div className="rounded-md border border-border bg-surface-1 py-3">
                    <p className="font-mono text-xl font-semibold text-primary tabular">{stats.passed}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-1 py-3">
                    <p className="font-mono text-xl font-semibold text-destructive tabular">{stats.failed}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Recent inspections</h2>
              <CircuitBoard className="size-4 text-muted-foreground/50" />
            </div>
            <Card className="overflow-hidden">
              {stats.recent.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No inspections yet.</p>
              ) : (
                stats.recent.map((insp, i) => (
                  <motion.div
                    key={insp.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={`/dashboard/inspections/${insp.id}`}
                      className="group flex items-center gap-4 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-surface-1"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm tabular text-foreground">
                          {new Date(insp.created_at).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {insp.defect_count} defect{insp.defect_count === 1 ? "" : "s"}
                          {insp.overall_confidence != null &&
                            ` · ${Math.round(insp.overall_confidence * 100)}% confidence`}
                        </p>
                      </div>
                      <StatusPill status={insp.status} size="sm" />
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </Link>
                  </motion.div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function PassRateRing({ passRate }: { passRate: number | null }) {
  const pct = passRate ?? 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={pct >= 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-semibold tabular">
          {passRate != null ? `${pct}%` : "—"}
        </span>
        <span className="text-xs text-muted-foreground">yield</span>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[344px] lg:col-span-3" />
        <Skeleton className="h-[344px] lg:col-span-2" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
