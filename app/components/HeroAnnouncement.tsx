import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  HERO_ANNOUNCEMENT_COOKIE,
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
 * nothing when disabled or already dismissed (cookie), so it adds zero DOM then.
 */
export async function HeroAnnouncement() {
  const t = await getTranslations("hero_announcement");
  if (t("enabled") !== "true") return null;

  const cookieStore = await cookies();
  if (cookieStore.has(HERO_ANNOUNCEMENT_COOKIE)) return null;

  const body = t("body");
  const ctaLabel = t("cta_label");
  const ctaHref = resolveCtaHref(t("cta_href"));
  const showCta = ctaLabel.length > 0 && isAllowedCtaHref(ctaHref);
  const isInternalCta = ctaHref.startsWith("/");

  return (
    <aside className="relative bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-x-5 gap-y-1 px-7 py-2.5 pr-12 max-[375px]:flex-wrap">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
          {body}
        </p>
        {showCta ? (
          isInternalCta ? (
            <Link href={ctaHref} className={ctaClassName}>
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
  );
}
