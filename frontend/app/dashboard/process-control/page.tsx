"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ShieldCheck, ShieldAlert, TriangleAlert, Sparkles, Activity } from "lucide-react";
import { api, SpcOut, PcbTemplate } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { PanelHeader } from "@/components/common/PanelHeader";
import { LiveBadge } from "@/components/common/LiveBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "var(--font-geist-mono)",
};

const METRICS = [
  { value: "fail_rate", label: "Fail rate (%)" },
  { value: "defect_rate", label: "Avg defects per board" },
];

const RANGES = [
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const REFRESH_MS = 30_000;

export default function ProcessControlPage() {
  const [data, setData] = useState<SpcOut | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [templates, setTemplates] = useState<PcbTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState("fail_rate");
  const [days, setDays] = useState(30);
  const [templateId, setTemplateId] = useState("all");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function runRootCause() {
    setAnalyzing(true);
    try {
      const { analysis } = await api.getRootCause();
      setAnalysis(analysis ?? "Couldn't generate an analysis right now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    api.listTemplates(undefined, 1000).then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let hasData = false;
    const load = async () => {
      try {
        const res = await api.getSpc(metric, days, templateId === "all" ? undefined : templateId);
        if (!active) return;
        hasData = true;
        setData(res);
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        if (active && !hasData) setError(e instanceof Error ? e.message : "Failed to load process control");
      }
    };
    setData(null);
    load();
    const id = setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [metric, days, templateId]);

  const chartData = data?.points.map((p) => ({ date: p.date, value: p.value })) ?? [];
  const ucl = data?.ucl ?? undefined;
  const drift = data?.status === "drift_detected";

  return (
    <PageContainer>
      <SectionHeading
        eyebrow="Predictive quality"
        title="Process control"
        description="Statistical control charts that flag process drift before it breaches your quality threshold."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data && <LiveBadge lastUpdated={lastUpdated} />}
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-44">
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
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-80" />
        </div>
      )}

      {data && (
        <div className="mt-8 space-y-6">
          {/* Status banner */}
          <Card
            className={
              data.status === "drift_detected"
                ? "border-destructive/40"
                : data.status === "in_control"
                  ? "border-primary/30"
                  : "border-border"
            }
          >
            <div className="flex items-start gap-4 p-5">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
                  drift ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                }`}
              >
                {drift ? <ShieldAlert className="size-6" /> : <ShieldCheck className="size-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {data.status === "drift_detected"
                    ? "Process drift detected"
                    : data.status === "in_control"
                      ? "Process in control"
                      : "Not enough data yet"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {data.status === "insufficient_data"
                    ? "Need at least 8 days of inspections to establish control limits."
                    : data.status === "drift_detected"
                      ? `${data.signals.length} drift signal${data.signals.length === 1 ? "" : "s"} — the process is trending outside its normal variation.`
                      : `${data.metric_label} is holding within control limits (center ${data.center_line}, UCL ${data.ucl}).`}
                </p>
                {data.signals.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {data.signals.slice(-5).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <TriangleAlert
                          className={`mt-0.5 size-3.5 shrink-0 ${
                            s.severity === "critical" ? "text-destructive" : "text-severity-major"
                          }`}
                        />
                        <span className="text-muted-foreground">
                          <span className="font-mono text-foreground">{format(new Date(s.date), "MMM d")}</span>{" "}
                          — {s.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* AI root-cause analysis */}
          <Card>
            <PanelHeader
              title="AI root-cause analysis"
              icon={<Sparkles className="size-4 text-primary" />}
              actions={
                <Button variant="outline" size="sm" onClick={runRootCause} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze root cause"}
                </Button>
              }
            />
            <div className="p-5">
              {analysis ? (
                <div className="prose-copilot text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {analyzing
                    ? "Reading recent defect, board, and control-chart data to find the probable cause…"
                    : "Ask the AI to diagnose what's driving the current quality signal — grounded in your defect mix, worst-performing boards, and drift signals — and recommend concrete actions."}
                </p>
              )}
            </div>
          </Card>

          {/* Control chart */}
          <Card>
            <PanelHeader
              title={`${data.metric_label} — control chart`}
              sublabel="daily · 3σ limits"
              icon={<Activity className="size-4" />}
            />
            <div className="p-3" style={{ height: 340 }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 0, right: 20, top: 12, bottom: 8 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "MMM d")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                    />
                    <Tooltip
                      labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                      formatter={(v: number) => [v, data.metric_label]}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    {data.center_line != null && (
                      <ReferenceLine
                        y={data.center_line}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />
                    )}
                    {data.ucl != null && (
                      <ReferenceLine
                        y={data.ucl}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="5 3"
                        label={{ value: "UCL", position: "right", fill: "hsl(var(--destructive))", fontSize: 10 }}
                      />
                    )}
                    {data.lcl != null && data.lcl > 0 && (
                      <ReferenceLine y={data.lcl} stroke="hsl(var(--destructive))" strokeDasharray="5 3" strokeOpacity={0.6} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={(props) => {
                        const { cx, cy, payload, index } = props;
                        const out = ucl != null && payload.value > ucl;
                        return (
                          <circle
                            key={index}
                            cx={cx}
                            cy={cy}
                            r={out ? 4 : 2.5}
                            fill={out ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                            stroke="hsl(var(--background))"
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No data in this window.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
