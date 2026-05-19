import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const tHome = await getTranslations("home");
  const tFooter = await getTranslations("footer");

  return (
    <footer
      data-testid="site-footer"
      className="border-t-2 border-foreground bg-foreground text-background"
    >
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-7 py-12 text-[11px] font-bold uppercase tracking-[0.2em]">
        <span data-testid="footer-copy">{tHome("footer_copy")}</span>
        <span data-testid="footer-loc">{tHome("footer_loc")}</span>
        <nav
          aria-label={tFooter("nav_aria")}
          className="flex flex-wrap items-center gap-5"
        >
          <Link
            href="/terms"
            data-testid="footer-terms-link"
            className="hover:text-primary"
          >
            {tFooter("terms_link")}
          </Link>
          <Link
            href="/privacy"
            data-testid="footer-privacy-link"
            className="hover:text-primary"
          >
            {tFooter("privacy_link")}
          </Link>
          <span aria-hidden="true" className="text-background/70">
            EN <span className="text-primary">·</span> DE{" "}
            <span className="text-primary">·</span> ES
          </span>
        </nav>
      </div>
    </footer>
  );
}
