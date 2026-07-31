import type { ComponentProps } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  HERO_ANNOUNCEMENT_HIDE_SCRIPT,
  isAllowedCtaHref,
  resolveCtaHref,
} from "@/lib/hero-announcement";

import { HeroAnnouncementClose } from "./HeroAnnouncementClose";

const ctaClassName =
  "shrink-0 text-[12px] font-bold uppercase tracking-[0.16em] underline underline-offset-4 transition-all hover:no-underline";

/**
 * Seasonal / promo band above the home hero (F-053). Server component: copy and
 * the `enabled` toggle live in `messages/*.json` (no admin CMS in MVP), so the
 * owner activates or edits it with a translations PR — no code redeploy. Renders
 * nothing when disabled, so it adds zero DOM then.
 *
 * F-124: the dismissal used to be a server-side `cookies()` read, which made the
 * home dynamic — `no-store`, permanent CDN miss, ~45% of the page's LCP. The
 * band is now static HTML and the cookie is read by a blocking inline script
 * that runs *before* this markup is parsed, so a visitor who already dismissed
 * it never paints the band. Hiding it after paint would have shifted the hero —
 * the LCP element — upward, so a client effect was not an option.
 */
export async function HeroAnnouncement() {
  const t = await getTranslations("hero_announcement");
  if (t("enabled") !== "true") return null;

  const body = t("body");
  const ctaLabel = t("cta_label");
  const ctaHref = resolveCtaHref(t("cta_href"));
  const showCta = ctaLabel.length > 0 && isAllowedCtaHref(ctaHref);
  const isInternalCta = ctaHref.startsWith("/");

  return (
    <>
      {/* Blocking, parser-order script: flags the dismissal on <html> before the
          band below is parsed, so the CSS rule in globals.css hides it with no
          paint and no shift. The payload is a module-level constant with no
          interpolation — nothing user- or content-derived reaches it. */}
      <script
        dangerouslySetInnerHTML={{ __html: HERO_ANNOUNCEMENT_HIDE_SCRIPT }}
      />
      <aside
        data-hero-announcement
        className="relative bg-primary text-primary-foreground"
      >
        <div className="mx-auto flex w-full max-w-[1320px] items-center gap-x-5 gap-y-1 px-7 py-2.5 pr-12 max-[375px]:flex-wrap">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
            {body}
          </p>
          {showCta ? (
            isInternalCta ? (
              <Link
                // `ctaHref` is owner-authored copy (messages JSON), so it is a
                // runtime string rather than a statically-known pathname. It has
                // already passed `isAllowedCtaHref`; cast so next-intl still
                // applies locale prefixing.
                href={ctaHref as ComponentProps<typeof Link>["href"]}
                className={ctaClassName}
              >
                {ctaLabel}
              </Link>
            ) : (
              <a href={ctaHref} className={ctaClassName}>
                {ctaLabel}
              </a>
            )
          ) : null}
        </div>
        <HeroAnnouncementClose label={t("close_label")} />
      </aside>
    </>
  );
}
