import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Top nav used by every public page (home, login, future marketing pages).
// Variant B: thin top utility bar on --foreground (ink), then a brand row
// with brand wordmark + nav links + language switcher + dark-pill "Sign in".
export async function SiteNav({ utility }: { utility?: string }) {
  const tNav = await getTranslations("nav");

  return (
    <header>
      {/* utility bar (dark) */}
      {utility ? (
        <div className="bg-foreground text-background">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between px-7 py-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            <span>{utility}</span>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      ) : null}

      {/* brand row */}
      <div className="border-b-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-7 py-5">
          <Link
            href="/"
            className="font-display text-[22px] uppercase tracking-tight"
          >
            Adlerhorst<span className="text-primary">·</span>SBS
          </Link>

          <nav className="hidden gap-8 md:flex">
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

          <div className="flex items-center gap-5">
            {!utility ? <LanguageSwitcher tone="light" /> : null}
            <Link
              href="/login"
              className="rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
            >
              {tNav("signin")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
