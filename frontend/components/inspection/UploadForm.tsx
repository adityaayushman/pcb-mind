"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { StagedProgress } from "./StagedProgress";

export function UploadForm({ templates }: { templates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiDone, setApiDone] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !templateId) return;
    setLoading(true);
    setApiDone(false);
    setResultId(null);
    setError(null);
    try {
      const inspection = await api.createInspection(templateId, undefined, file);
      setResultId(inspection.id);
      setApiDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm text-neutral-400 mb-2">PCB Template</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={loading}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 disabled:opacity-50"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-neutral-400 mb-2">PCB image</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={loading}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-500 file:text-neutral-950 file:font-medium disabled:opacity-50"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-4 rounded-lg max-h-64 object-contain" />
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <StagedProgress
          done={apiDone}
          onSettled={() => resultId && router.push(`/dashboard/inspections/${resultId}`)}
        />
      ) : (
        <button
          type="submit"
          disabled={!file}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors px-6 py-2.5 rounded-lg font-medium text-neutral-950"
        >
          Run inspection
        </button>
      )}
    </form>
  );
}
