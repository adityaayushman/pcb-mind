"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Link2,
  ImageIcon,
  Sparkles,
  Crosshair,
  Flame,
  Target,
  Gauge,
  Timer,
  Bug,
  Check,
  X,
} from "lucide-react";
import { api, Inspection, Feedback } from "@/lib/api";
import { SEVERITY_ORDER } from "@/lib/severity";
import { DefectOverlay } from "@/components/inspection/DefectOverlay";
import { PageContainer } from "@/components/common/PageContainer";
import { StatusPill } from "@/components/common/StatusPill";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const REGISTRATION_LABEL: Record<string, string> = {
  registered: "Aligned to reference",
  insufficient_features: "Alignment unavailable",
  no_golden: "No reference board",
};

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"detections" | "heatmap">("detections");
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  useEffect(() => {
    api.getInspection(id).then(setInspection).catch((e) => setError(e.message));
  }, [id]);

  async function ensureReportUrl(): Promise<string | null> {
    if (reportUrl) return reportUrl;
    setReportLoading(true);
    try {
      const { report_url } = await api.getReportUrl(id);
      setReportUrl(report_url);
      return report_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
      return null;
    } finally {
      setReportLoading(false);
    }
  }

  async function handleShowHeatmap() {
    setView("heatmap");
    if (heatmapUrl) return;
    setHeatmapLoading(true);
    try {
      const { heatmap_image_url } = await api.getHeatmapUrl(id);
      setHeatmapUrl(heatmap_image_url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate heatmap");
    } finally {
      setHeatmapLoading(false);
    }
  }

  async function handleShowAiSummary() {
    if (aiSummary) return;
    setAiSummaryLoading(true);
    try {
      const { ai_summary } = await api.getAiSummary(id);
      setAiSummary(ai_summary ?? "No summary available for this inspection.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate AI summary");
    } finally {
      setAiSummaryLoading(false);
    }
  }

  async function handleDownloadReport() {
    const url = await ensureReportUrl();
    if (url) window.open(url, "_blank");
  }

  async function handleCopyReportLink() {
    const url = await ensureReportUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Report link copied");
  }

  async function handleCopyImageLink() {
    if (!inspection) return;
    await navigator.clipboard.writeText(inspection.image_url);
    toast.success("Image link copied");
  }

  async function setFeedback(predictionId: string, value: Exclude<Feedback, null>) {
    if (!inspection) return;
    const current = inspection.predictions.find((p) => p.id === predictionId)?.feedback ?? null;
    const next: Feedback = current === value ? null : value; // click again to clear
    const apply = (fb: Feedback) =>
      setInspection((prev) =>
        prev
          ? { ...prev, predictions: prev.predictions.map((p) => (p.id === predictionId ? { ...p, feedback: fb } : p)) }
          : prev
      );
    apply(next); // optimistic
    try {
      await api.setPredictionFeedback(inspection.id, predictionId, next);
    } catch (e) {
      apply(current); // revert
      toast.error(e instanceof Error ? e.message : "Failed to save feedback");
    }
  }

  if (error) {
    return (
      <PageContainer width="lg">
        <p className="text-sm text-destructive">{error}</p>
      </PageContainer>
    );
  }

  if (!inspection) {
    return (
      <PageContainer width="2xl">
        <Skeleton className="h-8 w-64" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const sortedPredictions = [...inspection.predictions].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const passed = inspection.status === "passed";
  const hasDefects = inspection.defect_count > 0;

  return (
    <PageContainer width="2xl">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Inspection</p>
          <h1 className="mt-1.5 font-mono text-lg tabular text-foreground">{inspection.id.slice(0, 8)}</h1>
        </div>
        <StatusPill status={inspection.status} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left — the board */}
        <div>
          <Tabs value={view} onValueChange={(v) => (v === "heatmap" ? handleShowHeatmap() : setView("detections"))}>
            <TabsList>
              <TabsTrigger value="detections">
                <Crosshair /> Detections
              </TabsTrigger>
              <TabsTrigger value="heatmap" disabled={!hasDefects}>
                <Flame /> Heatmap
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-1">
            {view === "detections" ? (
              <DefectOverlay imageUrl={inspection.image_url} predictions={inspection.predictions} />
            ) : heatmapLoading ? (
              <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">
                <Flame className="mr-2 size-4 animate-pulse" /> Generating heatmap…
              </div>
            ) : heatmapUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heatmapUrl} alt="Defect confidence heatmap" className="block w-full" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">
                Heatmap unavailable.
              </div>
            )}
          </div>
        </div>

        {/* Right — the readout */}
        <div className="space-y-4">
          {/* Verdict */}
          <Card className={cn("p-5", passed ? "border-primary/30" : "border-destructive/30")}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  passed ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                )}
              >
                <Target className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{passed ? "Board passed" : "Board failed"}</p>
                <p className="text-xs text-muted-foreground">
                  {inspection.defect_count} defect{inspection.defect_count === 1 ? "" : "s"} counted toward verdict
                </p>
              </div>
            </div>
            {inspection.validation_notes.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                {inspection.validation_notes.map((note) => (
                  <li key={note} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-muted-foreground/50">—</span>
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <Metric icon={<Bug className="size-3.5" />} label="Defects" value={String(inspection.defect_count)} />
            <Metric
              icon={<Gauge className="size-3.5" />}
              label="Confidence"
              value={inspection.overall_confidence != null ? `${Math.round(inspection.overall_confidence * 100)}%` : "—"}
            />
            <Metric
              icon={<Timer className="size-3.5" />}
              label="Inference"
              value={inspection.inference_time_ms != null ? `${(inspection.inference_time_ms / 1000).toFixed(1)}s` : "—"}
            />
            <Metric
              icon={<Target className="size-3.5" />}
              label="Alignment"
              value={inspection.registration_status ? REGISTRATION_LABEL[inspection.registration_status] ?? "—" : "—"}
              small
            />
          </div>

          {/* AI summary */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-4 text-primary" /> AI summary
              </h3>
              {!aiSummary && (
                <Button variant="outline" size="sm" onClick={handleShowAiSummary} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? "Generating…" : "Generate"}
                </Button>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {aiSummary ??
                (aiSummaryLoading ? "Asking the model to summarize this inspection…" : "Generate a plain-English QA summary of this board.")}
            </p>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadReport} disabled={reportLoading} className="flex-1">
              <Download /> {reportLoading ? "Preparing…" : "PDF report"}
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopyReportLink} disabled={reportLoading} title="Copy report link">
              <Link2 />
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopyImageLink} title="Copy image link">
              <ImageIcon />
            </Button>
          </div>
        </div>
      </div>

      {/* Detected defects table */}
      {sortedPredictions.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Detected defects</h2>
              <span className="font-mono text-xs text-muted-foreground">({sortedPredictions.length})</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Confirm real defects or flag false calls — your review trains the model.
            </p>
          </div>
          <Card className="overflow-hidden">
            {sortedPredictions.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-0 hover:bg-surface-1 sm:gap-4",
                  p.is_reference_match && "opacity-45"
                )}
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: `hsl(var(--severity-${p.severity}))` }}
                />
                <SeverityBadge severity={p.severity} className="w-16 justify-center" />
                <span className="flex-1 truncate font-medium">{p.defect_type.replace(/_/g, " ")}</span>
                <span className="hidden font-mono text-xs text-muted-foreground md:inline">
                  {p.component_label ?? "—"}
                </span>
                <span className="font-mono text-sm tabular">{Math.round(p.confidence * 100)}%</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setFeedback(p.id, "confirmed")}
                    aria-label="Confirm real defect"
                    title="Real defect"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md border transition-colors",
                      p.feedback === "confirmed"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setFeedback(p.id, "rejected")}
                    aria-label="Flag false call"
                    title="False call"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md border transition-colors",
                      p.feedback === "rejected"
                        ? "border-destructive bg-destructive/15 text-destructive"
                        : "border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                    )}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function Metric({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1.5 font-mono font-semibold tabular", small ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}
