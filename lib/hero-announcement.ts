/**
 * Hero announcement banner (F-053) — shared constants + CTA href guard.
 *
 * No admin CMS in the MVP: copy + the `enabled` toggle live in `messages/*.json`
 * and the version is a source constant. Bump `HERO_ANNOUNCEMENT_VERSION` when the
 * copy changes meaningfully — the dismissal cookie name carries the version, so a
 * bump resets every visitor's "dismissed" state without touching their old cookie.
 */
export const HERO_ANNOUNCEMENT_VERSION = 1;

export const HERO_ANNOUNCEMENT_COOKIE = `hero_announcement_dismissed_v${HERO_ANNOUNCEMENT_VERSION}`;

/** 30 days, in seconds — TTL for the dismissal cookie. */
export const HERO_ANNOUNCEMENT_DISMISS_TTL = 60 * 60 * 24 * 30;

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
