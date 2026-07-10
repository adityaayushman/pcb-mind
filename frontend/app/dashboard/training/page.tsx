"use client";

import { useEffect, useState } from "react";
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
import { GraduationCap, Download, CheckCircle2, XCircle, Percent, ClipboardCheck } from "lucide-react";
import { api, TrainingSummary } from "@/lib/api";
import { getDefectSeverity, SEVERITY_HEX } from "@/lib/severity";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { PanelHeader } from "@/components/common/PanelHeader";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "var(--font-geist-mono)",
};

export default function TrainingPage() {
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .getTrainingSummary()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load training data"));
    api
      .getMe()
      .then((p) => setCanExport(p.role === "admin" || p.role === "qa_engineer"))
      .catch(() => setCanExport(false));
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportTrainingData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const fcrData =
    summary?.by_defect_type
      .filter((d) => d.false_call_rate != null)
      .map((d) => ({
        name: d.defect_type.replace(/_/g, " "),
        value: d.false_call_rate as number,
        severity: getDefectSeverity(d.defect_type),
      }))
      .sort((a, b) => b.value - a.value) ?? [];

  return (
    <PageContainer>
      <SectionHeading
        eyebrow="Continuous learning"
        title="Model training"
        description="Every defect your team confirms or rejects becomes a labeled example — the review that teaches the model your boards."
        actions={
          canExport && summary ? (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download /> {exporting ? "Exporting…" : "Download dataset"}
            </Button>
          ) : undefined
        }
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!summary && !error && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {summary && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Review coverage"
              value={summary.coverage_percent != null ? `${summary.coverage_percent}%` : "—"}
              accent="primary"
              icon={<ClipboardCheck className="size-4" />}
              hint={`${summary.reviewed} of ${summary.total_predictions} detections`}
            />
            <StatTile
              label="Confirmed"
              value={summary.confirmed}
              accent="primary"
              icon={<CheckCircle2 className="size-4" />}
              hint="verified real defects"
            />
            <StatTile
              label="False calls"
              value={summary.rejected}
              accent="critical"
              icon={<XCircle className="size-4" />}
              hint="flagged as not real"
            />
            <StatTile
              label="False-call rate"
              value={
                summary.false_call_rate_percent != null ? `${summary.false_call_rate_percent}%` : "—"
              }
              accent={
                summary.false_call_rate_percent != null && summary.false_call_rate_percent > 25
                  ? "critical"
                  : "neutral"
              }
              icon={<Percent className="size-4" />}
              hint="of reviewed detections"
            />
          </div>

          <Card>
            <PanelHeader
              title="False-call rate by defect type"
              sublabel="where the model over-calls"
              icon={<Percent className="size-4" />}
            />
            <div className="p-3" style={{ height: 300 }}>
              {fcrData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fcrData} layout="vertical" margin={{ left: 8, right: 32, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--surface-2))" }}
                      formatter={(v: number) => [`${v}%`, "False-call rate"]}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive={false}>
                      {fcrData.map((entry, i) => (
                        <Cell key={i} fill={SEVERITY_HEX[entry.severity]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No reviewed detections yet — confirm or reject defects on any inspection to begin.
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="Per-defect breakdown" icon={<ClipboardCheck className="size-4" />} />
            <div className="flex items-center gap-4 border-b border-border px-5 py-2.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Defect type</span>
              <span className="w-16 text-right">Total</span>
              <span className="w-20 text-right">Confirmed</span>
              <span className="w-20 text-right">False calls</span>
            </div>
            {summary.by_defect_type.map((d) => (
              <div
                key={d.defect_type}
                className="flex items-center gap-4 border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <span className="flex-1 font-medium">{d.defect_type.replace(/_/g, " ")}</span>
                <span className="w-16 text-right font-mono tabular text-muted-foreground">{d.total}</span>
                <span className="w-20 text-right font-mono tabular text-primary">{d.confirmed}</span>
                <span className="w-20 text-right font-mono tabular text-destructive">{d.rejected}</span>
              </div>
            ))}
          </Card>

          <p className="text-xs leading-relaxed text-muted-foreground">
            The model retrains periodically on these verified examples: confirmed defects reinforce true
            detections, and false calls teach it to stop over-flagging. Download the dataset to hand it to
            your ML pipeline.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
