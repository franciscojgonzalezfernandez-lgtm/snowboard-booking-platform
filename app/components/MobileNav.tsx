"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type MobileNavProps = {
  /** See `AuthNav` — pre-resolution state, only the dashboard passes `true`. */
  initialSignedIn?: boolean;
};

// F-125: the sheet body — Base UI's dialog primitive plus the Better Auth
// client, ~48 KB gz between them — is loaded the first time the menu is
// touched instead of on every marketing page load. `warm()` starts that fetch
// on pointer/touch intent, so by the time the tap completes the chunk is
// usually already there and the sheet opens in the same frame.
const importSheet = () => import("./MobileNavSheet");
const MobileNavSheet = dynamic(
  () => importSheet().then((m) => m.MobileNavSheet),
  { ssr: false },
);

export function MobileNav({ initialSignedIn = false }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  // Kept mounted after the first open so closing does not throw the chunk away
  // and re-opening is instant.
  const [loaded, setLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("nav");

  const warm = () => {
    if (!loaded) void importSheet();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("open_menu")}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="mobile-nav-trigger"
        onPointerEnter={warm}
        onTouchStart={warm}
        onFocus={warm}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background lg:hidden"
      >
        <MenuIcon className="h-5 w-5" aria-hidden />
      </button>

      {loaded && (
        <MobileNavSheet
          open={open}
          onOpenChange={setOpen}
          initialSignedIn={initialSignedIn}
          finalFocus={triggerRef}
        />
      )}
    </>
  );
}
