// F-115 — outbound references for the "Plan your visit" hub. Kept to sources we
// can stand behind: the resort's own site, and the gear-rental shops the owner
// vouches for (Intersport Rent Flumserberg, added 2026-07-21 from
// https://www.intersportrent.com/skirent-flumserberg). We do NOT invent
// businesses — new entries come from the owner.
//
// `rel="noopener"` only — these are editorial/follow links (they pass topical
// relevance on purpose, so no `nofollow`).
export const RESORT_OPERATING_HOURS_URL =
  "https://www.flumserberg.ch/Operating-hours";

/** Owner-recommended gear rental at Flumserberg (Intersport Rent). */
export const INTERSPORT_RENT_URL =
  "https://www.intersportrent.com/skirent-flumserberg";

/** The Intersport Rent shop locations at Flumserberg. Names/addresses are proper
 * nouns → not translated (they live here, not in `messages`). */
export const RENTAL_SHOPS = [
  {
    name: "Intersport Flumserberg",
    address: "Flumserbergstrasse 192, 8898 Tannenboden",
  },
  {
    name: "Intersport Network",
    address: "Flumserbergstrasse 134, 8897 Flumserberg Tannenheim",
  },
  {
    name: "Intersport Network",
    address: "Molseralpstrasse 9, 8898 Flumserberg Tannenboden",
  },
] as const;
