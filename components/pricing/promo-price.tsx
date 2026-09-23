import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Shared promotional price display (F-141). The single place the struck-through
// original + promo copy is rendered on the web (home cards, /precios, booking
// funnel). Email cannot consume this (React Email markup differs) and inlines
// its own treatment.
//
// Server Component: pure presentation, no state. All three price strings are
// pre-formatted CHF via lib/pricing/format.ts by the caller; `originalPriceLabel`
// and `promoLabel` are set only when a promotion applies. Styling follows the
// editorial brand: strikethrough in muted, a quiet primary small-caps label with
// a short rule — no badge, no shadow (CLAUDE.md design rules).

type PromoPriceProps = {
  /** Effective (charged) price, pre-formatted CHF. */
  priceLabel: string;
  /** Regular price struck through, pre-formatted CHF. Omit when no promo. */
  originalPriceLabel?: string | null;
  /** Localized promo copy, e.g. "Season opening". Omit when no promo. */
  promoLabel?: string | null;
  /** Localized sr-only prefix for the struck price, e.g. "Regular price". */
  regularPriceA11yLabel?: string;
  /** Optional trailing content beside the price, e.g. a "per lesson" suffix. */
  suffix?: ReactNode;
  /** Classes for the effective-price text (size/weight per surface). */
  priceClassName?: string;
  /** Wrapper classes. */
  className?: string;
};

export function PromoPrice({
  priceLabel,
  originalPriceLabel,
  promoLabel,
  regularPriceA11yLabel,
  suffix,
  priceClassName,
  className,
}: PromoPriceProps) {
  const hasPromo = Boolean(originalPriceLabel);

  return (
    <span className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "leading-none tracking-tight tabular-nums",
            priceClassName,
          )}
          data-promo={hasPromo ? "true" : undefined}
        >
          {priceLabel}
        </span>
        {originalPriceLabel ? (
          <span className="text-[0.7em] font-medium text-muted-foreground line-through tabular-nums">
            {regularPriceA11yLabel ? (
              <span className="sr-only">{regularPriceA11yLabel}: </span>
            ) : null}
            {originalPriceLabel}
          </span>
        ) : null}
        {suffix}
      </span>
      {promoLabel ? (
        <span className="inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          <span aria-hidden className="h-[2px] w-4 bg-primary" />
          {promoLabel}
        </span>
      ) : null}
    </span>
  );
}
