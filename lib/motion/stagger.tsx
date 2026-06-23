"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Container that reveals its `<StaggerItem>` children one after another on
 * scroll. Reduced motion is handled in CSS via the `data-motion` hook (see
 * `Reveal` / globals.css), never by branching on `useReducedMotion()` during
 * render — that caused a hydration mismatch for reduced-motion users (F-106).
 */
export function Stagger({
  children,
  className,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds between each child's reveal. */
  gap?: number;
}) {
  return (
    <motion.div
      data-motion="stagger"
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

/** A single item inside a `<Stagger>`. Reduced motion handled in CSS (F-106). */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div data-motion="stagger-item" className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
