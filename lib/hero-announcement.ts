/**
 * Hero announcement banner (F-053) — shared constants + CTA href guard.
 *
 * No admin CMS in the MVP: copy + the `enabled` toggle live in `messages/*.json`
 * and the version is a source constant. Bump `HERO_ANNOUNCEMENT_VERSION` when the
 * copy changes meaningfully — the dismissal cookie name carries the version, so a
 * bump resets every visitor's "dismissed" state without touching their old cookie.
 */
import { OPERATIONAL_PHONE_TEL } from "@/lib/contact/phone";

export const HERO_ANNOUNCEMENT_VERSION = 1;

export const HERO_ANNOUNCEMENT_COOKIE = `hero_announcement_dismissed_v${HERO_ANNOUNCEMENT_VERSION}`;

/** 30 days, in seconds — TTL for the dismissal cookie. */
export const HERO_ANNOUNCEMENT_DISMISS_TTL = 60 * 60 * 24 * 30;

/**
 * Sentinel `cta_href` value that resolves to the owner's operational phone. The
 * number is **not** re-declared in translations — it lives once in `lib/contact/
 * phone.ts` (F-052) and propagates from there.
 */
export const CTA_PHONE_SENTINEL = "phone";

/**
 * Resolve the raw `cta_href` from i18n to a concrete href. `"phone"` maps to the
 * single-source-of-truth operational phone `tel:` (F-052); everything else passes
 * through unchanged (it is then scheme-checked by `isAllowedCtaHref`).
 */
export function resolveCtaHref(rawHref: string): string {
  return rawHref === CTA_PHONE_SENTINEL ? `tel:${OPERATIONAL_PHONE_TEL}` : rawHref;
}

/**
 * Whitelist the CTA href schemes the i18n copy is allowed to use. The href comes
 * from `messages/*.json` (owner-edited), so treat it as untrusted: only internal
 * paths and `tel:` / `mailto:` / `https://` pass. Rejects `javascript:`, `data:`
 * and protocol-relative `//host` (open-redirect / XSS guard).
 */
export function isAllowedCtaHref(href: string): boolean {
  if (href.startsWith("//")) return false;
  if (href.startsWith("/")) return true;
  return /^(tel:|mailto:|https:\/\/)/.test(href);
}
