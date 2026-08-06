import Image from "next/image";

import { TIER_PHOTO, type TierKey } from "@/lib/pricing/tiers";
import { cn } from "@/lib/utils";

/**
 * The photo band at the top of a lesson product card, with the duration set on
 * it as a product tag and — on one tier only — Javi's recommendation. Shared by
 * the home and the pricing page so the two surfaces can never show a different
 * photo for the same product.
 *
 * Both tags sit *inside* the frame rather than above it so every card in a row
 * starts at the same height, flagged or not.
 *
 * Always below the fold on both surfaces, so it stays lazy — the LCP element is
 * the hero (F-090/F-124) and must not compete for bandwidth.
 */
export function TierPhoto({
  tier,
  alt,
  durationLabel,
  flag,
  sizes,
  className,
}: {
  tier: TierKey;
  alt: string;
  /** Short duration set on the photo as a product tag ("2 horas"). */
  durationLabel: string;
  /** Recommendation ribbon; omitted on every tier but one. */
  flag?: string;
  /** Layout-accurate `sizes`; without it the optimizer ships the 1600px file. */
  sizes: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <Image
        src={TIER_PHOTO[tier]}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="absolute bottom-0 left-0 border-r-2 border-t-2 border-foreground bg-background px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
        {durationLabel}
      </span>
      {flag ? (
        <span className="absolute right-0 top-0 bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground">
          {flag}
        </span>
      ) : null}
    </div>
  );
}
