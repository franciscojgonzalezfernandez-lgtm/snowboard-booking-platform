---
name: sprint-5-brand-direction
description: "Locked design/brand decisions for Sprint 5 (dark-alpine retheme, glacier blue, motion, \"The Drop\")"
metadata: 
  node_type: memory
  type: project
  originSessionId: c2d31da0-b710-45dc-a7b3-4b1898147e2f
---

Sprint 5 (landing + SEO, critical for conversion) design decisions locked with owner (2026-06-14). Foundation tickets **F-089–F-091 + F-105** (brand renumbered from F-088 — that ID is shipped season-management, PR #133) written to `docs/FEATURES.md`; wave 2 = F-092–F-104 (home recompose, pricing, instructors, about, contact, FAQ, blog, sitemap/robots, structured data, OG, slugs, metadata, a11y audit).

Locked direction:
- **Palette: dark-alpine** (charcoal bg `oklch(0.16 0.01 60)` / snow fg `oklch(0.97 0.01 75)`) — replaces the warm-pastel cream theme. Current `--accent` was pale cream-alt `#F1EAD9` (not a real accent) — retired.
- **Signature accent: glacier blue `#1E7FBF`** (`oklch(0.55 0.15 235)`), used **SOLID** (blue gradients still forbidden per CLAUDE). Becomes `--primary`/`--ring`.
- **Alpine red `#C7361C` → `--destructive` only** (errors/cancellation).
- **Motion: `motion` lib, choreographed** (scroll reveal, parallax, animated drop-fall, view transitions), always gated behind `prefers-reduced-motion`. F-090 updates the CLAUDE.md "subtle only" rule to remove the contradiction.
- **Refactor scope: retoken globally + recompose key surfaces** (home, pricing, nav/hero, footer); rest inherits tokens. NB dark flip hits dashboard/booking/admin too via tokens — needs a visual QA pass even though they aren't recomposed.
- **Brand "The Drop"**: double meaning (snow/water drop + "drop in"). PRD §Brand authored via `to-prd` skill (installed) but written to `docs/PRD.md`, not an external tracker. Voice via `impeccable` + `cro`. Logo spec doc: `docs/brand/logo-assets.md`.
- Scope adds: lean contact page (no form; F-054 form stays post-MVP); blog **3 posts trilingual at launch**.

Pre-existing repo bug to flag: **F-087 ticket ID is duplicated on main** — `##### F-087 Season management` (Sprint 4) and `### F-087 Admin student directory` (backlog). Numbering collision, cleanup later.

Class content: [[sprint-5-class-differentiators]].
