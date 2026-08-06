import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mobile: a horizontal snap rail that shows a peek of the next card, so a set
 * of four reads as a shelf you browse instead of a four-screen column. From
 * `sm` up the children lay out with whatever grid classes they were given.
 *
 * Zero JS on purpose. CSS scroll-snap keeps the marketing tree prerenderable
 * (F-124) and keeps the home inside its First Load JS budget — a carousel
 * library would have cost both. The peek *is* the affordance; there are no
 * dots or arrows to hydrate.
 *
 * The vertical padding is load-bearing: `overflow-x: auto` computes
 * `overflow-y` to `auto` as well, which would otherwise clip the entrance
 * translate of the `<Stagger>` children and add a phantom scrollbar.
 *
 * Assumes the section around it uses the `px-7` page gutter — the negative
 * margin bleeds the rail to the viewport edge and `scroll-px-7` puts the
 * snapped card back on the gutter.
 */
export function CardScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid="card-scroller"
      className={cn(
        "-mx-7 snap-x snap-mandatory scroll-px-7 overflow-x-auto px-7 py-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:snap-none sm:overflow-visible sm:px-0 sm:py-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Width + snap contract for a single card inside `<CardScroller>`. Kept next to
 * the scroller so the two can never drift apart.
 *
 * @param widthClass mobile card width; a value below 100vw is what creates the
 *   peek of the next card.
 */
export function scrollerItem(widthClass = "w-[78vw]") {
  return cn("flex shrink-0 snap-start", widthClass, "sm:w-auto sm:shrink");
}
