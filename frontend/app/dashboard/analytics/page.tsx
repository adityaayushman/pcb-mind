"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Gauge, ScanLine, Clock } from "lucide-react";
import { api, AnalyticsOut, PcbTemplate } from "@/lib/api";
import { getDefectSeverity, SEVERITY_HEX } from "@/lib/severity";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { LiveBadge } from "@/components/common/LiveBadge";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "3650", label: "All time" },
];

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "var(--font-geist-mono)",
};

function periodHint(current: number | null, previous: number | null, unit: string, digits = 1) {
  if (current == null || previous == null) return undefined;
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(digits)}${unit} vs previous period`;
}

const REFRESH_MS = 30_000;

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsOut | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [templates, setTemplates] = useState<PcbTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [templateId, setTemplateId] = useState("all");

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let hasData = false;

    const load = async () => {
      try {
        const data = await api.getAnalytics(days, templateId === "all" ? undefined : templateId);
        if (!active) return;
        hasData = true;
        setStats(data);
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        if (active && !hasData) setError(e instanceof Error ? e.message : "Failed to load analytics");
      }
    };

    // Reset to the skeleton when the filters change (a genuinely different
    // query), but keep polling the current selection live otherwise.
    setStats(null);
    load();
    const id = setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [days, templateId]);

  const passRateData = stats?.daily_trend.map((d) => ({ date: d.date, pass_rate: d.pass_rate ?? 0 })) ?? [];
  const volumeData = stats?.daily_trend ?? [];
  const topDefectsData =
    stats?.top_defects.map((d) => ({
      name: d.defect_type.replace(/_/g, " "),
      value: d.count,
      severity: getDefectSeverity(d.defect_type),
    })) ?? [];

  const hasTrendData = (stats?.daily_trend.length ?? 0) > 0;

  return (
    <PageContainer>
      <SectionHeading
        eyebrow="Manufacturing intelligence"
        title="Analytics"
        description="Trends across your inspection history — is quality improving or declining?"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {stats && <LiveBadge lastUpdated={lastUpdated} />}
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!stats && !error && <AnalyticsSkeleton />}

      {stats && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Pass rate this period"
              value={stats.current_period.pass_rate != null ? `${stats.current_period.pass_rate}%` : "—"}
              accent={
                stats.current_period.pass_rate != null && stats.current_period.pass_rate >= 50
                  ? "primary"
                  : "critical"
              }
              icon={<Gauge className="size-4" />}
              hint={periodHint(stats.current_period.pass_rate, stats.previous_period.pass_rate, "pp")}
            />
            <StatTile
              label="Inspections this period"
              value={stats.current_period.total}
              icon={<ScanLine className="size-4" />}
              hint={periodHint(stats.current_period.total, stats.previous_period.total, "", 0)}
            />
            <StatTile
              label="Avg processing time"
              value={
                stats.current_period.avg_inference_time_ms != null
                  ? `${(stats.current_period.avg_inference_time_ms / 1000).toFixed(1)}s`
                  : "—"
              }
              icon={<Clock className="size-4" />}
              hint={
                stats.current_period.avg_inference_time_ms != null &&
                stats.previous_period.avg_inference_time_ms != null
                  ? periodHint(
                      stats.current_period.avg_inference_time_ms / 1000,
                      stats.previous_period.avg_inference_time_ms / 1000,
                      "s"
                    )
                  : undefined
              }
            />
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-medium">Pass rate trend</h2>
              <span className="font-mono text-xs text-muted-foreground">daily</span>
            </div>
            <div className="p-3" style={{ height: 260 }}>
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={passRateData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="passRateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "MMM d")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                    />
                    <Tooltip
                      labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                      formatter={(v: number) => [`${v}%`, "Pass rate"]}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pass_rate"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#passRateGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No inspections in this window.
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-medium">Inspection volume</h2>
                <span className="font-mono text-xs text-muted-foreground">passed / failed</span>
              </div>
              <div className="p-3" style={{ height: 260 }}>
                {hasTrendData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => format(new Date(d), "MMM d")}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                        style={{ fontFamily: "var(--font-geist-mono)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        style={{ fontFamily: "var(--font-geist-mono)" }}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--surface-2))" }}
                        labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="passed" stackId="v" fill="hsl(var(--primary))" isAnimationActive={false} />
                      <Bar
                        dataKey="failed"
                        stackId="v"
                        fill="hsl(var(--destructive))"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No inspections in this window.
                  </div>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-medium">Top defects</h2>
                <span className="font-mono text-xs text-muted-foreground">this period</span>
              </div>
              <div className="p-3" style={{ height: 260 }}>
                {topDefectsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topDefectsData}
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
                        width={100}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--surface-2))" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={16} isAnimationActive={false}>
                        {topDefectsData.map((entry, i) => (
                          <Cell key={i} fill={SEVERITY_HEX[entry.severity]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No defects in this window.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <Skeleton className="h-[292px]" />
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[292px] lg:col-span-3" />
        <Skeleton className="h-[292px] lg:col-span-2" />
      </div>
    </div>
  );
}
