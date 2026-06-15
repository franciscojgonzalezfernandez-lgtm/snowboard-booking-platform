# The Drop — Logo & Brand Asset Spec

> Feature spec for producing the brand mark and every logo asset the platform needs.
> Self-contained and **AI-generation-ready** — §7 has paste-ready prompts. Implementation
> ticket: **F-091**. Brand/voice/tokens source of truth: **F-105**.
> Motion (hero animation): **F-090**.
>
> **⚠ Color scheme under review (2026-06-15):** the dark-alpine palette referenced below predates the
> owner's pivot back to the **cream/editorial** theme (the dark-alpine retheme was discarded). The
> already-built F-091 assets are glacier-on-charcoal. **Owner to decide** whether the logo re-colors
> for cream before these assets are finalized — the color sections below are not yet authoritative.

---

## 1. Brand context (paste this into any AI tool first)

- **What:** premium snowboard school, single instructor (the owner), based at **Flumserberg**
  with full-day lessons available across **northern Switzerland**. Private lessons, 1–4 people.
- **Name:** **the drop** — set lowercase. Double meaning: a **snow/water drop** + **"drop in"**
  (the snowboard term for dropping into a run or the pipe).
- **Aesthetic:** editorial / premium — references **Aesop, Cereal magazine, Monocle, Outdoor
  Voices**. **Dark-alpine**, cinematic, high-contrast. NOT sporty-extreme, NOT loud, NOT playful.
- **Palette (source of truth = `app/globals.css`):**
  - Charcoal (background) — `oklch(0.16 0.01 60)` ≈ `#201E1B`
  - Snow (foreground) — `oklch(0.97 0.01 75)` ≈ `#FAF7F1`
  - **Glacier blue (signature)** — `oklch(0.55 0.15 235)` = **`#1E7FBF`**, used **solid** (never gradient)
  - Alpine red `#C7361C` — **alerts/destructive only, NOT in the logo**
- **Type:** **serif display** (NOT Inter, NOT Geist, NOT any sans). High-contrast editorial serif.
- **Forbidden** (hard rules from `CLAUDE.md`): gradients (especially purple/blue), glassmorphism,
  neumorphism, emoji, generic snowflake clipart, drop shadows, 3D bevels, extreme-sports clichés.

---

## 2. The mark — concept directions (pick one)

The symbol is "the drop". Explore these, then commit to one:

- **A — Drop-as-carve:** a single teardrop/snow-drop silhouette whose lower point flows into a
  **carving track** in snow (one continuous stroke). Reads as both a drop and a snowboard turn.
- **B — Negative-space drop:** the drop formed by the gap between two carving tracks.
- **C — Drop-peak:** the drop's pointed tip doubles as a **mountain peak**.

Constraint: the chosen mark MUST survive as a **solid 1-color** shape, legible at **16px**, and
recognisable in monochrome. No fine detail, no thin lines that vanish small.

---

## 3. Logo system

- **Symbol** — the drop mark, standalone.
- **Wordmark** — `the drop`, lowercase, **serif display**, tight tracking.
- **Lockups:**
  1. Horizontal — symbol + wordmark side by side (primary, for the header).
  2. Stacked — symbol over wordmark (for square/social/hero).
  3. Symbol-only — favicon, footer, app icon.
- **Clear space:** = the height of the drop symbol, on all four sides. Nothing intrudes.
- **Min size:** wordmark ≥ 80px wide; symbol ≥ 16px.

---

## 4. Color variants (produce EVERY lockup in each)

| # | Variant | Use |
|---|---|---|
| 1 | Glacier-blue symbol + snow wordmark on **charcoal** | primary, dark UI |
| 2 | Glacier-blue symbol + charcoal wordmark on **snow** (reverse) | light/print contexts |
| 3 | **All-ink** (charcoal monochrome) | single-color dark-on-light |
| 4 | **All-snow** (white monochrome) | over photography, footer |
| 5 | **1-color glacier blue** (single spot) | stamps, favicons, merch |

---

## 5. Asset deliverables (exact — these drop into the Next.js app)

| Asset | File path | Size / format | Background | Notes |
|---|---|---|---|---|
| Favicon master | `app/icon.svg` | SVG, square, **symbol only** | transparent | simplified for 16px legibility |
| Legacy favicon | `app/favicon.ico` | multi-res 16/32/48 ICO | transparent | |
| Apple touch | `app/apple-icon.png` | 180×180 PNG | **opaque charcoal**, ~12% padding | no transparency (iOS) |
| Manifest icon | `app/icon-192.png` | 192×192 PNG | transparent | |
| Manifest icon | `app/icon-512.png` | 512×512 PNG | transparent | |
| Maskable | `app/icon-512-maskable.png` | 512×512 PNG | full-bleed charcoal | **20% safe padding** (Android adaptive) |
| Safari pinned tab | `app/safari-pinned-tab.svg` | 1-color SVG path | — | monochrome, single `<path>` |
| Header lockup | (inline in `SiteNav`) | SVG, `currentColor` | transparent | renders **28px** desktop / **24px** mobile |
| Hero symbol | `public/brand/hero-drop.svg` | **layered** inline SVG | transparent | see §6 — animatable, light + dark |
| Footer mark | (inline in `SiteFooter`) | monochrome SVG | transparent | ~20–24px, single token color |
| OG image | dynamic (`next/og`, F-101) | 1200×630 | charcoal | logo + **localized** tagline; supply logo SVG + safe-zone |
| Social square (optional) | `public/brand/og-square.png` | 1080×1080 | charcoal | Instagram/share |

Manifest (`app/manifest.ts`, built in F-091): `theme_color` = charcoal, accent = glacier blue,
icons = the 192/512/maskable above.

---

## 6. Hero animation note (drives F-090)

The hero drop **animates** via the `motion` library (F-090): the drop **falls + fills** with
glacier blue, or a **carve-trail draws in** beneath it. To make that possible, deliver the hero
SVG with **named, separated paths/groups** so a dev can target them:

- `#drop-body` — the drop silhouette (the fill target)
- `#carve-trail` — the trailing carve stroke (the draw-in target)

It MUST look **intentional and complete when static** (no animation) — required for
`prefers-reduced-motion`. **No Lottie** (`CLAUDE.md` rule); the drop is animated as SVG.

---

## 7. AI generation prompts (paste-ready)

AI image tools output **raster** — after generating, **vectorize** (Illustrator Image Trace,
vectorizer.ai, or similar) and clean the paths, because favicons/scaling need crisp SVG. Then
export the variants (§4) and sizes (§5).

**Prompt — symbol, direction A:**
> Minimal flat vector logo mark for a premium snowboard school called "the drop". A single
> teardrop / snow-drop silhouette whose lower point flows into a smooth carving track in snow,
> one continuous solid shape. Solid glacier blue (#1E7FBF), **no gradient, no shadow, no 3D**,
> geometric, refined, editorial — Monocle / Aesop aesthetic. Centered on dark charcoal (#201E1B),
> generous negative space, legible at small sizes, monochrome-friendly. Clean vector edges.

**Prompt — symbol, direction C (alt):**
> Minimal flat vector logo mark for "the drop" snowboard school. A drop shape whose pointed tip
> doubles as a sharp mountain peak. Single solid weight, glacier blue (#1E7FBF), flat, no gradient,
> no shadow, editorial and premium, charcoal background, lots of negative space, works at 16px.

**Prompt — wordmark:**
> Lowercase wordmark "the drop" in a **high-contrast editorial serif** (Didone / modern serif),
> tight tracking, refined and premium. Snow-white (#FAF7F1) on charcoal (#201E1B). No effects,
> no gradient, no shadow. Clean, magazine-masthead feel.

After generating: trace to SVG → simplify the symbol until it's clean at 16px → build the §4
color variants → export the §5 files.

---

## 8. Do / Don't

**Do:** solid color, generous clear-space, serif wordmark, test in monochrome and at 16px, keep
the drop's silhouette unmistakable.

**Don't:** gradients, snowflake clipart, emoji, 3D/bevel, drop-shadows, stretch/skew, recolor
outside the palette, place on a busy photo without a charcoal scrim.

---

## 9. Tagline (for OG / hero — finalized in F-105, ×3 locales)

Placeholder direction until F-105 locks copy (do **not** bake text into the image — it's injected
per locale by `next/og`):

- EN — *"Private snowboard lessons. Flumserberg & beyond."*
- DE / ES — adapted in tone (not literal) in `messages/{de,es}.json`.

---

**Refs:** F-091 (integration), F-105 (brand/voice/tagline), F-090 (motion),
F-101 (dynamic OG), D-LOGO (owner-produced asset blocker), `CLAUDE.md` §Design direction.
