---
name: sprint-5-class-differentiators
description: Per-duration lesson differentiators + pricing/age facts for the Sprint 5 pricing page (F-093)
metadata: 
  node_type: memory
  type: project
  originSessionId: c2d31da0-b710-45dc-a7b3-4b1898147e2f
---

Owner-confirmed class spec for the Sprint 5 pricing page (F-093). Durations map: `ONE_HOUR 1h · TWO_HOURS 2h · INTENSIVE 4h · FULL_DAY 6h`. Prices live in DB (`Season.priceCentsByDuration`, F-080 editor) — page reads them, never hardcodes.

Per-tier signature ladder (video correction is the spine):
- **1h** — no perk. Sell: fix one concrete flaw, or beat fear / get back riding after a break. Meeting point: **COLORS restaurant door** (Flumserberg).
- **2h** — first day on snow / basics / beginner slopes, OR technique tune-up. Video correction **take-home only, and only for non-beginners**. Meeting point: COLORS (assumed default).
- **4h INTENSIVE** — freestyle or carving focus, time for support drills. Video correction **live + sent home**. **Choose meeting point** (can go to harder slopes).
- **6h FULL_DAY** — everything in 4h **plus choose the resort** among nearby northern-Switzerland stations (arranged with admin). 30–45min break.

Global facts:
- **No tier includes equipment.** Answer to "no gear": rent at resort, instructor points to the Flumserberg rental shop.
- **Lift pass / forfait NOT included** — each rider buys their own day pass; instructor points to ticket office. (Critical pricing-page line.)
- **Flat group price 1–4 people** (`CHF X · up to 4`), not per-person.
- **Min age 8** (adults + kids; family line ok).
- Cards show available languages **EN · DE · ES** (from instructor profile).
- Class naming = **hybrid**: duration heading (SEO) + branded kicker. EN kickers: The Fix (1h) / First Tracks (2h) / The Session (4h) / The Full Drop (6h); DE/ES in `messages/*` namespace `pricing.tier.*.kicker`.

Polish defaults (owner can veto): video delivered via **WhatsApp link after class**; 6h SEO resort examples = Laax/Pizol/Davos/Arosa/Elm "& nearby".

Related: [[sprint-5-brand-direction]].
