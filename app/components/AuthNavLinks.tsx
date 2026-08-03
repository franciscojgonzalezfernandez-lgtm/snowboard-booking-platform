"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type AuthNavLinksProps = {
  signedIn: boolean;
  /**
   * Omitted until the Better Auth client has loaded (F-125). The account link
   * renders either way; only the sign-out control needs the client.
   */
  onSignOut?: () => void;
};

/**
 * Presentational half of the desktop auth CTA. Deliberately free of any Better
 * Auth import so `AuthNav` can render it before — and without — the auth
 * client chunk.
 */
export function AuthNavLinks({ signedIn, onSignOut }: AuthNavLinksProps) {
  const t = useTranslations("nav");

  const ctaClass =
    "rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary";

  if (!signedIn) {
    return (
      <Link href="/login" data-testid="site-nav-signin" className={ctaClass}>
        {t("signin")}
      </Link>
    );
  }

  return (
    <>
      <Link href="/dashboard" data-testid="site-nav-account" className={ctaClass}>
        {t("dashboard_cta")}
      </Link>
      {onSignOut && (
        <button
          type="button"
          data-testid="site-nav-signout"
          onClick={onSignOut}
          className="text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
        >
          {t("sign_out")}
        </button>
      )}
    </>
  );
}
