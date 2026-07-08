# Ride Flumserberg — Logo & Brand Assets (as built)

> What's live after **F-091**. The source artwork was produced by the owner; F-091 integrated it and
> generated all asset formats. Brand/voice: **F-105**. Colors: cream/editorial (`docs/brand/tokens.md`).
> The earlier "drop glyph" concept is **discarded — no teardrop anywhere.**

---

## The logo system

- **Primary logo** — `public/brand/logo-full.png`. "THE DROP" in a bold slab with an inline/embossed
  face (subtle 3D), a hand-drawn mountain + snowboarder carving a red line to a summit flag, a red
  underline, and "ENJOY YOUR LINE." Source: `Logos drop/image.jpeg`, **trimmed + cream keyed to
  transparent** (so it sits on the cream page), 1200px wide. Use **large**: hero (F-092), about, OG, social.
- **Header / footer / funnel wordmark** — `app/components/Wordmark.tsx`. A compact lockup: the
  **peak + red-flag mark** + "Ride Flumserberg" in the display font (Archivo Black), `currentColor`. Mounted in
  `SiteNav`, `MobileNav`, `booking-header`. (Replaced the placeholder "Adlerhorst·SBS".)
- **Favicon / app-icon** — `app/icon.svg`. The **mountain peak with a red summit flag**, lifted from
  the logo so the icon and logo are one family. Legible at 16px.

## Generated asset set (F-091)

| File | What |
|---|---|
| `app/icon.svg` | peak + red flag — vector favicon (ink `currentColor`-friendly + red flag) |
| `app/favicon.ico` | 16/32 peak |
| `app/apple-icon.png` | 180×180, peak on cream |
| `public/icon-192.png`, `public/icon-512.png` | peak, transparent (manifest) |
| `public/icon-512-maskable.png` | peak on cream, ~20% safe area (Android adaptive) |
| `app/safari-pinned-tab.svg` | monochrome peak |
| `app/manifest.ts` | cream `theme_color` `#FAF6F0` + the icons above |
| `public/brand/logo-full.png` | the full logo, cream-keyed, 1200w |
| `app/[locale]/(marketing)/opengraph-image.tsx` | home OG (logo on cream, 1200×630, node runtime) |

## Regenerate

Raster assets derive from `app/icon.svg` (peak rasterized to PNG/ICO via `sharp`) and the source
`image.jpeg` (trimmed + cream-keyed). To swap the logo: replace `public/brand/logo-full.png` and
re-run the generation (see the F-091 commit for the `sharp` script). The favicon edits in `app/icon.svg`
flow to every size on re-run.

## Colors / type

cream `#FAF6F0` · ink `#1F1A14` · alpine red `#C7361C` (flag + underline). Display: **Archivo Black**.
Source of truth: `docs/brand/tokens.md`.

## Notes

- **No drop glyph** — the teardrop concept is retired across all assets.
- The full vintage badge variants the owner explored (`Logos drop/`) are available for large emblem use
  (about page / merch) if wanted later — not wired in F-091.
- Hero animation (wordmark/logo reveal via `lib/motion/wordmark-reveal`) is wired in **F-092** (home
  recompose), not here.

**Refs:** F-091, F-105 (brand/voice/tagline), F-090 (motion), F-101 (dynamic OG), `docs/brand/tokens.md`.
