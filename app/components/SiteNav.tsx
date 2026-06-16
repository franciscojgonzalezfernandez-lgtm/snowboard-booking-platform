import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth/actions";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { Wordmark } from "./Wordmark";

type SiteNavProps = {
  utility?: string;
};

// Top nav mounted from route-group layouts (marketing / auth / dashboard).
// Pages should not mount it inline. Booking funnel (/reservar) keeps its own
// BookingHeader and does NOT compose this component.
// Variant B: thin top utility bar on --foreground (ink) when `utility` is
// provided, then a brand row with wordmark + nav links + language switcher
// + auth CTA. Mobile (<lg): brand + hamburger only; nav/lang/CTA move into
// MobileNav Sheet.
export async function SiteNav({ utility }: SiteNavProps) {
  const tNav = await getTranslations("nav");
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = !!session?.user;

  return (
    <header data-testid="site-nav">
      {utility ? (
        <div className="hidden bg-foreground text-background lg:block">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between px-7 py-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            <span>{utility}</span>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      ) : null}

      <div className="border-b-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-4 lg:px-7 lg:py-5">
          <Link
            href="/"
            className="font-display text-[18px] uppercase tracking-tight lg:text-[22px]"
          >
            <Wordmark />
          </Link>

          <nav className="hidden gap-8 lg:flex">
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("about")}
            </Link>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("instructors")}
            </Link>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("prices")}
            </Link>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-[0.15em] hover:text-primary"
            >
              {tNav("journal")}
            </Link>
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            {!utility ? <LanguageSwitcher tone="light" /> : null}
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
