/**
 * Physical meeting point of the lessons (single-instructor MVP).
 * Single source of truth — the contact page map (F-096) and the booking
 * confirmation email both link here. COLORS is the restaurant at
 * Tannenbodenalp, Flumserberg; its door is where the coach meets riders
 * ("the COLORS door", see docs/brand/voice.md). When the meeting point
 * changes, edit it once and it propagates global.
 */
export const MEETING_POINT_NAME = "COLORS";
export const MEETING_POINT_AREA = "Tannenbodenalp, Flumserberg";

/** Display label combining the landmark and its location. Not localized — a
 * proper noun + place name, identical in en/de/es. */
export const MEETING_POINT_LABEL = `${MEETING_POINT_NAME}, ${MEETING_POINT_AREA}`;

// Google resolves this query to the COLORS restaurant pin at Tannenbodenalp.
// Shared by the outbound directions link and the click-to-load embed so the two
// can never drift to different places.
const MAPS_QUERY = `${MEETING_POINT_NAME}, ${MEETING_POINT_AREA}`;

/**
 * Outbound Google Maps link — a plain `<a>` (no iframe), so it sets no cookies
 * on our pages. Used by the contact page "open in maps" link and the booking
 * confirmation email's meeting-point line.
 */
export const MEETING_POINT_MAPS_HREF =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`;

/**
 * Google Maps embed src for the contact page's click-to-load iframe. Google
 * drops a tracking cookie (NID) the moment this loads, so the page mounts it
 * ONLY after the visitor opts in by clicking — keeping the initial load
 * cookieless and consent-banner-free (F-096 privacy decision).
 */
export const MEETING_POINT_MAPS_EMBED_SRC =
  `https://www.google.com/maps?output=embed&q=${encodeURIComponent(MAPS_QUERY)}`;
