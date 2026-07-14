"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, UploadCloud, CheckCircle2, Clock, Search } from "lucide-react";
import { api, PcbTemplate, Profile } from "@/lib/api";
import { looksLikeGerber, renderGerberToPng } from "@/lib/gerber";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_LIMIT = 60;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PcbTemplate[] | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [goldenFiles, setGoldenFiles] = useState<Record<string, File | null>>({});
  const [uploadingGolden, setUploadingGolden] = useState<string | null>(null);

  const loadTemplates = useCallback(async (q: string) => {
    try {
      setTemplates(await api.listTemplates(q || undefined, PAGE_LIMIT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
    }
  }, []);

  const refreshUsage = useCallback(() => {
    api.getMe().then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  // Debounce the search so we hit the API once the user pauses, not per keystroke.
  useEffect(() => {
    const id = setTimeout(() => loadTemplates(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search, loadTemplates]);

  const atLimit = me != null && me.template_count >= me.template_limit;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createTemplate(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      toast.success("Template created");
      await loadTemplates(search.trim());
      refreshUsage();
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
      // A Gerber design file is rendered to a board image client-side, then
      // uploaded through the same path as a photographed golden board.
      let toUpload = file;
      if (looksLikeGerber(file, await file.slice(0, 2048).text())) {
        toUpload = await renderGerberToPng(file);
      }
      await api.uploadGoldenPcb(templateId, toUpload);
      setGoldenFiles((prev) => ({ ...prev, [templateId]: null }));
      toast.success("Golden PCB uploaded — baseline detection runs in the background");
      await loadTemplates(search.trim());
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
        actions={
          me ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground">
              <span className="font-mono tabular text-foreground">
                {me.template_count}
                {me.template_limit < 100000 && ` / ${me.template_limit}`}
              </span>
              templates · {me.plan_label} plan
            </span>
          ) : undefined
        }
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
            <Button type="submit" disabled={creating || !name.trim() || atLimit}>
              {creating ? "Creating…" : "Create template"}
            </Button>
            {atLimit && (
              <p className="text-xs text-severity-major">
                You&apos;ve reached your {me?.plan_label} plan&apos;s {me?.template_limit}-template
                limit. Upgrade on the pricing page to add more.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Layers className="size-4 text-muted-foreground" /> Existing templates
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="pl-9"
            />
          </div>
        </div>

        {templates === null ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {search.trim()
              ? `No templates match "${search.trim()}".`
              : "No templates yet — create one above."}
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-5">
                <div className="flex gap-4">
                  {t.golden_pcb && (
                    <img
                      // eslint-disable-next-line @next/next/no-img-element
                      src={t.golden_pcb.image_url}
                      alt={`${t.name} golden reference`}
                      className="size-20 shrink-0 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.name}</p>
                    {t.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    {t.golden_pcb ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 text-primary">
                          <CheckCircle2 className="size-3.5" /> Golden PCB uploaded
                        </span>
                        <span>{new Date(t.golden_pcb.created_at).toLocaleDateString()}</span>
                        {!t.golden_pcb.baseline_ready && (
                          <span className="inline-flex items-center gap-1 text-severity-major">
                            <Clock className="size-3.5" /> Building baseline…
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        No golden PCB yet — upload one to enable reference comparison.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground">
                    <UploadCloud className="size-4" />
                    <span className="max-w-44 truncate">
                      {goldenFiles[t.id]?.name ?? "Choose board image or Gerber"}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.gbr,.ger,.gtl,.gbl,.gto,.gbo,.gts,.gbs,.gko,.gm1,.gml,.art"
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
                    {uploadingGolden === t.id
                      ? "Rendering…"
                      : t.golden_pcb
                        ? "Replace golden PCB"
                        : "Upload golden PCB"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Upload a photo of a known-good board, or a Gerber layer (e.g. top copper
                  <span className="font-mono"> .gtl</span>) — the Gerber renders to a board image
                  automatically.
                </p>
              </Card>
            ))}
            {templates.length === PAGE_LIMIT && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Showing the first {PAGE_LIMIT} results — refine your search to narrow them down.
              </p>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
