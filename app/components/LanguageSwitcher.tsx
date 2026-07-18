"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter as useNextRouter } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type LanguageSwitcherProps = {
  className?: string;
  tone?: "light" | "dark";
};

// Switches locale while preserving the current route (incl. dynamic params).
// With translated `pathnames`, `usePathname` returns the internal pathname key
// and we must re-supply `params` so next-intl can rebuild the target locale's
// slug for dynamic routes (e.g. /instructores/[slug]).
export function LanguageSwitcher({ className, tone = "dark" }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const t = useTranslations("nav");

  // F-108: prefer the hreflang alternate the page emits in <head>. For routes
  // with localized content slugs (blog posts) the source slug doesn't exist in
  // the target locale, so rebuilding the same slug via next-intl 404s — but the
  // alternate URL already points at the target locale's real slug. General: any
  // route emitting alternates inherits the fix. Falls back to the pathname +
  // params rebuild for routes with no alternates (funnel / auth / dashboard).
  function switchTo(target: Locale) {
    if (typeof document !== "undefined") {
      const href = document
        .querySelector(`link[rel="alternate"][hreflang="${target}"]`)
        ?.getAttribute("href");
      if (href) {
        // Alternates are absolute (prod origin); navigate by path so localhost
        // stays on localhost.
        const url = new URL(href, window.location.origin);
        nextRouter.push(url.pathname + url.search);
        return;
      }
    }
    router.replace(
      // @ts-expect-error -- `params` is a generic Record; for the current route
      // its keys always match `pathname`, so the runtime slug rebuild is safe.
      { pathname, params },
      { locale: target },
    );
  }

  const inactiveColor =
    tone === "dark"
      ? "text-primary-foreground/55 hover:text-primary-foreground"
      : "text-muted-foreground hover:text-foreground";
  // Active state marks the current locale. The brand red as *text* fails WCAG AA
  // contrast (~4.26 on cream, ~3.8 on charcoal < 4.5:1), so the label uses the
  // tone's high-contrast ink/snow and the alpine-red survives as an underline
  // accent — a graphical element, which only needs 3:1 (both tones pass).
  const activeColor =
    tone === "dark"
      ? "text-primary-foreground underline decoration-primary decoration-2 underline-offset-4"
      : "text-foreground underline decoration-primary decoration-2 underline-offset-4";

  return (
    <div
      role="group"
      aria-label={t("switch_language_aria")}
      className={
        "flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] " +
        (className ?? "")
      }
    >
      {routing.locales.map((target, index) => (
        <span key={target} className="flex items-center gap-3">
          {index > 0 ? <span aria-hidden className="opacity-30">·</span> : null}
          <button
            type="button"
            onClick={() => switchTo(target)}
            aria-current={target === locale ? "true" : undefined}
            data-testid={`lang-${target}`}
            className={
              "inline-flex min-h-11 min-w-6 cursor-pointer items-center justify-center px-1 transition-colors " +
              (target === locale ? activeColor : inactiveColor)
            }
          >
            {target.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
