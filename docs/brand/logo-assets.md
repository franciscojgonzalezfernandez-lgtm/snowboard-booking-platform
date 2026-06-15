# The Drop — Logo & Brand Asset Spec

> Feature spec for producing the logo and every brand asset. Self-contained and
> **AI-generation-ready** — §7 has paste-ready prompts. Implementation ticket: **F-091**.
> Brand/voice/tagline source of truth: **F-105**. Hero animation: **F-090**.
>
> **Concept (owner decision, 2026-06-15):** the logo IS the **3D "The Drop" wordmark** — bold letters
> with a subtle matte extrude. **No drop glyph, no symbol mark.** A **snowflake** (favicon) and a
> **snowboard** are optional decorative accents only. Simple, not complicated.

---

## 1. Brand context (paste this into any AI tool first)

- **What:** premium snowboard school, single instructor (the owner), based at **Flumserberg** with
  full-day lessons across **northern Switzerland**. Private lessons, 1–4 people.
- **Name:** **The Drop** — from *drop in*, the snowboard term for dropping into a run/the pipe (also
  nods to dropping into the season). **It is NOT a water-drop** — there is no drop shape anywhere.
- **Aesthetic:** editorial / premium — references **Aesop, Cereal magazine, Monocle, Outdoor Voices**.
  Warm, cream/editorial, high-contrast type. NOT sporty-extreme, NOT loud, NOT gamer.
- **Palette (source of truth = `app/globals.css`, cream/editorial):**
  - Cream (background) — `oklch(0.96 0.013 75)` ≈ `#FAF6F0`
  - Ink (foreground) — `oklch(0.18 0.012 60)` ≈ `#1F1A14`
  - **Alpine red (signature)** — `#C7361C`, solid (never gradient)
- **Type:** bold grotesque display (the app uses **Archivo Black**); the wordmark extrudes that kind
  of bold letterform.
- **Forbidden** (`CLAUDE.md`, with one owner override): gradients, glassmorphism, neumorphism, emoji,
  generic snowflake clipart, extreme-sports clichés. **Override:** a *subtle, matte* 3D extrude on the
  wordmark is wanted — keep it refined (no gloss, no harsh bevel, no gamer chrome).

---

## 2. The logo — 3D "The Drop" wordmark

- The wordmark **"The Drop"** in **bold letters with a subtle matte 3D extrude**: ink faces
  (`#1F1A14`) with a slightly darker ink depth. Soft, premium, editorial — *not* glossy, *not* a
  harsh bevel. Front-on or a very slight angle. Simple.
- **Casing:** "The Drop" (title case). Owner may set lowercase "the drop" if preferred — decide once.
- **Optional adornments (never required, used sparingly):**
  - a **refined custom snowflake** (also the favicon mark);
  - a **simple snowboard silhouette**.
  - Use as small accents beside/around the wordmark or in section dividers — **not** inside the core
    lockup unless the owner wants it.

---

## 3. Logo system

- **Primary lockup** — the 3D wordmark, horizontal.
- **Stacked** — wordmark with a small snowflake/snowboard accent above (optional, for square/social).
- **Favicon / app-icon** — the **snowflake mark** (the wordmark can't render at 16px).
- **Footer** — a **flat** (non-3D) single-color wordmark, small.
- **Clear space:** = cap-height of the wordmark on all sides. **Min size:** wordmark ≥ ~100px wide
  (3D needs room); snowflake favicon ≥ 16px.

---

## 4. Color variants (produce the wordmark in each)

| # | Variant | Use |
|---|---|---|
| 1 | **Ink 3D** wordmark (faces `#1F1A14`, darker-ink extrude) on **cream** | primary |
| 2 | **Cream/paper** wordmark on **ink** (reverse) | dark sections, photos |
| 3 | **Flat all-ink** (no 3D) | small sizes, footer, favicon contexts |
| 4 | **Flat all-cream** (reverse) | over photography |
| 5 | **Alpine-red accent** (optional red extruded edge) | if the owner wants more brand-forward later |

Snowflake favicon: ink on transparent (primary) + a cream-on-ink (maskable) variant.

---

## 5. Asset deliverables (exact — these drop into the Next.js app)

| Asset | File path | Size / format | Background | Notes |
|---|---|---|---|---|
| Favicon master | `app/icon.svg` | SVG, square, **snowflake** | transparent | legible at 16px, single weight |
| Legacy favicon | `app/favicon.ico` | 16/32/48 ICO (snowflake) | transparent | |
| Apple touch | `app/apple-icon.png` | 180×180 PNG (snowflake) | **opaque cream**, ~12% padding | no transparency (iOS) |
| Manifest icon | `app/icon-192.png` | 192×192 PNG (snowflake) | transparent | |
| Manifest icon | `app/icon-512.png` | 512×512 PNG (snowflake) | transparent | |
| Maskable | `app/icon-512-maskable.png` | 512×512 PNG (snowflake) | full-bleed cream | **20% safe padding** |
| Safari pinned tab | `app/safari-pinned-tab.svg` | 1-color SVG (snowflake) | — | monochrome single `<path>` |
| Header lockup | `public/brand/wordmark.svg` (in `SiteNav`) | SVG, ink+extrude tones | transparent | renders ~28px tall desktop / 24px mobile |
| Hero wordmark | `public/brand/wordmark-3d.svg` | **layered** SVG | transparent | see §6 — animatable groups |
| Footer mark | (inline in `SiteFooter`) | flat mono SVG | transparent | small, single color |
| OG image | dynamic (`next/og`, F-101) | 1200×630 | cream | wordmark + **localized** tagline; supply SVG + safe-zone |
| Social square (optional) | `public/brand/og-square.png` | 1080×1080 | cream | Instagram/share |

Manifest (`app/manifest.ts`, built in F-091): `theme_color` = cream `#FAF6F0`, accent = ink/alpine-red,
icons = the snowflake 192/512/maskable above.

---

## 6. Hero animation note (drives F-090)

The hero gesture is the **3D wordmark reveal**: on load the letters **settle / extrude in** (the depth
builds), one clean moment. Deliver the hero SVG (`wordmark-3d.svg`) with **named, separated groups** so
a dev can target the reveal:

- `#faces` — the letter faces
- `#extrude` — the depth/extrude layer (the part that "grows" in)
- (optional) per-letter groups `#l-T #l-h …` for a subtle stagger

It MUST look **finished and complete when static** (no animation) — required for
`prefers-reduced-motion`. **No Lottie** (`CLAUDE.md`); animate the SVG.

---

## 7. AI generation prompts (paste-ready)

AI tools output **raster** — after generating, **vectorize** (Illustrator Image Trace, vectorizer.ai)
and clean the paths; favicons/scaling need crisp SVG. Then build the §4 variants and §5 sizes.

**Prompt — the 3D wordmark (primary):**
> The words **"The Drop"** in bold geometric sans-serif capitals with a **subtle matte 3D extrude**
> (soft depth, no gloss, no chrome, no harsh bevel). Near-black ink `#1F1A14` faces on a warm cream
> `#FAF6F0` background. Premium, editorial — Monocle / Aesop, NOT gamer, NOT extreme-sports. Clean,
> simple, refined. Front-on or very slight angle. High-resolution, vector-traceable, no background
> clutter.

**Prompt — snowflake (favicon / accent):**
> A single **refined custom snowflake** mark — minimal, geometric, one solid weight, near-black ink on
> transparent. Legible at 16px, premium editorial. **Not** generic clipart, no gradient, no shadow,
> no extra detail.

**Prompt — snowboard (optional accent):**
> A **simple minimal snowboard silhouette**, single solid flat shape, ink, editorial. A small
> decorative accent — not the main logo, no detail, no gradient.

After generating: vectorize → simplify the snowflake until clean at 16px → build §4 variants →
export §5 files.

---

## 8. Do / Don't

**Do:** keep the 3D **subtle and matte**; keep it simple; custom snowflake (not clipart); test the
favicon at 16px; stay on the cream/ink palette; reserve the snowboard as a light accent.

**Don't:** **any water/snow-drop or teardrop glyph** (explicitly out), glossy/gamer 3D, harsh bevels
or chrome, gradients, generic snowflake clipart, emoji, a busy snowboard at favicon size, recolor
outside the palette.

---

## 9. Tagline (from F-105, ×3 locales — do not bake text into the image)

`next/og` injects the tagline per locale. Primary tagline (F-105): EN *"Learn with someone who lives
it."* (DE/ES adapted in `messages/{de,es}.json`). Descriptive SEO subline if needed: *"Private
snowboard lessons. Flumserberg & beyond."*

---

**Refs:** F-091 (integration), F-105 (brand/voice/tagline), F-090 (hero wordmark reveal),
F-101 (dynamic OG), D-LOGO (owner-produced asset blocker), `CLAUDE.md` §Design direction.
