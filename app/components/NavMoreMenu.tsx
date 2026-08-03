"use client";

import type { RefObject } from "react";

import { Link } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type NavMoreMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger button in `NavMore`, which the popup positions against. */
  anchor: RefObject<HTMLButtonElement | null>;
  planLabel: string;
  aboutLabel: string;
};

/**
 * Popup half of `NavMore`, split out in F-125 so `@base-ui/react/menu` is
 * fetched on hover/focus intent rather than on every marketing page load.
 *
 * There is no `DropdownMenuTrigger` here: the trigger lives in the shell so it
 * renders on first paint, and the menu positions against it via `anchor`.
 * Items render as next-intl `Link`s via the `render` prop so locale slug
 * translation (F-102) and prefetch keep working.
 */
export function NavMoreMenu({
  open,
  onOpenChange,
  anchor,
  planLabel,
  aboutLabel,
}: NavMoreMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        anchor={anchor}
        className="min-w-[220px] rounded-none border-2 border-foreground bg-background p-0 shadow-none ring-0"
      >
        <DropdownMenuItem
          data-testid="site-nav-plan"
          render={<Link href="/plan-your-visit" />}
          className="cursor-pointer rounded-none px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] text-foreground focus:bg-foreground focus:text-background"
        >
          {planLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="site-nav-about"
          render={<Link href="/sobre" />}
          className="cursor-pointer rounded-none border-t border-foreground px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] text-foreground focus:bg-foreground focus:text-background"
        >
          {aboutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
