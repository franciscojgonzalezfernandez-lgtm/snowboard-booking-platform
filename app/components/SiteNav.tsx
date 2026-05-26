import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";

// Top nav used by every public page (home, login, future marketing pages).
// Variant B: thin top utility bar on --foreground (ink), then a brand row
// with brand wordmark + nav links + language switcher + dark-pill CTA.
// Mobile (<md): brand + hamburger only; nav/lang/CTA move into MobileNav Sheet.
export async function SiteNav({ utility }: { utility?: string }) {
  const tNav = await getTranslations("nav");
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = !!session?.user;

  return (
    <header>
      {/* utility bar (dark) — desktop only; on mobile the message is dropped to
          recover horizontal space for the brand + hamburger. */}
      {utility ? (
        <div className="hidden bg-foreground text-background lg:block">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between px-7 py-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            <span>{utility}</span>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      ) : null}

      {/* brand row */}
      <div className="border-b-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-4 lg:px-7 lg:py-5">
          <Link
            href="/"
            className="font-display text-[18px] uppercase tracking-tight lg:text-[22px]"
          >
            Adlerhorst<span className="text-primary">·</span>SBS
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
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className="rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
            >
              {signedIn ? tNav("dashboard_cta") : tNav("signin")}
            </Link>
          </div>

          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
