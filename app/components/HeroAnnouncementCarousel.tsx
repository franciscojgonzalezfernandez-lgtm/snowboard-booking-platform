"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Link } from "@/i18n/navigation";

import type { LocalizedBanner } from "./HeroAnnouncement";
import { HeroAnnouncementClose } from "./HeroAnnouncementClose";

// Rotating home banner band (F-142). Only mounted when 2+ banners are enabled;
// a single banner is static server markup in HeroAnnouncement.tsx.
//
// LCP/CLS contract (F-124 + booking-platform-perf): the band is a single
// truncated line, so every slide is the same height and swapping content never
// shifts the hero below it. Auto-advance and the fade are BOTH gated behind
// `prefers-reduced-motion`; reduced-motion visitors get a static first slide with
// working manual prev/next controls. Auto-advance also pauses on hover/focus.

const INTERVAL_MS = 5000;

const ctaClassName =
  "shrink-0 text-[12px] font-bold uppercase tracking-[0.16em] underline underline-offset-4 transition-all hover:no-underline";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

type Props = {
  items: LocalizedBanner[];
  closeLabel: string;
  regionLabel: string;
  previousLabel: string;
  nextLabel: string;
};

export function HeroAnnouncementCarousel({
  items,
  closeLabel,
  regionLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Keep the index valid if the enabled set shrinks between renders. count >= 2
  // (only mounted for multiple banners) and safeIndex is in range, so the
  // assertion is safe — it just satisfies noUncheckedIndexedAccess.
  const safeIndex = index % count;
  const item = items[safeIndex]!;

  const goTo = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, paused, count]);

  const controlClass =
    "grid size-8 place-items-center rounded-full text-primary-foreground/75 transition-colors hover:text-primary-foreground";

  return (
    <aside
      data-hero-announcement
      aria-roledescription="carousel"
      aria-label={regionLabel}
      className="relative bg-primary text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-x-4 gap-y-1 px-7 py-2.5 pr-12 max-[420px]:flex-wrap">
        {/* aria-live off: rotation is decorative, not an alert. */}
        <div className="min-w-0 flex-1" aria-live="off">
          <p
            key={item.id}
            className="truncate text-[13px] font-medium leading-snug motion-safe:[animation:hero-announcement-fade_400ms_ease]"
          >
            {item.body}
          </p>
        </div>

        {item.ctaLabel && item.ctaHref ? (
          item.ctaIsInternal ? (
            <Link
              href={item.ctaHref as ComponentProps<typeof Link>["href"]}
              className={ctaClassName}
            >
              {item.ctaLabel}
            </Link>
          ) : (
            <a href={item.ctaHref} className={ctaClassName}>
              {item.ctaLabel}
            </a>
          )
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={previousLabel}
            onClick={() => goTo(safeIndex - 1)}
            className={controlClass}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="text-[11px] font-medium tabular-nums text-primary-foreground/75">
            {safeIndex + 1}/{count}
          </span>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={() => goTo(safeIndex + 1)}
            className={controlClass}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <HeroAnnouncementClose label={closeLabel} />
    </aside>
  );
}
