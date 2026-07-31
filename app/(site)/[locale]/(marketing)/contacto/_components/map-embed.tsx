"use client";

import { useState } from "react";

type MapEmbedProps = {
  /** Google Maps embed URL, mounted only after the visitor opts in. */
  src: string;
  /** `<iframe title>` for the loaded map. */
  title: string;
  /** Placeholder CTA, e.g. "Load the map". */
  loadLabel: string;
  /** Why the click is needed — Google may set cookies. */
  privacyNote: string;
};

// Click-to-load Google Maps (F-096). The Google embed sets a tracking cookie
// (NID) the instant its iframe loads, which under Swiss FADP/GDPR would force a
// consent banner. We dodge that by rendering a cookieless placeholder first and
// mounting the iframe only on an explicit click — consent-by-action, no banner.
export function MapEmbed({ src, title, loadLabel, privacyNote }: MapEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={src}
        title={title}
        data-testid="contact-map"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="mt-6 aspect-[16/9] w-full border border-foreground/15"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      data-testid="contact-map-placeholder"
      className="group mt-6 flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 border border-foreground/15 bg-foreground/[0.03] px-6 text-center transition-colors hover:bg-foreground/[0.06]"
    >
      <span className="inline-flex items-center gap-3 font-display text-xl tracking-tight sm:text-2xl">
        <span
          aria-hidden
          className="block h-[2px] w-8 bg-primary transition-all group-hover:w-12"
        />
        {loadLabel}
      </span>
      <span className="max-w-xs text-xs leading-relaxed text-foreground/60">
        {privacyNote}
      </span>
    </button>
  );
}
