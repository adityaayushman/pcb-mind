"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient animated background: a depth-projected field of PCB solder-pad
 * nodes drifting in 3D, wired together by faint traces when they come close,
 * with subtle pointer parallax (deeper layers move less). Pure <canvas> — no
 * WebGL / three.js dependency — so it stays light on the free tier.
 *
 * Rendered fixed behind all content (see root layout). The app ground still
 * paints behind it and cards paint opaquely over it, so it only shows in the
 * gutters — ambient, never fighting legibility. Honors prefers-reduced-motion
 * (draws one static frame) and pauses while the tab is hidden.
 */
type Node = {
  x: number;
  y: number;
  z: number; // depth 0 (far) → 1 (near)
  vx: number;
  vy: number;
};

const LINK_DIST = 140;

export function CircuitField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Re-bind to non-null locals so the narrowing holds inside the nested
    // resize()/draw() closures below.
    const cv: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Pull the brand green out of the CSS var so the field always matches the
    // theme token rather than hard-coding a hex.
    const primary =
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
      "152 82% 40%";
    const green = (a: number) => `hsl(${primary} / ${a})`;

    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let raf = 0;
    let mx = 0;
    let my = 0; // pointer offset, -0.5 … 0.5
    let tx = 0;
    let ty = 0; // eased pointer for smoothness

    function build() {
      const count = Math.min(150, Math.max(36, Math.floor((w * h) / 14000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
      }));
    }

    function resize() {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function draw() {
      // ease pointer parallax toward target
      tx += (mx - tx) * 0.05;
      ty += (my - ty) * 0.05;

      ctx.clearRect(0, 0, w, h);

      // project each node with depth-scaled parallax
      const px: number[] = new Array(nodes.length);
      const py: number[] = new Array(nodes.length);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reduce) {
          n.x += n.vx * (0.35 + n.z);
          n.y += n.vy * (0.35 + n.z);
          if (n.x < -30) n.x = w + 30;
          else if (n.x > w + 30) n.x = -30;
          if (n.y < -30) n.y = h + 30;
          else if (n.y > h + 30) n.y = -30;
        }
        const par = 44 * n.z;
        px[i] = n.x + tx * par;
        py[i] = n.y + ty * par;
      }

      // traces between near nodes (nearer depth = brighter)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = px[i] - px[j];
          const dy = py[i] - py[j];
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const d = Math.sqrt(d2);
            const depth = Math.min(nodes[i].z, nodes[j].z);
            const a = (1 - d / LINK_DIST) * 0.16 * (0.4 + depth);
            ctx.strokeStyle = green(a);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(px[i], py[i]);
            ctx.lineTo(px[j], py[j]);
            ctx.stroke();
          }
        }
      }

      // solder-pad nodes: a filled core with a faint ring
      for (let i = 0; i < nodes.length; i++) {
        const z = nodes[i].z;
        const r = 0.6 + z * 1.9;
        ctx.beginPath();
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
        ctx.fillStyle = green(0.22 + z * 0.45);
        ctx.fill();
        if (z > 0.6) {
          ctx.beginPath();
          ctx.arc(px[i], py[i], r + 2.4, 0, Math.PI * 2);
          ctx.strokeStyle = green(0.12 * z);
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    }

    function onPointer(e: PointerEvent) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduce) {
      draw(); // single static frame
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
