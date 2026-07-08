"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { UploadForm } from "@/components/inspection/UploadForm";

export default function UploadPage() {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-8">New inspection</h1>
      {templates.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          No PCB templates yet —{" "}
          <Link href="/dashboard/templates" className="text-brand-500 hover:underline">
            create one
          </Link>{" "}
          and upload a Golden PCB reference before running an inspection.
        </p>
      ) : (
        <UploadForm templates={templates} />
      )}
    </main>
  );
}
