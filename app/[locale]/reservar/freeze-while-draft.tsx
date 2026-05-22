"use client";

import { cn } from "@/lib/utils";
import { useDraftGuard } from "./draft-guard";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Visual freeze wrapper for sections that should appear inactive while a
 * Stripe PaymentIntent is in flight. Clicks still pass through so per-island
 * mutators wrapped with `requestEdit` can open the dirty-edit dialog;
 * `pointer-events-none` would short-circuit that path and feel unresponsive.
 */
export function FreezeWhileDraft({ children, className }: Props) {
  const { draft } = useDraftGuard();
  const frozen = !!draft;
  return (
    <div
      data-frozen={frozen ? "true" : "false"}
      aria-disabled={frozen || undefined}
      className={cn(
        "transition-opacity",
        frozen && "opacity-60",
        className,
      )}
    >
      {children}
    </div>
  );
}
