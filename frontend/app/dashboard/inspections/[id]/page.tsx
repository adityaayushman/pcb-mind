"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Inspection, Severity } from "@/lib/api";
import { DefectOverlay } from "@/components/inspection/DefectOverlay";

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-500 text-neutral-950",
  major: "bg-amber-500 text-neutral-950",
  minor: "bg-yellow-400 text-neutral-950",
};

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"detections" | "heatmap">("detections");
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState<"report" | "image" | null>(null);

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
      setError(e instanceof Error ? e.message : "Failed to generate report");
      return null;
    } finally {
      setReportLoading(false);
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
    setCopiedLink("report");
    setTimeout(() => setCopiedLink(null), 2000);
  }

  async function handleCopyImageLink() {
    if (!inspection) return;
    await navigator.clipboard.writeText(inspection.image_url);
    setCopiedLink("image");
    setTimeout(() => setCopiedLink(null), 2000);
  }

  if (error) return <main className="max-w-4xl mx-auto px-6 py-12 text-red-400">{error}</main>;
  if (!inspection) return <main className="max-w-4xl mx-auto px-6 py-12 text-neutral-500">Loading…</main>;

  const sortedPredictions = [...inspection.predictions].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Inspection result</h1>
        <span
          className={`text-xs font-medium px-3 py-1.5 rounded ${
            inspection.status === "passed"
              ? "bg-brand-900 text-brand-500"
              : "bg-red-950 text-red-400"
          }`}
        >
          {inspection.status.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setView("detections")}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            view === "detections" ? "bg-neutral-100 text-neutral-950" : "bg-neutral-900 text-neutral-400"
          }`}
        >
          Detections
        </button>
        <button
          onClick={() => setView("heatmap")}
          disabled={!inspection.heatmap_image_url}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
            view === "heatmap" ? "bg-neutral-100 text-neutral-950" : "bg-neutral-900 text-neutral-400"
          }`}
        >
          Heatmap
        </button>
      </div>

      {view === "detections" || !inspection.heatmap_image_url ? (
        <DefectOverlay imageUrl={inspection.image_url} predictions={inspection.predictions} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={inspection.heatmap_image_url}
          alt="Defect confidence heatmap"
          className="rounded-lg border border-neutral-800 max-w-full block"
        />
      )}

      <div className="grid grid-cols-3 gap-4 my-8">
        <div>
          <p className="text-sm text-neutral-500">Defects found</p>
          <p className="text-xl font-medium">{inspection.defect_count}</p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Confidence</p>
          <p className="text-xl font-medium">
            {inspection.overall_confidence != null
              ? `${Math.round(inspection.overall_confidence * 100)}%`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Inference time</p>
          <p className="text-xl font-medium">{inspection.inference_time_ms ?? "—"} ms</p>
        </div>
      </div>

      {sortedPredictions.length > 0 && (
        <div className="border border-neutral-800 rounded-xl overflow-hidden mb-8">
          {sortedPredictions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 last:border-0 text-sm"
            >
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded uppercase ${SEVERITY_BADGE[p.severity]}`}
              >
                {p.severity}
              </span>
              <span>{p.defect_type.replace("_", " ")}</span>
              <span className="text-neutral-500">{p.component_label ?? "—"}</span>
              <span>{Math.round(p.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDownloadReport}
          disabled={reportLoading}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors px-5 py-2.5 rounded-lg font-medium text-neutral-950 text-sm"
        >
          {reportLoading ? "Preparing…" : "Download PDF report"}
        </button>
        <button
          onClick={handleCopyReportLink}
          disabled={reportLoading}
          className="border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 transition-colors px-4 py-2.5 rounded-lg text-sm"
        >
          {copiedLink === "report" ? "Copied ✓" : "Copy report link"}
        </button>
        <button
          onClick={handleCopyImageLink}
          className="border border-neutral-700 hover:border-neutral-500 transition-colors px-4 py-2.5 rounded-lg text-sm"
        >
          {copiedLink === "image" ? "Copied ✓" : "Copy image link"}
        </button>
      </div>
    </main>
  );
}
