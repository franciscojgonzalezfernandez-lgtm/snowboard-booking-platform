"use server";

import { cookies } from "next/headers";

import {
  HERO_ANNOUNCEMENT_COOKIE,
  HERO_ANNOUNCEMENT_DISMISS_TTL,
} from "@/lib/hero-announcement";

/**
 * Persist the visitor's dismissal of the hero announcement banner (F-053). The
 * client island calls this, then `router.refresh()` re-runs the server component
 * which now sees the cookie and renders nothing.
 */
export async function dismissHeroAnnouncement(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(HERO_ANNOUNCEMENT_COOKIE, "1", {
    maxAge: HERO_ANNOUNCEMENT_DISMISS_TTL,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
