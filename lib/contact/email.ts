/**
 * Operational contact inbox of the owner (single-instructor MVP).
 * Single source of truth — the public contact page (F-096) and every
 * transactional email ("reply or write to …", F-045/F-048) import from here.
 * When the inbox changes, edit it once and it propagates global.
 *
 * F-096. The same address customers are told to write to in the
 * booking/reminder/post-class emails, so the contact page stays consistent.
 * Branded inbox on the rideflumserberg.ch domain — not a personal address —
 * since the contact page exposes it on a public, crawlable surface.
 */
export const CONTACT_EMAIL = "hello@rideflumserberg.ch";

/** `mailto:` href — derived so it can never drift from the display value. */
export const CONTACT_EMAIL_HREF = `mailto:${CONTACT_EMAIL}`;
