import { CircuitBoard, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { CopilotMessage } from "@/lib/api";

const ROLE_CONFIG = {
  user: {
    align: "justify-end",
    bubble: "bg-primary text-primary-foreground",
    icon: User,
    iconWrap: "bg-primary/15 text-primary order-2",
  },
  assistant: {
    align: "justify-start",
    bubble: "bg-card border border-border",
    icon: CircuitBoard,
    iconWrap: "bg-primary/15 text-primary",
  },
} as const;

export function ChatMessage({ message }: { message: CopilotMessage }) {
  const cfg = ROLE_CONFIG[message.role];
  const Icon = cfg.icon;

  return (
    <div className={cn("flex items-start gap-3", cfg.align)}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          cfg.iconWrap
        )}
      >
        <Icon className="size-4" />
      </span>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed",
          cfg.bubble
        )}
      >
        {message.role === "assistant" ? (
          <div className="prose-copilot">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  );
}
