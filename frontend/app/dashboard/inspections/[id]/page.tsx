"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Inspection } from "@/lib/api";
import { DefectOverlay } from "@/components/inspection/DefectOverlay";

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getInspection(id).then(setInspection).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <main className="max-w-4xl mx-auto px-6 py-12 text-red-400">{error}</main>;
  if (!inspection) return <main className="max-w-4xl mx-auto px-6 py-12 text-neutral-500">Loading…</main>;

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

      <DefectOverlay imageUrl={inspection.image_url} predictions={inspection.predictions} />

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

      {inspection.predictions.length > 0 && (
        <div className="border border-neutral-800 rounded-xl overflow-hidden mb-8">
          {inspection.predictions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 last:border-0 text-sm"
            >
              <span>{p.defect_type.replace("_", " ")}</span>
              <span className="text-neutral-500">{p.component_label ?? "—"}</span>
              <span>{Math.round(p.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/api/inspections/${inspection.id}/report`}
        className="inline-block bg-brand-500 hover:bg-brand-600 transition-colors px-5 py-2.5 rounded-lg font-medium text-neutral-950 text-sm"
      >
        Download PDF report
      </a>
    </main>
  );
}
