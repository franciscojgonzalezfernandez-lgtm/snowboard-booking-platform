"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type LanguageSwitcherProps = {
  className?: string;
  tone?: "light" | "dark";
};

// Switches locale while preserving the current pathname (incl. params).
// next-intl's `usePathname` from createNavigation returns the locale-stripped
// path, so passing it back with `{ locale }` produces the equivalent URL in
// the target locale.
export function LanguageSwitcher({ className, tone = "dark" }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  const inactiveColor =
    tone === "dark"
      ? "text-primary-foreground/55 hover:text-primary-foreground"
      : "text-muted-foreground hover:text-foreground";
  const activeColor = tone === "dark" ? "text-primary" : "text-primary";

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
            onClick={() => router.replace(pathname, { locale: target })}
            aria-current={target === locale ? "true" : undefined}
            data-testid={`lang-${target}`}
            className={
              "cursor-pointer transition-colors " +
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
