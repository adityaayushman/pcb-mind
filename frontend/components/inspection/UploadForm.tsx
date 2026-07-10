"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X, ScanLine } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StagedProgress } from "./StagedProgress";

export function UploadForm({ templates }: { templates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [serial, setSerial] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiDone, setApiDone] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  function clearFile() {
    setFile(null);
    setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !templateId) return;
    setLoading(true);
    setApiDone(false);
    setResultId(null);
    setError(null);
    try {
      const inspection = await api.createInspection(templateId, undefined, file, serial);
      setResultId(inspection.id);
      setApiDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="template-select">PCB template</Label>
        <Select value={templateId} onValueChange={setTemplateId} disabled={loading}>
          <SelectTrigger id="template-select">
            <SelectValue placeholder="Choose a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serial-input">
          Serial number <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="serial-input"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          disabled={loading}
          placeholder="e.g. SN-2026-1042"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Tag this board with a serial to track its full inspection history under Traceability.
        </p>
      </div>

      <div className="space-y-2">
        <Label>PCB image</Label>
        {preview ? (
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Board preview" className="mx-auto block max-h-72 object-contain" />
            {!loading && (
              <button
                type="button"
                onClick={clearFile}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
                aria-label="Remove image"
              >
                <X className="size-4" />
              </button>
            )}
            {file && (
              <p className="border-t border-border px-3 py-2 font-mono text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-surface-1/50 hover:border-muted-foreground/40 hover:bg-surface-1"
            )}
          >
            <UploadCloud className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-foreground">
              Drop a board photo here, or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">JPG or PNG · up to 10 MB</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={loading}
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <StagedProgress
          done={apiDone}
          onSettled={() => resultId && router.push(`/dashboard/inspections/${resultId}`)}
        />
      ) : (
        <Button type="submit" size="lg" disabled={!file}>
          <ScanLine /> Run inspection
        </Button>
      )}
    </form>
  );
}
