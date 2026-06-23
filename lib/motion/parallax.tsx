"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * One subtle vertical parallax tied to scroll progress through the element.
 *
 * Reduced motion is handled in CSS via the `data-motion` hook (globals.css
 * pins `transform: none` under `prefers-reduced-motion`), never by branching on
 * `useReducedMotion()` during render — that swapped `motion.div` for a plain
 * `<div>` and caused a hydration mismatch for reduced-motion users (F-106).
 * Keep this off the LCP path (never wrap hero copy).
 */
export function Parallax({
  children,
  className,
  distance = 40,
}: {
  children: ReactNode;
  className?: string;
  /** Peak vertical travel in px (default 40). */
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div data-motion="parallax" ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
