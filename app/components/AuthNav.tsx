"use client";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient, useSession } from "@/lib/auth/client";

type AuthNavProps = {
  /**
   * What to render while the client session is still resolving. Marketing and
   * auth chrome leave this `false` (anonymous is the overwhelmingly common case
   * there); the dashboard passes `true` because its own auth gate already
   * guarantees a signed-in visitor, so the CTA must never flash "sign in".
   */
  initialSignedIn?: boolean;
};

/**
 * Desktop auth CTA (F-124). This is a client island on purpose: reading the
 * session on the server made `SiteNav` — and therefore every marketing route
 * that mounts it — dynamic, which meant Vercel answered `no-store` + a cache
 * MISS on every request. That TTFB was 45% of the home's LCP.
 *
 * The wrapper reserves the width of the signed-out CTA and right-aligns its
 * content, so the anonymous first paint (the case Lighthouse and ~all marketing
 * traffic hit) settles with zero layout shift. A visitor who turns out to be
 * signed in swaps to the wider account cluster once the session resolves.
 */
export function AuthNav({ initialSignedIn = false }: AuthNavProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { data, isPending } = useSession();
  const signedIn = isPending ? initialSignedIn : !!data?.user;

  const ctaClass =
    "rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary";

  return (
    <div className="hidden min-w-[190px] items-center justify-end gap-5 lg:flex">
      {signedIn ? (
        <>
          <Link
            href="/dashboard"
            data-testid="site-nav-account"
            className={ctaClass}
          >
            {t("dashboard_cta")}
          </Link>
          <button
            type="button"
            data-testid="site-nav-signout"
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
            className="text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
          >
            {t("sign_out")}
          </button>
        </>
      ) : (
        <Link href="/login" data-testid="site-nav-signin" className={ctaClass}>
          {t("signin")}
        </Link>
      )}
    </div>
  );
}
