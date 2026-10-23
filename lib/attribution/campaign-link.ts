import { SITE_URL } from "@/lib/seo/site-url";

// F-156: pure URL-composition for the admin campaign-link cheat-sheet. Kept out
// of the client component so the string logic is unit-tested directly (no DOM /
// hydration). Each preset carries the (source, medium) pair that
// `parseAttribution` classifies into a channel, so the operator picks a platform
// rather than raw UTM internals.

export type LinkPreset = {
  id: string;
  label: string;
  source: string;
  medium: string;
};

export const LINK_PRESETS: LinkPreset[] = [
  { id: "instagram", label: "Instagram", source: "instagram", medium: "social" },
  { id: "tiktok", label: "TikTok", source: "tiktok", medium: "social" },
  { id: "facebook", label: "Facebook", source: "facebook", medium: "social" },
  { id: "google", label: "Google Ads (SEM)", source: "google", medium: "cpc" },
  { id: "seo", label: "Organic / SEO", source: "", medium: "organic" },
];

/** Campaign name → url-safe slug (lowercase, spaces→-, drop other chars). */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Build a UTM-tagged home URL for an online campaign. */
export function buildUtmUrl(preset: LinkPreset, campaign: string): string {
  const params = new URLSearchParams();
  if (preset.source) params.set("utm_source", preset.source);
  params.set("utm_medium", preset.medium);
  const slug = slugify(campaign);
  if (slug) params.set("utm_campaign", slug);
  return `${SITE_URL}/?${params.toString()}`;
}

/** Build the offline QR URL for a known `?c=` code. */
export function offlineCodeUrl(code: string): string {
  return `${SITE_URL}/?c=${code}`;
}
