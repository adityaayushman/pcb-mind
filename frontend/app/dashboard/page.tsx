"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardStats } from "@/lib/api";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/dashboard/upload"
          className="bg-brand-500 hover:bg-brand-600 transition-colors px-4 py-2 rounded-lg font-medium text-neutral-950 text-sm"
        >
          New inspection
        </Link>
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
