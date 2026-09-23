import type { ComponentProps } from "react";
import type { Locale } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  HERO_ANNOUNCEMENT_HIDE_SCRIPT,
  isAllowedCtaHref,
  resolveCtaHref,
} from "@/lib/hero-announcement";
import { getEnabledAdBanners } from "@/lib/marketing/cache";

import { HeroAnnouncementCarousel } from "./HeroAnnouncementCarousel";
import { HeroAnnouncementClose } from "./HeroAnnouncementClose";

const ctaClassName =
  "shrink-0 text-[12px] font-bold uppercase tracking-[0.16em] underline underline-offset-4 transition-all hover:no-underline";

/**
 * Home hero announcement band. Owner-authored in the admin panel and stored in
 * the `AdBanner` table (F-142) — the F-053 messages-only band was migrated here.
 * Renders nothing when no banner is enabled, so it adds zero DOM then.
 *
 * A single enabled banner renders as static server HTML — the same LCP-safe
 * contract as F-124: the band sits above the hero (the LCP element), so it must
 * not read request data and must not shift the hero. When two or more banners
 * are enabled they rotate every 5s in a client island (`HeroAnnouncementCarousel`)
 * that fades in place (fixed single-line height → no shift) and is gated behind
 * `prefers-reduced-motion`.
 *
 * The dismissal is still the blocking inline script + CSS rule (F-124): it flags
 * `<html>` before the band is parsed, so a returning visitor never paints it.
 */
export type LocalizedBanner = {
  id: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaIsInternal: boolean;
};

/** Pick a locale string from an admin-authored `{ en, de, es }` JSON blob. */
function pickText(value: unknown, locale: Locale): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const preferred = rec[locale];
  if (typeof preferred === "string" && preferred.trim().length > 0) return preferred;
  const en = rec.en;
  return typeof en === "string" && en.trim().length > 0 ? en : null;
}

export async function HeroAnnouncement() {
  const banners = await getEnabledAdBanners();
  if (banners.length === 0) return null;

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("hero_announcement");

  const items: LocalizedBanner[] = banners
    .map((banner): LocalizedBanner | null => {
      const body = pickText(banner.body, locale);
      if (!body) return null;

      const ctaLabel = pickText(banner.ctaLabel, locale);
      const rawHref = banner.ctaHref ? resolveCtaHref(banner.ctaHref) : null;
      const hasCta = Boolean(ctaLabel && rawHref && isAllowedCtaHref(rawHref));
      return {
        id: banner.id,
        body,
        ctaLabel: hasCta ? ctaLabel : null,
        ctaHref: hasCta ? rawHref : null,
        ctaIsInternal: hasCta ? rawHref!.startsWith("/") : false,
      };
    })
    .filter((item): item is LocalizedBanner => item !== null);

  if (items.length === 0) return null;

  // Blocking, parser-order dismissal script — see lib/hero-announcement.ts. The
  // payload is a module-level constant with no interpolation.
  const hideScript = (
    <script dangerouslySetInnerHTML={{ __html: HERO_ANNOUNCEMENT_HIDE_SCRIPT }} />
  );

  if (items.length > 1) {
    return (
      <>
        {hideScript}
        <HeroAnnouncementCarousel
          items={items}
          closeLabel={t("close_label")}
          regionLabel={t("region_label")}
          previousLabel={t("previous")}
          nextLabel={t("next")}
        />
      </>
    );
  }

  // Single banner — static server markup (LCP-safe, F-124).
  const item = items[0];
  if (!item) return null;
  return (
    <>
      {hideScript}
      <aside
        data-hero-announcement
        className="relative bg-primary text-primary-foreground"
      >
        <div className="mx-auto flex w-full max-w-[1320px] items-center gap-x-5 gap-y-1 px-7 py-2.5 pr-12 max-[375px]:flex-wrap">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
            {item.body}
          </p>
          {item.ctaLabel && item.ctaHref ? (
            item.ctaIsInternal ? (
              <Link
                href={item.ctaHref as ComponentProps<typeof Link>["href"]}
                className={ctaClassName}
              >
                {item.ctaLabel}
              </Link>
            ) : (
              <a href={item.ctaHref} className={ctaClassName}>
                {item.ctaLabel}
              </a>
            )
          ) : null}
        </div>
        <HeroAnnouncementClose label={t("close_label")} />
      </aside>
    </>
  );
}
