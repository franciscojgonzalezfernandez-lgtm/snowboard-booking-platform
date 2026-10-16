import { BookingSource } from "@prisma/client";

// F-156: the owner's offline campaign codes. Each physical QR (a flyer, a
// station sticker, a poster) encodes a URL like
// `https://rideflumserberg.ch/?c=<code>`; the code maps here to a channel (for
// grouping) and a human label (for the admin rollup). This is the single source
// of truth — add a row here before printing a new QR. A `?c=` code NOT listed
// here is still captured, classified as OTHER, so nothing is silently lost.
//
// Keep codes lowercase kebab-case ([a-z0-9-]); the parser lowercases the query
// value before the lookup. Online ads (SEM/SEO/social) use standard UTM params
// instead of a `?c=` code — see docs/marketing-attribution.md.
export type KnownCampaign = {
  channel: BookingSource;
  label: string;
};

export const KNOWN_CAMPAIGNS: Record<string, KnownCampaign> = {
  "flyer-talstation": {
    channel: BookingSource.FLYER,
    label: "Flyer · Talstation",
  },
  "sticker-bergbahn": {
    channel: BookingSource.STICKER,
    label: "Sticker · Bergbahn gondola",
  },
  "poster-cafe": {
    channel: BookingSource.FLYER,
    label: "Poster · mountain café",
  },
  "sem-google-beginners": {
    channel: BookingSource.PAID_SEARCH,
    label: "Google Ads · beginners",
  },
};

/**
 * Human label for a campaign cell. A known code resolves to its configured
 * label; an unknown but present code shows the raw code; no code falls back to
 * the channel's own label (resolved by the caller via SOURCE_LABEL).
 */
export function campaignLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return KNOWN_CAMPAIGNS[code]?.label ?? code;
}
