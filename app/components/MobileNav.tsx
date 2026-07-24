"use client";

import { useState } from "react";
import { MenuIcon, PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "./Wordmark";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/auth/actions";
import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";
import { LanguageSwitcher } from "./LanguageSwitcher";

type MobileNavProps = {
  signedIn: boolean;
};

export function MobileNav({ signedIn }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const close = () => setOpen(false);

  const linkClass =
    "block min-h-11 py-3 text-sm font-bold uppercase tracking-[0.15em] text-foreground hover:text-primary";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        type="button"
        aria-label={t("open_menu")}
        data-testid="mobile-nav-trigger"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background lg:hidden"
      >
        <MenuIcon className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        data-testid="mobile-nav-sheet"
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
          {/* F-116: match the desktop IA — 3 primary links first, then the
              "More" group (Plan your visit · About). Contact lives in the footer
              + the phone CTA above, not the nav. Flat list on mobile (no nested
              dropdown), ordered so the hierarchy reads the same. */}
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
              <form action={signOutAction} onSubmit={close}>
                <button
                  type="submit"
                  data-testid="mobile-nav-signout"
                  className="block min-h-11 w-full text-center text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
                >
                  {t("sign_out")}
                </button>
              </form>
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
