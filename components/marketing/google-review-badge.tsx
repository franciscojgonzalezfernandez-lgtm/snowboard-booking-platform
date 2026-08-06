/**
 * Five stars plus the source of the review. The quotes on the home are real
 * Google Business reviews, so attributing them is both honest and the whole
 * point — an unattributed five-star row is decoration, an attributed one is
 * evidence a visitor can go and verify.
 *
 * The mark is Google's trademark and is reproduced unmodified in its four
 * brand colours, as their brand guidelines require. Do not recolour it to
 * match the palette.
 */
export function GoogleReviewBadge({ label, rating }: { label: string; rating: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex gap-1" role="img" aria-label={rating}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} />
        ))}
      </div>
      <span className="inline-flex items-center gap-1.5 border border-foreground/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <GoogleMark />
        {label}
      </span>
    </div>
  );
}

/**
 * Inlined rather than pulled from `lucide-react`: five per card × four cards is
 * the kind of icon count that pushed the home over its JS budget in F-125, and
 * a filled star is nine bytes of path data.
 */
function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-primary">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-3.5 shrink-0">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
