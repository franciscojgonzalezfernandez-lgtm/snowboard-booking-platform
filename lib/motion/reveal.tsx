"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Slide distance in px before settling (default 12). */
  y?: number;
  /** Seconds to wait before the reveal starts. */
  delay?: number;
};

/**
 * Fade + slide-up once when scrolled into view.
 *
 * Reduced motion is handled in CSS, not by swapping the rendered element. The
 * `data-motion` hook lets `@media (prefers-reduced-motion: reduce)` (globals.css)
 * pin the element visible (opacity:1, no transform) on first paint. Branching on
 * `useReducedMotion()` during render caused a server/client hydration mismatch
 * for reduced-motion users (F-106): the server has no media query, so it always
 * rendered the animated `motion.div` while the client rendered a plain `<div>`,
 * and React refused to patch the difference — leaving the content blank.
 */
export function Reveal({ children, className, y = 12, delay = 0 }: RevealProps) {
  return (
    <motion.div
      data-motion="reveal"
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
