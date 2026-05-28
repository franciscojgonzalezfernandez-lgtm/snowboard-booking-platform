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
  // Credits arrive ordered by expiresAt asc, so the first is the nearest.
  const nearestExpiry = credits[0]!.expiresAt;

  return (
    <aside
      data-testid="dashboard-credit-aside"
      className={cn(
        "rounded-md border border-input p-6",
        className,
      )}
    >
      <h2 className="font-display text-xl tracking-tight">
        {t("credits.title")}
      </h2>

      <div className="mt-4 space-y-1 border-b border-input pb-5">
        <p
          data-testid="dashboard-credit-total"
          className="font-display text-3xl tracking-tight"
        >
          {t("credits.total", { amount: formatChf(totalCents) })}
        </p>
        <p
          data-testid="dashboard-credit-nearest"
          className="text-xs text-muted-foreground"
        >
          {t("credits.nearest_expiry", {
            date: formatShortDate(nearestExpiry, locale),
          })}
        </p>
      </div>

      <ul data-testid="dashboard-credit-list" className="divide-y divide-input">
        {credits.map((credit) => {
          const expiresSoon =
            credit.expiresAt.getTime() - now < EXPIRY_SOON_MS;
          return (
            <li
              key={credit.id}
              data-testid="dashboard-credit-item"
              className="space-y-1 py-4"
            >
              <p className="font-display text-lg tracking-tight">
                {formatChf(credit.amountCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("credits.source_cancellation", {
                  date: formatShortDate(credit.createdAt, locale),
                })}
              </p>
              <p
                className={cn(
                  "text-xs",
                  expiresSoon
                    ? "font-medium text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {expiresSoon
                  ? t("credits.expires_soon", {
                      date: formatShortDate(credit.expiresAt, locale),
                    })
                  : t("credits.expires", {
                      date: formatShortDate(credit.expiresAt, locale),
                    })}
              </p>
            </li>
          );
        })}
      </ul>

      <Link
        href="/reservar?credit=auto"
        data-testid="dashboard-credit-apply"
        className="mt-2 inline-flex w-full items-center justify-center rounded-md border-2 border-foreground bg-foreground px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
      >
        {t("credits.apply_cta")}
      </Link>
    </aside>
  );
}
