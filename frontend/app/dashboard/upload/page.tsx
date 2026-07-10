"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { UploadForm } from "@/components/inspection/UploadForm";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function UploadPage() {
  const [templates, setTemplates] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  return (
    <PageContainer>
      <SectionHeading
        eyebrow="Inspection"
        title="New inspection"
        description="Upload a board photo and let the model do the looking."
      />

      <div className="mt-8">
        {templates === null ? (
          <div className="max-w-xl space-y-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-48" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex max-w-xl flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface-1/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-6" />
            </span>
            <div>
              <p className="font-medium">No PCB templates yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a template and upload a golden reference board before running an inspection.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/templates">
                Create a template <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : (
          <UploadForm templates={templates} />
        )}
      </div>
    </PageContainer>
  );
}
