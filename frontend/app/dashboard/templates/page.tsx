"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, UploadCloud, CheckCircle2 } from "lucide-react";
import { api, PcbTemplate } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PcbTemplate[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [goldenFiles, setGoldenFiles] = useState<Record<string, File | null>>({});
  const [uploadingGolden, setUploadingGolden] = useState<string | null>(null);
  const [goldenUploaded, setGoldenUploaded] = useState<Record<string, boolean>>({});

  async function loadTemplates() {
    try {
      setTemplates(await api.listTemplates());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createTemplate(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      toast.success("Template created");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function handleGoldenUpload(templateId: string) {
    const file = goldenFiles[templateId];
    if (!file) return;
    setUploadingGolden(templateId);
    try {
      await api.uploadGoldenPcb(templateId, file);
      setGoldenFiles((prev) => ({ ...prev, [templateId]: null }));
      setGoldenUploaded((prev) => ({ ...prev, [templateId]: true }));
      toast.success("Golden PCB uploaded — baseline detection runs in the background");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload golden PCB");
    } finally {
      setUploadingGolden(null);
    }
  }

  return (
    <PageContainer width="lg">
      <SectionHeading
        eyebrow="Reference library"
        title="PCB templates"
        description="Each template is a board design; its golden PCB is the known-good reference every inspection compares against."
      />

      <Card className="mt-8 max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4 text-primary" /> Create a template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Main Control Board Rev C"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description (optional)</Label>
              <Input
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes for your team"
              />
            </div>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create template"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Layers className="size-4 text-muted-foreground" /> Existing templates
        </h2>

        {templates === null ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No templates yet — create one above.
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-5">
                <p className="font-medium">{t.name}</p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground">
                    <UploadCloud className="size-4" />
                    <span className="max-w-44 truncate">
                      {goldenFiles[t.id]?.name ?? "Choose golden board image"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) =>
                        setGoldenFiles((prev) => ({ ...prev, [t.id]: e.target.files?.[0] ?? null }))
                      }
                    />
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoldenUpload(t.id)}
                    disabled={!goldenFiles[t.id] || uploadingGolden === t.id}
                  >
                    {uploadingGolden === t.id ? "Uploading…" : "Upload golden PCB"}
                  </Button>
                  {goldenUploaded[t.id] && (
                    <span className="inline-flex items-center gap-1 text-sm text-primary">
                      <CheckCircle2 className="size-4" /> Uploaded
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
