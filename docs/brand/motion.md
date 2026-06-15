# The Drop — Motion Principles

> Principles for **F-090** (the `motion` lib + `lib/motion/` primitives). North star: motion should
> feel like **snow and a confident rider** — physical, intentional, calm. Never decorative spin.

## Principles

1. **Physical, not flashy.** Ease like real momentum — snappy in, settle out. No linear robot motion.
2. **Reveal, don't perform.** Content fades + slides up **once** on scroll. No looping attention-grabbers.
3. **The wordmark is the hero gesture.** The "The Drop" wordmark rises and settles once on the home hero
   (the drop glyph was dropped, owner 2026-06-15); everything else stays quieter so that one moment lands.
4. **Calm under load.** Micro-interactions are subtle. No bounce, no glow pulse, at most **one** tasteful
   parallax on the whole site.
5. **Accessibility is non-negotiable.** Every motion is gated behind `prefers-reduced-motion`. Reduced =
   static, complete, no transform — the page must look finished without a single animation.
6. **Performance budget.** No motion on the LCP critical path; the lib is lazy / tree-shaken; home stays
   under 200KB JS gz.

## Allowed gestures

scroll reveal (fade + 8–16px slide) · staggered lists · the hero **wordmark reveal** · one subtle hero
parallax · view transitions between pages · button press feedback.

## Banned

spin · infinite bounce · glow pulse · glassmorphism shimmer · Lottie of generic shapes · any motion
that moves the LCP headline text.
