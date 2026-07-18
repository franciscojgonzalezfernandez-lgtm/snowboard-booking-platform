import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";

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
            href="/plan-your-visit"
            data-testid="footer-plan-link"
            className="hover:text-primary"
          >
            {tFooter("plan_link")}
          </Link>
          <Link
            href="/faq"
            data-testid="footer-faq-link"
            className="hover:text-primary"
          >
            {tFooter("faq_link")}
          </Link>
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
          <Link
            href="/contacto"
            data-testid="footer-contact-link"
            className="hover:text-primary"
          >
            {tFooter("contact_link")}
          </Link>
          <span aria-hidden="true" className="text-background/70">
            EN <span className="text-primary">·</span> DE{" "}
            <span className="text-primary">·</span> ES
          </span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1320px] px-7 pb-12 text-[11px] font-bold tracking-[0.1em]">
        <a
          href={`tel:${OPERATIONAL_PHONE_TEL}`}
          data-testid="footer-phone-link"
          aria-label={`${tFooter("phone_label")} ${OPERATIONAL_PHONE_DISPLAY}`}
          className="hover:text-primary"
        >
          {OPERATIONAL_PHONE_DISPLAY}
        </a>
      </div>
    </footer>
  );
}
