"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { api, DashboardStats } from "@/lib/api";
import { getDefectSeverity, SEVERITY_COLOR } from "@/lib/severity";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
    api
      .getMe()
      .then((p) => setCanExport(p.role === "admin" || p.role === "qa_engineer"))
      .catch(() => setCanExport(false));
  }, []);

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      await api.exportInspections(format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const breakdownData = stats
    ? Object.entries(stats.defect_breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value,
        severity: getDefectSeverity(name),
      }))
    : [];

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {canExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
              className="border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg text-sm"
            >
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              disabled={exporting !== null}
              className="border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg text-sm"
            >
              {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatsCard label="Total inspections" value={stats.total_inspections} />
            <StatsCard label="Passed" value={stats.passed} accent="green" />
            <StatsCard label="Failed" value={stats.failed} accent="red" />
            <StatsCard
              label="Pass rate"
              value={
                stats.total_inspections
                  ? `${Math.round((stats.passed / stats.total_inspections) * 100)}%`
                  : "—"
              }
            />
          </div>

          {breakdownData.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-medium mb-4">Defect breakdown</h2>
              <div className="border border-neutral-800 rounded-xl p-5" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" stroke="#737373" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#737373" fontSize={12} width={110} />
                    <Tooltip
                      contentStyle={{ background: "#171717", border: "1px solid #262626", fontSize: 12 }}
                      cursor={{ fill: "#262626" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {breakdownData.map((entry, i) => (
                        <Cell key={i} fill={SEVERITY_COLOR[entry.severity]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <h2 className="text-lg font-medium mb-4">Recent inspections</h2>
          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            {stats.recent.length === 0 && (
              <p className="text-neutral-500 text-sm p-6">No inspections yet.</p>
            )}
            {stats.recent.map((insp) => (
              <Link
                key={insp.id}
                href={`/dashboard/inspections/${insp.id}`}
                className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 last:border-0 hover:bg-neutral-900 transition-colors"
              >
                <span className="text-sm text-neutral-400">
                  {new Date(insp.created_at).toLocaleString()}
                </span>
                <span className="text-sm">{insp.defect_count} defect(s)</span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    insp.status === "passed"
                      ? "bg-brand-900 text-brand-500"
                      : "bg-red-950 text-red-400"
                  }`}
                >
                  {insp.status.toUpperCase()}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
