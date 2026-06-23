"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The hero gesture for the "The Drop" wordmark: a confident rise-and-settle
 * reveal. Replaces the old drop-glyph fall — the owner dropped the glyph
 * (2026-06-15), so the wordmark itself is the hero moment.
 *
 * Runs once on mount (the wordmark is above the fold). Reduced motion is
 * handled in CSS via the `data-motion` hook (globals.css pins it visible with
 * no transform/filter), never by branching on `useReducedMotion()` during
 * render — that caused a hydration mismatch for reduced-motion users (F-106).
 * Mount it as a client island around the decorative wordmark only — never the
 * LCP headline copy.
 */
export function WordmarkReveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      data-motion="wordmark"
      className={className}
      initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
