// Brand wordmark lockup for "The Drop": peak + red summit flag mark followed by
// the wordmark. The peak inherits `currentColor` (ink/foreground); the flag is the
// alpine-red signature. Font/size/casing come from the parent's className.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-[0.95em] w-auto shrink-0"
      >
        <path d="M5 53 L25 21 L33 33 L40 24 L59 53 Z" fill="currentColor" />
        <rect x="23.4" y="6" width="2.4" height="16" rx="0.8" fill="currentColor" />
        <path d="M25.8 7.2 L37 11 L25.8 14.8 Z" fill="#C7361C" />
      </svg>
      The Drop
    </span>
  );
}
