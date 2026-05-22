import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

// Minimal in-flow header for /reservar/* — replaces the marketing SiteNav
// chrome with a single brand row + language switcher + exit link, so the
// booking shell keeps focus on the funnel without the full site nav above
// the persistent stepper.
export async function BookingHeader() {
  const t = await getTranslations("reservar.nav");

  return (
    <header
      data-testid="booking-header"
      className="border-b-2 border-foreground bg-background"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-[20px] uppercase tracking-tight"
          data-testid="booking-header-brand"
        >
          Adlerhorst<span className="text-primary">·</span>SBS
        </Link>

        <div className="flex items-center gap-5">
          <LanguageSwitcher tone="light" />
          <Link
            href="/"
            data-testid="booking-header-exit"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            {t("exit")}
          </Link>
        </div>
      </div>
    </header>
  );
}
