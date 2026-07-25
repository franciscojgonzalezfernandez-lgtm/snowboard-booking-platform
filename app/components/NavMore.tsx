"use client";

import { ChevronDownIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavMoreProps = {
  moreLabel: string;
  planLabel: string;
  aboutLabel: string;
};

// F-116: secondary marketing links (Plan your visit + About) collapsed behind a
// "More" dropdown so the desktop brand row keeps to 3 primary links (Prices,
// Instructors, Field notes). Contact was pulled out of the nav on purpose — it
// stays in the footer + the phone CTA in the utility bar — to keep the nav lean
// and focused on booking. Client island — SiteNav stays a Server Component. The
// dropdown is a Base UI menu (keyboard + aria handled by the primitive); items
// render as next-intl `Link`s via the `render` prop so locale slug translation
// (F-102) and prefetch keep working. Styled editorial: square border, no shadow.
export function NavMore({ moreLabel, planLabel, aboutLabel }: NavMoreProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="site-nav-more"
        className="group inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary data-[popup-open]:text-primary"
      >
        {moreLabel}
        <ChevronDownIcon
          className="h-3.5 w-3.5 transition-transform group-data-[popup-open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
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
