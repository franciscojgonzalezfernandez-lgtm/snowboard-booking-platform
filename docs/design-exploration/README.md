# Design exploration — F-029

Three differentiated hi-fi HTML mockups for the snowboard-booking-platform home + login. Greenfield, no inheritance from the Sprint-0 placeholder (warm-neutral oklch hue 85 + Cormorant Garamond). Each variant proposes its own palette, typography, and tone.

Open each `variant-*/index.html` directly in a browser (`file://` works — no build step). Imagery hot-links to Unsplash; if a photo fails to load the gradient fallback still reads the variant's mood.

## Summary

| Variant | Philosophy reference | Tone (1 sentence) | Display font | Body font | Signature visual move |
|---|---|---|---|---|---|
| **A** | Aesop apothecary | Introspective, quiet, considered — like reading a museum label. | Fraunces (300, opsz 144) | Inter (300–500, −0.011em) | Hairline-bordered cards on warm sand, small-caps everything, hero photo treated as a still-life with no veil. |
| **B** | Patagonia editorial / field manual | Technical, outdoor-storytelling, activist. | Archivo Black (900) | Archivo (400–700) | Full-bleed action hero with red § cue, contour-line pattern behind a 3-column "gear list", magazine-style instructor pull-quote with location badge. |
| **C** | Aman quiet-luxury hospitality | Cinematic, intimate, exclusive. | Playfair Display (300/italic) | Inter (200–400) | Dark-charcoal canvas, bronze accent + italic Playfair "maison" word-mark, hero stretches to 100vh with a long fade and a giant translucent left-quote glyph behind the testimonial. |

## Palettes

### Variant A — Aesop

| Token | Hex | OKLCH | Use |
|---|---|---|---|
| cream | `#F1ECE3` | `oklch(0.93 0.018 80)` | Background |
| cream-deep | `#EBE4D7` | `oklch(0.90 0.020 80)` | Section alt / card |
| ink | `#2A2724` | `oklch(0.23 0.005 60)` | Primary text |
| ink-soft | `#4C4842` | `oklch(0.36 0.006 60)` | Secondary text |
| mute | `#8C857B` | `oklch(0.58 0.012 70)` | Meta / labels |
| hairline | `#D8D2C6` | `oklch(0.83 0.012 80)` | Borders |
| warm | `#C9B79C` | `oklch(0.77 0.045 80)` | Reserved (not currently used in CTAs) |

### Variant B — Patagonia

| Token | Hex | OKLCH | Use |
|---|---|---|---|
| bg | `#FAF6F0` | `oklch(0.96 0.013 75)` | Background |
| bg-alt | `#F1EAD9` | `oklch(0.92 0.025 85)` | Gear-list section |
| ink | `#1F1A14` | `oklch(0.18 0.012 60)` | Primary / dark surfaces |
| ink-soft | `#3B342A` | `oklch(0.30 0.013 65)` | Body text on light |
| mute | `#6B6258` | `oklch(0.46 0.013 70)` | Meta / labels |
| hairline | `#D4C9B3` | `oklch(0.82 0.025 80)` | Soft separators (rare) |
| **accent** | `#C7361C` | `oklch(0.54 0.18 35)` | Brand red — CTAs, accents |
| accent-deep | `#952B18` | `oklch(0.42 0.16 33)` | Hover state |
| moss | `#4D5A3A` | `oklch(0.42 0.06 130)` | Reserved (future blog/secondary tag) |

### Variant C — Aman

| Token | Hex | OKLCH | Use |
|---|---|---|---|
| bg | `#0E0E0C` | `oklch(0.16 0.005 80)` | Background |
| bg-veil | `#1A1815` | `oklch(0.22 0.005 70)` | Cards / login panel |
| ink | `#F2EDE4` | `oklch(0.93 0.014 80)` | Primary text on dark |
| ink-soft | `#C8C2B6` | `oklch(0.79 0.014 80)` | Body text on dark |
| mute | `#8A7E6E` | `oklch(0.56 0.022 75)` | Meta / labels |
| **bronze** | `#B8845F` | `oklch(0.62 0.085 60)` | Accent — CTAs, italic ornament |
| bronze-soft | `#8D6644` | `oklch(0.49 0.075 55)` | Hover state / underlines |
| hairline | `rgba(242,237,228,0.12)` | — | Faint separators |

## Type pairings rationale

- **A — Fraunces + Inter**: Fraunces is a soft, optically-tuned serif that reads as "considered" without crossing into editorial/literary. Pairs with Inter at low weight + small-caps to keep the page deliberately quiet. Avoids Cormorant entirely so this variant doesn't echo the Sprint-0 stub.
- **B — Archivo Black + Archivo**: One family, two weights at the extremes. Black at 900 in uppercase + tight tracking creates the magazine-cover impact; the regular cuts handle nav, body, and form labels. No Inter dilution.
- **C — Playfair Display + Inter**: Playfair's high-contrast modern serif (especially the italic) carries the luxury association without sliding into wedding-invite territory. Inter at 200–400 in dark mode provides quiet, low-weight body text that doesn't fight the serif.

## Mobile behaviour

Each variant ends with a "On a phone" spotlight at 390 × 844 (iPhone 14/15 width) so layouts can be judged at the smallest target viewport. Both home and login states are shown side-by-side.

## Imagery sources

Photos are hot-linked from Unsplash (license-free). If a specific URL 404s, swap the `src` for any other Unsplash photo ID — the gradient fallback behind each `<img>` keeps the variant readable in the meantime.

Used (or referenced) photo IDs:
- `1551698618-1dfe5d97d256` — quiet snowboarder portrait (A hero)
- `1547036967-23d11aacaee0` — action carve under peaks (B hero)
- `1483136256025-bfbdb2c2c8e3` — alpine peaks under low cloud (C hero)
- `1530122037265-a5f1f91d3b99` — instructor at altitude (B editorial)
- `1551524559-8af4e6624178` — mountain composition (mobile-spotlight thumbnails, all variants)

## What's intentionally absent

- No "feature card with emoji icon" patterns
- No purple gradients
- No over-rounded corners (radius is variant-specific: A=0px, B=0px, C=0px — all favour rectangles)
- No SVG-drawn people or product illustrations
- No marketing-stack stats boards / fake testimonial walls

## Decision log

- **Adlerhorst Snowboard School** is a placeholder brand name; can be swapped once the owner confirms. "Verbier · Valais" is the placeholder location, consistent with the PRD's Swiss focus.
- All copy is English-only in mockups; F-031 / F-032 / F-033 will wire EN/DE/ES via next-intl.
- The login form is shown logged-out; logged-in state (server-side redirect to `/[locale]`) is out of scope for visual exploration.

---

**Chosen: Variant B — Patagonia editorial · 2026-05-15.**

Adjustment requested at pick time: buttons get `border-radius: 6px` (Tailwind `rounded-md`) instead of square corners. The card containers, form inputs, and tab strip stay square — only `.btn` and `.signin-btn` round. F-030 should preserve this contrast (rounded buttons inside square cards) when it lifts tokens into `app/globals.css`.
