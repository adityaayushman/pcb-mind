"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, PcbTemplate } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PcbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goldenFiles, setGoldenFiles] = useState<Record<string, File | null>>({});
  const [uploadingGolden, setUploadingGolden] = useState<string | null>(null);
  const [goldenUploaded, setGoldenUploaded] = useState<Record<string, boolean>>({});

  async function loadTemplates() {
    try {
      setTemplates(await api.listTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.createTemplate(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function handleGoldenUpload(templateId: string) {
    const file = goldenFiles[templateId];
    if (!file) return;
    setUploadingGolden(templateId);
    setError(null);
    try {
      await api.uploadGoldenPcb(templateId, file);
      setGoldenFiles((prev) => ({ ...prev, [templateId]: null }));
      setGoldenUploaded((prev) => ({ ...prev, [templateId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload golden PCB");
    } finally {
      setUploadingGolden(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">PCB templates</h1>
        <Link href="/dashboard/upload" className="text-sm text-brand-500 hover:underline">
          New inspection →
        </Link>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 max-w-lg mb-12 bg-neutral-900 border border-neutral-800 rounded-xl p-6"
      >
        <h2 className="text-lg font-medium">Create a template</h2>
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Main Control Board Rev C"
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes for your team"
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors px-6 py-2.5 rounded-lg font-medium text-neutral-950"
        >
          {creating ? "Creating…" : "Create template"}
        </button>
      </form>

      <h2 className="text-lg font-medium mb-4">Existing templates</h2>
      {loading ? (
        <p className="text-neutral-500 text-sm">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-neutral-500 text-sm">No templates yet — create one above.</p>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <div key={t.id} className="border border-neutral-800 rounded-xl p-5">
              <p className="font-medium">{t.name}</p>
              {t.description && <p className="text-sm text-neutral-500 mb-3">{t.description}</p>}
              <div className="flex items-center gap-3 mt-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setGoldenFiles((prev) => ({ ...prev, [t.id]: e.target.files?.[0] ?? null }))
                  }
                  className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-100"
                />
                <button
                  onClick={() => handleGoldenUpload(t.id)}
                  disabled={!goldenFiles[t.id] || uploadingGolden === t.id}
                  className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition-colors px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  {uploadingGolden === t.id ? "Uploading…" : "Upload Golden PCB"}
                </button>
                {goldenUploaded[t.id] && (
                  <span className="text-brand-500 text-sm">Uploaded ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
