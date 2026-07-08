import { ImageResponse } from "next/og";

import { loadOgFonts } from "./og-fonts";

// Canonical OG card geometry + MIME. Re-exported by every `opengraph-image.tsx`
// so the contract lives in one place.
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

// Brand tokens (cream / editorial). Mirrors `app/globals.css` / docs/brand/tokens.md.
const CREAM = "#FAF6F0";
const INK = "#1F1A14";
const ALPINE_RED = "#C7361C";
const HAIRLINE = "#D4C9B3";

// Page headings carry inline markup (e.g. about's `<name>Javi</name>`). The OG
// card is plain text, so flatten any tags before rendering.
export function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type OgCardInput = {
  /** Small uppercase eyebrow, alpine-red. Sourced from the route's `eyebrow`. */
  kicker: string;
  /** Display headline, Archivo Black. Sourced from the route's `heading`. */
  title: string;
};

// The "Ride Flumserberg" wordmark lockup, redrawn for satori (same paths as
// app/components/Wordmark.tsx): ink peak + alpine-red summit flag.
function WordmarkLockup() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="52" height="52" viewBox="0 0 64 64">
        <path d="M5 53 L25 21 L33 33 L40 24 L59 53 Z" fill={INK} />
        <rect x="23.4" y="6" width="2.4" height="16" rx="0.8" fill={INK} />
        <path d="M25.8 7.2 L37 11 L25.8 14.8 Z" fill={ALPINE_RED} />
      </svg>
      <span
        style={{
          fontFamily: "Archivo Black",
          fontSize: 40,
          color: INK,
          letterSpacing: -0.5,
        }}
      >
        Ride Flumserberg
      </span>
    </div>
  );
}

/**
 * Render a localized OG/Twitter card for a marketing route. Loads the embedded
 * brand fonts and composes the cream/editorial layout: wordmark top-left,
 * alpine-red kicker + Archivo Black headline anchored bottom-left.
 */
export async function renderOgImage({
  kicker,
  title,
}: OgCardInput): Promise<ImageResponse> {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CREAM,
          padding: 80,
          // Hairline frame keeps the card from bleeding into light timelines.
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        <WordmarkLockup />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 56, height: 3, background: ALPINE_RED }} />
            <span
              style={{
                fontFamily: "Archivo",
                fontSize: 24,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 5,
                color: ALPINE_RED,
              }}
            >
              {kicker}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Archivo Black",
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: INK,
              maxWidth: 920,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
