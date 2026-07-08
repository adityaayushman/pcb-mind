export function StatsCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  accent?: "neutral" | "green" | "red";
}) {
  const accentClass = {
    neutral: "text-neutral-100",
    green: "text-brand-500",
    red: "text-red-400",
  }[accent];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <p className="text-sm text-neutral-500 mb-2">{label}</p>
      <p className={`text-3xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}
