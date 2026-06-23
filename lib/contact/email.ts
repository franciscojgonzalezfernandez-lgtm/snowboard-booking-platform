/**
 * Operational contact inbox of the owner (single-instructor MVP).
 * Single source of truth — the public contact page (F-096) and every
 * transactional email ("reply or write to …", F-045/F-048) import from here.
 * When the inbox changes, edit it once and it propagates global.
 *
 * F-096. This is the address customers are already told to write to in the
 * booking/reminder/post-class emails, so the contact page stays consistent.
 */
export const CONTACT_EMAIL = "franciscojgonzalezfernandez@gmail.com";

/** `mailto:` href — derived so it can never drift from the display value. */
export const CONTACT_EMAIL_HREF = `mailto:${CONTACT_EMAIL}`;
