"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, CircuitBoard } from "lucide-react";
import { api, CopilotMessage } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/copilot/ChatMessage";
import { ChatInput } from "@/components/copilot/ChatInput";

const SUGGESTIONS = [
  "What's our pass rate?",
  "What's our most common defect?",
  "Show me our recent failed inspections",
  "What PCB templates do we have?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[] | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getCopilotHistory().then(setMessages).catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(text: string) {
    setMessages((prev) => [
      ...(prev ?? []),
      { role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      const reply = await api.sendCopilotMessage(text);
      setMessages((prev) => [...(prev ?? []), reply]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The copilot couldn't answer that");
      setMessages((prev) => (prev ?? []).slice(0, -1)); // drop the optimistic user turn on failure
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await api.clearCopilotHistory();
      setMessages([]);
      toast.success("Conversation cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear conversation");
    }
  }

  return (
    <PageContainer width="lg" className="flex h-[calc(100vh-3.5rem)] flex-col py-8">
      <SectionHeading
        eyebrow="AI Assistant"
        title="Manufacturing Copilot"
        description="Ask questions about your real inspection data — pass rates, recent failures, defect trends."
        actions={
          messages && messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 /> Clear
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex-1 overflow-hidden rounded-lg border border-border bg-surface-1/40">
        <ScrollArea className="h-full">
          <div className="space-y-5 p-5">
            {messages === null ? (
              <p className="text-sm text-muted-foreground">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CircuitBoard className="size-6" />
                </span>
                <div>
                  <p className="font-medium">Ask the copilot anything</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    It looks up real data from your organization to answer.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <ChatMessage key={i} message={m} />)
            )}
            {sending && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <CircuitBoard className="size-4" />
                </span>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="mt-4">
        <ChatInput onSend={handleSend} disabled={sending || messages === null} />
      </div>
    </PageContainer>
  );
}
