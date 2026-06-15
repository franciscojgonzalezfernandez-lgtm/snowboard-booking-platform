# The Drop — Design Tokens (cream / editorial)

> Canonical color + type tokens. Documents the existing **Patagonia-editorial** theme implemented in
> `app/globals.css` (F-029 / F-030). Values are `oklch` (source of truth) with `~hex` for reference.
>
> **Note (2026-06-15):** the dark-alpine retheme was **discarded** by the owner — the planned look is
> the existing cream/editorial palette below. `app/globals.css` is the source of truth.

## Surfaces & ink

| Token | role | oklch | ~hex |
|---|---|---|---|
| `--background` | cream base | `0.96 0.013 75` | `#FAF6F0` |
| `--card` / `--popover` | cream surface | `0.96 0.013 75` | `#FAF6F0` |
| `--foreground` | ink | `0.18 0.012 60` | `#1F1A14` |
| `--muted-foreground` | muted ink | `0.46 0.013 70` | `#6B6258` |
| `--secondary` / `--muted` / `--accent` | warm cream-alt (section bg / hover) | `0.92 0.025 85` | `#F1EAD9` |
| `--border` / `--input` | hairline | `0.82 0.025 80` | `#D4C9B3` |

## Accent — signature

| Token | role | oklch | ~hex |
|---|---|---|---|
| `--primary` / `--ring` | alpine red (CTAs, focus, links) | `0.54 0.18 35` | `#C7361C` |
| `--destructive` | accent-deep red (errors / hover) | `0.42 0.16 33` | `#952B18` |

## Contrast targets

- Ink on cream — body text — ≥ 4.5:1 (WCAG AA)
- Snow text on alpine-red buttons — ≥ 4.5:1
- Muted ink on cream — secondary text — ≥ 4.5:1
- Focus ring (alpine red) visible on cream **and** not reliant on color alone

## Type

> Existing setup (F-029 Patagonia-editorial). This deviates from the "serif display" guideline in
> `CLAUDE.md` §Design direction — a pre-existing deviation, flagged there.

- **Display / headings:** **Archivo Black**, uppercase, tight tracking (`--font-archivo-black`).
- **Body / UI:** **Archivo** (`--font-archivo`).
