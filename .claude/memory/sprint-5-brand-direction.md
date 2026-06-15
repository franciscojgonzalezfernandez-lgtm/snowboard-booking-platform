---
name: sprint-5-brand-direction
description: "Brand decisions for Sprint 5 (cream/editorial KEPT, dark-alpine discarded, voice «Your coach», \"The Drop\")"
metadata: 
  node_type: memory
  type: project
  originSessionId: c2d31da0-b710-45dc-a7b3-4b1898147e2f
---

Sprint 5 (landing + SEO, critical for conversion). Foundation tickets **F-090–F-091 + F-105** (brand renumbered from F-088 — that ID is shipped season-management, PR #133) written to `docs/FEATURES.md`; wave 2 = F-092–F-104. **F-089 (dark-alpine retheme) was discarded — see below.**

Direction:
- **Palette: KEPT cream/editorial** (Patagonia-editorial). The **dark-alpine retheme (F-089) was discarded by the owner (2026-06-15)** — "no me ha gustó nada el resultado." `app/globals.css` stays cream: bg `#FAF6F0`, ink `#1F1A14`, **alpine red `#C7361C` as the signature** (`--primary`/`--ring`). Glacier blue is OUT.
- **Motion: `motion` lib, choreographed** (scroll reveal, parallax, **hero wordmark reveal**, view transitions), always gated behind `prefers-reduced-motion`. F-090 updates the CLAUDE.md "subtle only" rule.
- **Refactor scope: recompose key surfaces** (home, pricing, nav/hero, footer) on the existing cream theme; **no global retoken** (dark-alpine discarded).
- **Brand "The Drop"**: from *drop in* (snowboard term) — **NO drop glyph** (owner 2026-06-15). Logo = **3D "The Drop" wordmark** (ink, subtle matte extrude); **favicon = snowflake**; snowboard = optional accent; hero animation = wordmark reveal. The old `f-091-logo-assets` branch (teardrop in glacier blue) was scrapped. Voice «Your coach» via `impeccable`+`cro`. Spec: `docs/brand/logo-assets.md`.
- Scope adds: lean contact page (no form; F-054 form stays post-MVP); blog **3 posts trilingual at launch**.

Pre-existing repo bug to flag: **F-087 ticket ID is duplicated on main** — `##### F-087 Season management` (Sprint 4) and `### F-087 Admin student directory` (backlog). Numbering collision, cleanup later.

Class content: [[sprint-5-class-differentiators]].
