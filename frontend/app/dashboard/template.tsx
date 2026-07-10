"use client";

import { motion, useReducedMotion } from "framer-motion";

// A `template.tsx` re-mounts on every navigation (unlike `layout.tsx`), so
// wrapping the routed content here gives each dashboard page a fresh entrance
// transition without any per-page boilerplate. Kept subtle (fade + small rise)
// to match the instrumentation-grade identity, and disabled under
// prefers-reduced-motion.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
