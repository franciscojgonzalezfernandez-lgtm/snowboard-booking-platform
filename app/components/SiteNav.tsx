import { headers } from "next/headers";
import { PhoneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth/actions";
import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavMore } from "./NavMore";
import { Wordmark } from "./Wordmark";

type SiteNavProps = {
  utility?: string;
};

// Top nav mounted from route-group layouts (marketing / auth / dashboard).
// Pages should not mount it inline. Booking funnel (/reservar) keeps its own
// BookingHeader and does NOT compose this component.
//
// F-116 desktop IA — two rows on lg+:
//   1. Utility bar (--foreground / ink): optional marketing tagline on the
//      left, phone + LanguageSwitcher on the right. Always rendered so phone +
//      lang have one consistent home on every surface (marketing passes the
//      `utility` tagline; auth/dashboard leave the left side empty).
//   2. Brand row: wordmark + 3 primary links (Prices · Instructors · Field
//      notes) + a "More" dropdown (About · Contact) + the auth CTA. Phone and
//      lang no longer compete here — that was the ~1024–1280px crowding the
//      owner reported. Below lg everything collapses into the MobileNav Sheet.
export async function SiteNav({ utility }: SiteNavProps) {
  const tNav = await getTranslations("nav");
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = !!session?.user;

  return (
    <header data-testid="site-nav">
      <div className="hidden bg-foreground text-background lg:block">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-7 py-2 text-[11px] font-bold uppercase tracking-[0.14em]">
          <span>{utility}</span>
          <div className="flex items-center gap-6">
            <a
              href={`tel:${OPERATIONAL_PHONE_TEL}`}
              data-testid="site-nav-phone"
              aria-label={`${tNav("phone_label")} ${OPERATIONAL_PHONE_DISPLAY}`}
              className="inline-flex items-center gap-2 text-background transition-colors hover:text-primary"
            >
              <PhoneIcon className="h-4 w-4" aria-hidden />
              {OPERATIONAL_PHONE_DISPLAY}
            </a>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>

      <div className="border-b-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-5 py-4 lg:px-7 lg:py-5">
          <Link
            href="/"
            data-testid="site-nav-brand"
            className="shrink-0 font-display text-[18px] uppercase tracking-tight lg:text-[22px]"
          >
            <Wordmark className="whitespace-nowrap" />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <Link
              href="/precios"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("prices")}
            </Link>
            <Link
              href="/instructores"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("instructors")}
            </Link>
            <Link
              href="/blog"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("journal")}
            </Link>
            <NavMore
              moreLabel={tNav("more")}
              planLabel={tNav("plan")}
              aboutLabel={tNav("about")}
            />
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            {signedIn ? (
              <>
                <Link
                  href="/dashboard"
                  data-testid="site-nav-account"
                  className="rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
                >
                  {tNav("dashboard_cta")}
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    data-testid="site-nav-signout"
                    className="text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
                  >
                    {tNav("sign_out")}
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                data-testid="site-nav-signin"
                className="rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
              >
                {tNav("signin")}
              </Link>
            )}
          </div>

          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
