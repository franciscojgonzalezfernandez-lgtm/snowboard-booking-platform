"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * One subtle vertical parallax tied to scroll progress through the element.
 * Static under `prefers-reduced-motion` (the only motion the page should ever
 * carry on the LCP path is none — keep this off hero copy).
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
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
