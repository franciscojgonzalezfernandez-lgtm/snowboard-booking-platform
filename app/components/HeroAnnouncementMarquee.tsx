// F-142: presentational ticker for the hero announcement band. Pure markup (no
// client hooks), so the single-banner path in HeroAnnouncement stays static
// server HTML (LCP-safe, F-124) while the carousel can reuse the exact same
// styling. The drift + edge-fade live in globals.css (`.hero-marquee*`), gated
// behind `prefers-reduced-motion: no-preference`; the base state is one static
// truncated line. The second copy is the seamless-loop twin — aria-hidden so the
// text is announced once.
export function HeroAnnouncementMarquee({ text }: { text: string }) {
  return (
    <div className="hero-marquee">
      <div className="hero-marquee__track">
        <span className="hero-marquee__item">{text}</span>
        <span className="hero-marquee__item hero-marquee__item--dup" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
