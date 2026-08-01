"use client";

import type { RefObject } from "react";
import { PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { Wordmark } from "./Wordmark";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { authClient, useSession } from "@/lib/auth/client";
import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";
import { LanguageSwitcher } from "./LanguageSwitcher";

type MobileNavSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** See `AuthNav` — pre-resolution state, only the dashboard passes `true`. */
  initialSignedIn?: boolean;
  /** Where focus returns when the sheet closes: the trigger in `MobileNav`. */
  finalFocus: RefObject<HTMLButtonElement | null>;
};

/**
 * Body of the mobile menu, split out of `MobileNav` in F-125 and loaded on
 * demand. Everything expensive lives here — the Base UI dialog primitive
 * (~48 KB gz shared with the desktop menu) and the Better Auth client — so the
 * marketing pages ship only the trigger button until someone taps it.
 *
 * The dialog is controlled from the shell and has no `SheetTrigger` of its own:
 * the trigger stays mounted in `MobileNav` so it is present on first paint.
 */
export function MobileNavSheet({
  open,
  onOpenChange,
  initialSignedIn = false,
  finalFocus,
}: MobileNavSheetProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const close = () => onOpenChange(false);

  // F-124: the session is read here rather than passed down from the server, so
  // SiteNav's layouts stay static. The sheet is behind a tap, so the session has
  // always resolved by the time these controls are visible.
  const { data, isPending } = useSession();
  const signedIn = isPending ? initialSignedIn : !!data?.user;

  const linkClass =
    "block min-h-11 py-3 text-sm font-bold uppercase tracking-[0.15em] text-foreground hover:text-primary";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="mobile-nav-sheet"
        finalFocus={finalFocus}
        className="flex w-full max-w-xs flex-col gap-0 bg-background p-0 sm:max-w-sm lg:hidden"
      >
        <SheetHeader className="border-b-2 border-foreground p-7">
          <SheetTitle className="font-display text-[22px] uppercase tracking-tight text-foreground">
            <Wordmark />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 px-7 py-6">
          <a
            href={`tel:${OPERATIONAL_PHONE_TEL}`}
            onClick={close}
            data-testid="mobile-nav-phone"
            aria-label={`${t("phone_label")} ${OPERATIONAL_PHONE_DISPLAY}`}
            className="mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-foreground px-5 py-3 text-sm font-bold tracking-[0.05em] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <PhoneIcon className="h-4 w-4" aria-hidden />
            {OPERATIONAL_PHONE_DISPLAY}
          </a>
          {/* F-116: match the desktop IA — primary links first (Prices ·
              Instructors · Field notes · Contact), then the "More" group (Plan
              your visit · About). Flat list on mobile (no nested dropdown),
              ordered so the hierarchy reads the same. */}
          <Link href="/precios" onClick={close} className={linkClass}>
            {t("prices")}
          </Link>
          <Link href="/instructores" onClick={close} className={linkClass}>
            {t("instructors")}
          </Link>
          <Link href="/blog" onClick={close} className={linkClass}>
            {t("journal")}
          </Link>
          <Link
            href="/contacto"
            onClick={close}
            data-testid="mobile-nav-contact"
            className={linkClass}
          >
            {t("contact")}
          </Link>
          <Link
            href="/plan-your-visit"
            onClick={close}
            data-testid="mobile-nav-plan"
            className={linkClass}
          >
            {t("plan")}
          </Link>
          <Link href="/sobre" onClick={close} className={linkClass}>
            {t("about")}
          </Link>
          <Link href="/reservar" onClick={close} className={linkClass}>
            {t("reservar")}
          </Link>
        </nav>

        <div className="flex flex-col gap-5 border-t-2 border-foreground px-7 py-6">
          <LanguageSwitcher tone="light" className="justify-start" />
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                onClick={close}
                data-testid="mobile-nav-account"
                className="block min-h-11 w-full rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
              >
                {t("dashboard_cta")}
              </Link>
              <button
                type="button"
                data-testid="mobile-nav-signout"
                onClick={async () => {
                  close();
                  await authClient.signOut();
                  router.push("/");
                  router.refresh();
                }}
                className="block min-h-11 w-full text-center text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
              >
                {t("sign_out")}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={close}
              data-testid="mobile-nav-signin"
              className="block min-h-11 w-full rounded-md border-2 border-foreground bg-foreground px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:border-primary"
            >
              {t("signin")}
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
