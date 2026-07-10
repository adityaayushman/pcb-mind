import { DefectPrediction } from "@/lib/api";
import { cn } from "@/lib/utils";

export function DefectOverlay({
  imageUrl,
  predictions,
}: {
  imageUrl: string;
  predictions: DefectPrediction[];
}) {
  return (
    <div className="relative inline-block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="PCB inspection" className="block w-full" />
      {predictions.map((p) => (
        <div
          key={p.id}
          className={cn(
            "absolute rounded-[3px] border-2 shadow-[0_0_0_1px_rgb(0_0_0/0.5)]",
            p.is_reference_match && "opacity-40"
          )}
          style={{
            left: `${p.bounding_box.x * 100}%`,
            top: `${p.bounding_box.y * 100}%`,
            width: `${p.bounding_box.width * 100}%`,
            height: `${p.bounding_box.height * 100}%`,
            borderColor: `hsl(var(--severity-${p.severity}))`,
          }}
        >
          <span
            className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold text-background"
            style={{ background: `hsl(var(--severity-${p.severity}))` }}
          >
            {p.defect_type.replace(/_/g, " ")} {Math.round(p.confidence * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
