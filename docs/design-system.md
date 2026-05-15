# Design System — Patagonia-editorial (F-029 Variant B)

Source of truth for the runtime tokens. Lifted from `docs/design-exploration/variant-B/index.html` after the F-029 pick (2026-05-15). Owned by `app/globals.css` + `app/layout.tsx`. Update those alongside any token change here.

## Philosophy

Premium-outdoor, field-manual aesthetic. Editorial type at extreme weight contrast (heavy display vs. regular body), warm cream canvas, single alpine-red accent that carries every CTA and brand cue. Square cards and inputs with `rounded-md` (6px) buttons — the only place a corner is softened.

## Palette

Defined in oklch in `app/globals.css :root`. Hex equivalents are reference only — the runtime is oklch.

| Token (CSS var) | Hex | OKLCH | Role |
|---|---|---|---|
| `--background` | `#FAF6F0` | `oklch(0.96 0.013 75)` | Page canvas |
| `--foreground` | `#1F1A14` | `oklch(0.18 0.012 60)` | Primary text |
| `--primary` | `#C7361C` | `oklch(0.54 0.18 35)` | Alpine red · main CTA, brand cues, focus rings |
| `--primary-foreground` | `#FAF6F0` | `oklch(0.96 0.013 75)` | Text on `--primary` |
| `--secondary` | `#F1EAD9` | `oklch(0.92 0.025 85)` | Section alt bg (gear-list), muted surfaces |
| `--secondary-foreground` | `#1F1A14` | `oklch(0.18 0.012 60)` | Text on `--secondary` |
| `--muted` | `#F1EAD9` | `oklch(0.92 0.025 85)` | Same as secondary; shadcn duality |
| `--muted-foreground` | `#6B6258` | `oklch(0.46 0.013 70)` | Meta / labels / eyebrow text |
| `--accent` | `#F1EAD9` | `oklch(0.92 0.025 85)` | Subtle hover bg on light surfaces |
| `--accent-foreground` | `#1F1A14` | `oklch(0.18 0.012 60)` | Text on `--accent` |
| `--destructive` | `#952B18` | `oklch(0.42 0.16 33)` | Errors · also the darker-red hover state |
| `--border` | `#D4C9B3` | `oklch(0.82 0.025 80)` | Hairlines / dividers |
| `--input` | same as border | — | Form input borders |
| `--ring` | `#C7361C` | `oklch(0.54 0.18 35)` | Focus ring |
| `--brand-ink` | `#1F1A14` | `oklch(0.18 0.012 60)` | Explicit dark-surface token for "btn-dark" / sign-in nav button / dark login section |
| `--brand-ink-foreground` | `#FAF6F0` | `oklch(0.96 0.013 75)` | Text on `--brand-ink` |
| `--brand-bg-alt` | `#F1EAD9` | `oklch(0.92 0.025 85)` | Editorial section alt bg |

Dark mode (`.dark` class): inverts canvas — `--background` becomes the dark ink, `--foreground` becomes cream. Primary stays red but slightly lifted (`L 0.62`) to keep contrast against the dark canvas. Variant B is *not* a dark-first design — Variant B uses dark surfaces as **section overrides** (e.g. the login section on `--brand-ink`), not as a global mode. `.dark` exists to keep shadcn primitives functional in case a global dark toggle is added later.

### Reserved tokens (not wired to UI yet)

- `--chart-2` = moss `oklch(0.42 0.06 130)` — kept for a future blog/secondary tag without taking up a brand slot.

## Typography

Loaded via `next/font/google` in `app/layout.tsx`:

```ts
const archivo = Archivo({ variable: "--font-archivo", weight: ["400","500","600","700"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", weight: ["400"] });
```

CSS exposes:

- `--font-sans` → `--font-archivo` (body)
- `--font-display` / `--font-heading` → `--font-archivo-black` (headings)

### Base rules in `globals.css`

```css
html { font-family: var(--font-archivo), system-ui, -apple-system, sans-serif; }
h1, h2, h3 {
  font-family: var(--font-archivo-black), var(--font-archivo), system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: -0.015em;
  line-height: 0.95;
}
```

### Type scale (recommended)

| Slot | Size (clamp) | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero / `h1` | `clamp(48px, 9.5vw, 132px)` | 900 (Archivo Black) | `-0.02em` | Hero only; uppercase; line-height 0.9 |
| Section / `h2` | `clamp(36px, 5.5vw, 64px)` | 900 | `-0.02em` | Uppercase; line-height 0.95 |
| Subsection / `h3` | `28px` desktop / `24px` mobile | 900 | `-0.01em` | Uppercase |
| Eyebrow / label | `11–13px` | 700 (Archivo) | `0.18em–0.28em` | Uppercase, `--muted-foreground` |
| Body L | `17–18px` | 400 | `0` | Hero sub-copy |
| Body M | `15–16px` | 400 | `0` | Default |
| Body S | `12–13px` | 500–700 | `0.15em` | Nav links, button text |

Use `text-wrap: balance` on hero `h1` and section `h2`; `text-wrap: pretty` on body paragraphs.

## Spacing & layout

- Container max-width: `1320px`, horizontal padding `28px` (matches Variant B).
- Section vertical rhythm: hero `~86vh` full-bleed → sections `96–120px` top/bottom on desktop, `64–80px` on mobile.
- Grid: 3-column gear-list collapses to 1-column at `<720px`.
- Hairline borders: 1px (`--border`); 2px solid `--foreground` for top-of-section / bottom-of-section emphasis (e.g. nav, gearlist separators).

## Radius

- `--radius` = `0.375rem` (6px) → maps to Tailwind `rounded-md` via the `--radius-*` scale in `@theme inline`.
- **Applied to buttons only.** Cards, inputs, tabs, login panel stay square. This contrast is part of the variant signature — do not round inputs/cards in F-032 / F-033 / future tickets without revisiting.

## Buttons (component contracts)

shadcn `Button` variant mapping:

| Variant | Style | Use |
|---|---|---|
| `default` | `bg-primary text-primary-foreground` (alpine red on cream text), `rounded-md`, 2px border same as bg | Main CTAs ("Book a lesson", "Sign in", form submit) |
| `outline` | `border-2 border-foreground bg-background text-foreground`, `rounded-md` | "Continue with Google" |
| `ghost` | transparent bg, `text-foreground`, dashed `2px dashed border-foreground`, `rounded-md` | "Email me a magic link" (Variant B used dashed-border ghost for magic link) |
| `secondary` | `bg-brand-ink text-brand-ink-foreground`, `rounded-md` | Dark-on-light "btn-dark" — e.g. nav "Sign in" pill |
| `destructive` | `bg-destructive text-primary-foreground`, `rounded-md` | Errors (rare; same red family as primary, slightly darker) |

Hover state for `default`: `bg-destructive` (the deeper red `#952B18`). Encode in component variants or `:hover` rules; do not hardcode hex in pages.

## Motion (tokens for future use)

Variant B uses very subtle transitions — magazine quietness, not animated UI. Recommended defaults:

| Token | Value | Use |
|---|---|---|
| Duration short | `140ms` | Button hover, link color |
| Duration mid | `220ms` | Tab swap, focus ring |
| Easing | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default for all UI transitions |

Reduced motion: respect `@media (prefers-reduced-motion: reduce)` — set all durations to `0ms` when matched.

## Imagery direction

- Action shots full-bleed (hero) — environmental, no studio polish.
- Single-instructor portraits with location badge (e.g. `Verbier · 2620m`) as a red overlay.
- Topographic contour-line SVG patterns at low opacity (`0.18`) behind sections that need texture.
- Avoid: stock-y stats grids, drop-shadow cards, gradient bands, generic "feature with icon" rows.

## What's intentionally absent

- Cormorant Garamond / serif display (was Sprint-0 placeholder, dropped in F-028b, not reintroduced)
- Warm-neutral oklch hue 85 (was Sprint-0 placeholder)
- Drop shadows (not used in Variant B)
- Multiple accent colors (only `--primary` red carries brand identity)
- Border-radius on inputs/cards (square stays the language of containers)

## References

- Mockup source: [`docs/design-exploration/variant-B/index.html`](./design-exploration/variant-B/index.html)
- Variant comparison: [`docs/design-exploration/README.md`](./design-exploration/README.md)
- Sprint 0.5 roadmap: PRD §12 + FEATURES.md F-028..F-034
