"use client";

import { motion, useReducedMotion } from "motion/react";
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
 * Fade + slide-up once when scrolled into view. Renders a finished, static
 * element under `prefers-reduced-motion` (no transform/opacity animation) —
 * a11y is non-negotiable (docs/brand/motion.md).
 */
export function Reveal({ children, className, y = 12, delay = 0 }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
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
