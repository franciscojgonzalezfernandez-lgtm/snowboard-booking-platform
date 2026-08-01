import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatChf } from "@/lib/pricing/format";

import { formatShortDate } from "../_lib/format";

// A credit is flagged "expiring soon" (amber) inside this window so the booker
// is nudged to redeem it before it lapses.
const EXPIRY_SOON_MS = 30 * 24 * 60 * 60 * 1000;

export type ActiveCreditRow = {
  id: string;
  amountCents: number;
  expiresAt: Date;
  createdAt: Date;
};

type Props = {
  credits: ActiveCreditRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
  className?: string;
};

export function CreditAside({ credits, locale, t, className }: Props) {
  const now = Date.now();
  const totalCents = credits.reduce((sum, c) => sum + c.amountCents, 0);

  return (
    <aside
      data-testid="dashboard-credit-aside"
      className={cn("space-y-5", className)}
    >
      <header className="space-y-3">
        <h2 className="font-display text-xl tracking-tight">
          {t("credits.title")}
        </h2>
        <div className="flex items-baseline justify-between gap-3 border-b border-input pb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {t("credits.total_label")}
          </span>
          <span
            data-testid="dashboard-credit-total"
            className="text-sm font-medium"
          >
            {formatChf(totalCents)}
          </span>
        </div>
      </header>

      <ul className="space-y-3">
        {credits.map((credit) => {
          const expiresSoon =
            credit.expiresAt.getTime() - now < EXPIRY_SOON_MS;
          return (
            <li
              key={credit.id}
              data-testid="dashboard-credit-item"
              data-expires-soon={expiresSoon ? "true" : "false"}
              // Two-pane voucher: amount stub on the left, expiry counterfoil
              // on the right, perforated dashed middle line, paper surface
              // (`bg-secondary` is warmer than the dashboard `bg-background`,
              // so the voucher reads as a discrete object). The notches are
              // absolutely-positioned dots that match the page background, so
              // they read as if punched through the perforation — no SVG, no
              // mask hacks. `41.67%` = 1 / (1 + 1.4), the column boundary.
              className={cn(
                "relative grid grid-cols-[1fr_1.4fr] items-stretch",
                "rounded-sm border border-input bg-secondary/60",
                "before:absolute before:left-[41.67%] before:-top-1.5",
                "before:size-3 before:-translate-x-1/2 before:rounded-full before:bg-background",
                "after:absolute after:left-[41.67%] after:-bottom-1.5",
                "after:size-3 after:-translate-x-1/2 after:rounded-full after:bg-background",
              )}
            >
              <div className="flex items-center justify-center px-3 py-5">
                <span className="font-display text-xl tracking-tight">
                  {formatChf(credit.amountCents)}
                </span>
              </div>
              <div className="space-y-1 border-l border-dashed border-input/70 px-4 py-5">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.22em]",
                    expiresSoon ? "text-amber-700" : "text-muted-foreground",
                  )}
                >
                  {expiresSoon
                    ? t("credits.expires_soon_eyebrow")
                    : t("credits.expires_eyebrow")}
                </p>
                <p
                  className={cn(
                    "font-display text-lg leading-tight tracking-tight",
                    expiresSoon && "text-amber-700",
                  )}
                >
                  {formatShortDate(credit.expiresAt, locale)}
                </p>
                <p className="pt-1 text-[11px] leading-snug text-muted-foreground/80">
                  {t("credits.source_cancellation", {
                    date: formatShortDate(credit.createdAt, locale),
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        href={{ pathname: "/reservar", query: { credit: "auto" } }}
        data-testid="dashboard-credit-apply"
        className="inline-flex w-full items-center justify-center rounded-md border-2 border-foreground bg-foreground px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
      >
        {t("credits.apply_cta")}
      </Link>
    </aside>
  );
}
