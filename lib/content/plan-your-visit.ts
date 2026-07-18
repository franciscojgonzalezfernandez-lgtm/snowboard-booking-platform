// F-115 — outbound references for the "Plan your visit" hub. Kept to sources we
// can actually stand behind: the resort's own site. We deliberately do NOT
// invent named third-party shops/restaurants — those are owner-curated content
// added over time (see the ticket note); shipping unverified local businesses
// would be worse than a shorter, honest page.
//
// `rel="noopener"` only — these are editorial/follow links (they pass topical
// relevance to the resort on purpose, so no `nofollow`).
export const RESORT_URL = "https://www.flumserberg.ch";
export const RESORT_OPERATING_HOURS_URL =
  "https://www.flumserberg.ch/Operating-hours";
