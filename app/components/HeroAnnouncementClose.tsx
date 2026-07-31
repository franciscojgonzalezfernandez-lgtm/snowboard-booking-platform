"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  HERO_ANNOUNCEMENT_COOKIE,
  HERO_ANNOUNCEMENT_DISMISSED_CLASS,
  HERO_ANNOUNCEMENT_DISMISS_TTL,
} from "@/lib/hero-announcement";

/**
 * Minimal client island: the only JS the banner ships. 44px tap target (F-051
 * audit).
 *
 * F-124: the dismissal is written straight to `document.cookie` and reflected by
 * flipping the flag class on `<html>`. It used to call a Server Action and then
 * `router.refresh()` so the server component would re-evaluate — but that
 * server-side `cookies()` read is exactly what made the home page uncacheable,
 * so the band is static now and there is no server render left to refresh. Same
 * cookie name and TTL as before, so dismissals already out there still count.
 */
export function HeroAnnouncementClose({ label }: { label: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        document.cookie = `${HERO_ANNOUNCEMENT_COOKIE}=1; path=/; max-age=${HERO_ANNOUNCEMENT_DISMISS_TTL}; SameSite=Lax`;
        document.documentElement.classList.add(
          HERO_ANNOUNCEMENT_DISMISSED_CLASS,
        );
        setDismissed(true);
      }}
      className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-primary-foreground/75 transition-colors hover:text-primary-foreground"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}
