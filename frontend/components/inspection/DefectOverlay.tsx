import { DefectPrediction, Severity } from "@/lib/api";

const SEVERITY_STYLES: Record<Severity, { border: string; badge: string }> = {
  critical: { border: "border-red-500", badge: "bg-red-500" },
  major: { border: "border-amber-500", badge: "bg-amber-500" },
  minor: { border: "border-yellow-400", badge: "bg-yellow-400" },
};

export function DefectOverlay({
  imageUrl,
  predictions,
}: {
  imageUrl: string;
  predictions: DefectPrediction[];
}) {
  return (
    <div className="relative inline-block rounded-lg overflow-hidden border border-neutral-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="PCB inspection" className="block max-w-full" />
      {predictions.map((p) => {
        const style = SEVERITY_STYLES[p.severity];
        return (
          <div
            key={p.id}
            className={`absolute border-2 ${style.border}`}
            style={{
              left: `${p.bounding_box.x * 100}%`,
              top: `${p.bounding_box.y * 100}%`,
              width: `${p.bounding_box.width * 100}%`,
              height: `${p.bounding_box.height * 100}%`,
            }}
          >
            <span
              className={`absolute -top-5 left-0 text-[10px] ${style.badge} text-neutral-950 px-1.5 py-0.5 rounded font-medium whitespace-nowrap`}
            >
              {p.defect_type.replace("_", " ")} · {Math.round(p.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
