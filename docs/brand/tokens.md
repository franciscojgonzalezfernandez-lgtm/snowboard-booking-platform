# The Drop — Design Tokens (dark-alpine)

> Canonical color + type tokens. **Implemented in `app/globals.css` by F-089.** Values are `oklch`
> (source of truth) with `~hex` for reference. Targets WCAG 2.1 AA — exact ratios must be verified
> in F-089 with an axe/contrast tool before close.

## Surfaces & ink

| Token | role | oklch | ~hex |
|---|---|---|---|
| `--background` | charcoal base | `0.16 0.01 60` | `#201E1B` |
| `--card` / `--popover` | charcoal-alt surface | `0.20 0.01 60` | `#2A2724` |
| `--foreground` | snow ink | `0.97 0.01 75` | `#FAF7F1` |
| `--muted-foreground` | muted ink | `0.72 0.01 75` | `#B4AEA6` |
| `--border` | hairline | `0.30 0.01 60` | `#3A3631` |

## Accent — signature

| Token | role | oklch | ~hex |
|---|---|---|---|
| `--primary` / `--ring` | glacier blue (CTAs, focus, links) | `0.55 0.15 235` | `#1E7FBF` |
| `--accent` | glacier-tinted surface (hover/highlight) | `0.26 0.04 235` | — |

**Glacier blue is always SOLID — never a gradient** (CLAUDE rule). For small body links on charcoal,
lighten toward `oklch(0.66 0.13 235)` if the ratio falls under 4.5:1.

## Destructive

| Token | role | oklch | ~hex |
|---|---|---|---|
| `--destructive` | alpine red — **errors / cancellation only** | `0.55 0.20 28` | `#C7361C` |

## Contrast targets (verify in F-089)

- Snow on charcoal — body text — must be ≥ 4.5:1 (expected ~14:1 ✓)
- Glacier blue used for **UI / large text / links**; snow-on-blue button text must be ≥ 4.5:1
- Muted ink on charcoal — secondary text — must stay ≥ 4.5:1 (tune lightness if not)
- Focus ring (glacier blue) must be visible on charcoal **and** not rely on color alone

## Type

> **Owner decision (2026-06-15):** keep the established **Archivo Black** display + **Archivo** body —
> no serif swap in F-089 (colors-only retheme). This **deviates** from the "serif display" guideline
> in `CLAUDE.md` §Design direction; flagged there for reconciliation.

- **Display / headings:** **Archivo Black**, uppercase, tight tracking (`--font-archivo-black`,
  wired in `app/layout.tsx`).
- **Body / UI:** **Archivo** (`--font-archivo`).
