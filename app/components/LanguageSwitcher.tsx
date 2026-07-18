"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

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
  const t = useTranslations("nav");

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
            onClick={() =>
              router.replace(
                // @ts-expect-error -- `params` is a generic Record; for the
                // current route its keys always match `pathname`, so the
                // runtime slug rebuild is safe.
                { pathname, params },
                { locale: target },
              )
            }
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
