"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDownIcon } from "lucide-react";

type NavMoreProps = {
  moreLabel: string;
  planLabel: string;
  aboutLabel: string;
};

// F-125: `@base-ui/react/menu` is fetched on intent (hover, focus, or the tap
// itself) rather than on every marketing page load. Desktop always hovers
// before it clicks, so the chunk is in cache by the time the menu is asked for.
const importMenu = () => import("./NavMoreMenu");
const NavMoreMenu = dynamic(() => importMenu().then((m) => m.NavMoreMenu), {
  ssr: false,
});

// F-116: secondary marketing links (Plan your visit + About) collapsed behind a
// "More" dropdown so the desktop brand row keeps to 3 primary links (Prices,
// Instructors, Field notes). Contact was pulled out of the nav on purpose — it
// stays in the footer + the phone CTA in the utility bar — to keep the nav lean
// and focused on booking. Client island — SiteNav stays a Server Component.
// Styled editorial: square border, no shadow.
export function NavMore({ moreLabel, planLabel, aboutLabel }: NavMoreProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const warm = () => {
    if (!loaded) void importMenu();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Standard menu behaviour: Escape or a selection returns focus to the
    // trigger. The primitive cannot do it for us — it never owned the trigger.
    if (!next) triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="site-nav-more"
        aria-expanded={open}
        aria-haspopup="menu"
        data-popup-open={open ? "" : undefined}
        onPointerEnter={warm}
        onFocus={warm}
        onClick={() => {
          setLoaded(true);
          setOpen((prev) => !prev);
        }}
        className="group inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary data-[popup-open]:text-primary"
      >
        {moreLabel}
        <ChevronDownIcon
          className="h-3.5 w-3.5 transition-transform group-data-[popup-open]:rotate-180"
          aria-hidden
        />
      </button>

      {loaded && (
        <NavMoreMenu
          open={open}
          onOpenChange={handleOpenChange}
          anchor={triggerRef}
          planLabel={planLabel}
          aboutLabel={aboutLabel}
        />
      )}
    </>
  );
}
