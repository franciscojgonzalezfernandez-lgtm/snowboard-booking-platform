/**
 * Operational phone of the owner (single-instructor MVP, see seed F-021).
 * Single source of truth — nav, footer, T&C and email templates all import
 * from here. When the number changes, edit it once and it propagates global.
 *
 * F-052. The display format (spaced) is universal CH; it is NOT localized.
 */
export const OPERATIONAL_PHONE_DISPLAY = "+41 76 638 18 70";

/** E.164, no spaces — for `tel:` hrefs. Derived so it can never drift. */
export const OPERATIONAL_PHONE_TEL = OPERATIONAL_PHONE_DISPLAY.replace(
  /\s+/g,
  "",
);
