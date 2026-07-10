"use client";

import { useEffect, useRef, useState } from "react";

// Real per-stage backend status would need a job-queue/websocket
// rearchitecture, so this is a simulated pipeline: early stages resolve
// fast (genuinely close to real), "AI detection" is the long pole and
// creeps slowly for however long the real request actually takes (can be
// 30-60s+ cold on a free-tier host), then a fast fixed flourish plays
// through the remaining stages once the real response lands.
const STAGES = [
  { label: "Uploading image", ceiling: 10 },
  { label: "Image quality check", ceiling: 20 },
  { label: "Preprocessing", ceiling: 32 },
  { label: "AI detection", ceiling: 88 },
  { label: "Component matching", ceiling: 93 },
  { label: "Defect analysis", ceiling: 97 },
  { label: "Generating report", ceiling: 100 },
] as const;

const AI_DETECTION_STAGE = 3;
const TICK_MS = 120;
const FAST_RATE = 0.14;
const SLOW_RATE = 0.02;
const SETTLE_TICK_MS = 260;
const REASSURANCE_AFTER_MS = 18000;

export function StagedProgress({ done, onSettled }: { done: boolean; onSettled: () => void }) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [settling, setSettling] = useState(false);
  const [showReassurance, setShowReassurance] = useState(false);
  const elapsedRef = useRef(0);

  // Creep toward the current stage's ceiling; "AI detection" and beyond use
  // a much slower rate and never reach their ceiling on their own.
  useEffect(() => {
    if (settling) return;
    const interval = setInterval(() => {
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= REASSURANCE_AFTER_MS) setShowReassurance(true);
      setProgress((p) => {
        const ceiling = STAGES[stageIndex].ceiling;
        const rate = stageIndex >= AI_DETECTION_STAGE ? SLOW_RATE : FAST_RATE;
        return p + (ceiling - p) * rate;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [settling, stageIndex]);

  // Advance to the next stage once close enough to the current ceiling —
  // capped at "AI detection", which only advances once the real call resolves.
  useEffect(() => {
    if (settling || stageIndex >= AI_DETECTION_STAGE) return;
    if (progress >= STAGES[stageIndex].ceiling - 0.5) {
      setStageIndex((s) => Math.min(s + 1, AI_DETECTION_STAGE));
    }
  }, [progress, stageIndex, settling]);

  // Once the real response lands, play a fast fixed flourish through the
  // remaining stages rather than jumping straight to 100%.
  useEffect(() => {
    if (!done || settling) return;
    setSettling(true);
    let i = AI_DETECTION_STAGE + 1;
    setStageIndex(Math.min(i, STAGES.length - 1));
    const interval = setInterval(() => {
      if (i >= STAGES.length) {
        clearInterval(interval);
        setProgress(100);
        onSettled();
        return;
      }
      setStageIndex(i);
      setProgress(STAGES[i].ceiling);
      i += 1;
    }, SETTLE_TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const stage = STAGES[Math.min(stageIndex, STAGES.length - 1)];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {stage.label}…
        </span>
        <span className="font-mono text-xs tabular text-muted-foreground">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {STAGES.map((s, i) => (
          <span
            key={s.label}
            className={
              i < stageIndex
                ? "font-mono text-[10px] uppercase tracking-wide text-primary"
                : i === stageIndex
                  ? "font-mono text-[10px] uppercase tracking-wide text-foreground"
                  : "font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50"
            }
          >
            {s.label}
          </span>
        ))}
      </div>
      {showReassurance && (
        <p className="mt-3 text-xs text-muted-foreground">
          Still working — the free-tier server can take up to a minute after being idle.
        </p>
      )}
    </div>
  );
}
