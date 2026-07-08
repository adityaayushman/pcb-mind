import { DefectPrediction } from "@/lib/api";

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
      {predictions.map((p) => (
        <div
          key={p.id}
          className="absolute border-2 border-red-500"
          style={{
            left: `${p.bounding_box.x * 100}%`,
            top: `${p.bounding_box.y * 100}%`,
            width: `${p.bounding_box.width * 100}%`,
            height: `${p.bounding_box.height * 100}%`,
          }}
        >
          <span className="absolute -top-5 left-0 text-[10px] bg-red-500 text-neutral-950 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
            {p.defect_type.replace("_", " ")} · {Math.round(p.confidence * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
