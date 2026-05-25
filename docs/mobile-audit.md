# F-051 — Mobile UI Audit (post-fix)

Captured **2026-05-25** against `f-051-mobile-audit-sheet` worktree, dev server on `localhost:3051`. Screenshot pass: `/tmp/f-051/screenshots/`. Automated overflow detection lives in `e2e/f-051-mobile.spec.ts` (33/33 green).

## Viewports tested

| Device | Width × Height | Notes |
|---|---|---|
| iPhone SE 1 (2016) | 320 × 568 | Tightest target. WCAG 2.5.5 AAA tap-targets require careful padding. |
| iPhone SE 2 (2020) | 375 × 667 | Modern small-phone baseline. |
| iPhone 14 | 390 × 844 | Mainstream iOS. |
| iPhone XR | 414 × 896 | Wide phone. |
| iPad mini | 768 × 1024 | Tailwind `md` breakpoint. Forces re-evaluation of `md:` desktop layouts. |

## Routes tested

`/`, `/en/login`, `/en/reservar` (SPA shell from F-049), `/en/dashboard`, `/en/terms`, `/en/privacy`, plus all locale variants of `/`.

## Issues found + fixed

### 1. SiteNav overflow at <1024px

- **Repro:** all viewports below 1024px. At 768px (iPad mini) the desktop layout was active (Tailwind `md`), and locale-specific labels ("INICIAR SESIÓN") got clipped by the trailing CTA pill.
- **Root cause:** `md:flex` for nav + `md:` for the LangSwitcher + Sign-in row. The desktop nav needs more than 768px to breathe.
- **Fix:** new `app/components/MobileNav.tsx` client island wraps a shadcn `Sheet` (side=right) with logo, vertical nav stack, LanguageSwitcher, and a session-aware Sign-in / My-account CTA. SiteNav switches its desktop layout breakpoint from `md` → `lg` (1024px). The hamburger trigger is shown via `lg:hidden`.
- **i18n:** new keys `nav.open_menu`, `nav.reservar`, `nav.dashboard_cta` added to `messages/{en,de,es}.json`.

### 2. Home hero H1 clipped in German at ≤414px

- **Repro:** `/de` at 320 / 375 / 390 / 414 — the word "SNOWBOARDEN" overflowed horizontally because `text-[clamp(48px,9.5vw,132px)]` floored at 48px while the container was only ~264px wide.
- **Root cause:** `clamp()` minimum (48px) was tuned for the EN copy ("RIDE"), not the longest DE word.
- **Fix:** lower clamp min to `34px` and add `hyphens-auto break-words` so long words wrap mid-token if needed. Desktop range (`9.5vw` → 132px max) unchanged.

### 3. BookingHeader (`/reservar`) trailing "Exit" link clipped at 320px

- **Repro:** `/en/reservar` at 320×568 — "EXIT" rendered off-screen.
- **Root cause:** flex children without `min-w-0` + brand link wider than its share at the tight padding.
- **Fix:** brand wordmark gets `min-w-0 truncate` + smaller mobile size (`text-[15px]`); trailing controls get `shrink-0`; container padding shrinks to `px-4` and gap to `gap-2` below `sm`.

### 4. LanguageSwitcher tap targets below WCAG 2.5.8 AA at 320px

- **Repro:** 11px lang buttons with no padding measured ~15px tall.
- **Fix:** each lang `<button>` now `inline-flex min-h-11 min-w-6 items-center px-1`. Height meets WCAG 2.5.5 AAA (44px); width is sized to the 2-char label with spacing exception applying.

## Tap-target coverage

| Element | Size after fix | WCAG level | File |
|---|---|---|---|
| Hamburger trigger | 44×44 | 2.5.5 AAA | `app/components/MobileNav.tsx` |
| Sheet nav links | min-h-11 (44px) | 2.5.5 AAA | `app/components/MobileNav.tsx` |
| Sheet CTA (Sign in / My account) | min-h-11 (44px) | 2.5.5 AAA | `app/components/MobileNav.tsx` |
| LanguageSwitcher buttons | 44 (h) × ≥24 (w) | 2.5.8 AA + spacing exception | `app/components/LanguageSwitcher.tsx` |
| Booking-flow anchor pills | min-h-11 | 2.5.5 AAA | `app/[locale]/reservar/time-instructor.tsx` (pre-F-051) |
| Calendar day cells | ~37×37 @ 320, ≥44×44 @ ≥375 | 2.5.8 AA + spacing exception (gap-1) | `app/[locale]/reservar/month-calendar.tsx` (pre-F-051) |
| Stepper mobile trigger | min-h-11 | 2.5.5 AAA | `app/[locale]/reservar/booking-stepper.tsx` (F-050) |

## Out of scope for F-051

- **Lighthouse mobile reports** (`docs/lighthouse-mobile-post-f051.html`) — not captured in this iteration. F-051 AC originally asked for Moto G4 throttle ≥90 perf + ≥95 a11y on `/`, `/login`, `/reservar`. Deferred to a follow-up so the visual regression fixes and Sheet can ship without coupling to a manual Lighthouse run; the spec covers the regressions that motivated the ticket.
- **Calendar day cells at 320×568 (iPhone SE 1st gen 2016)** — would require dropping grid padding to zero or stacking 2×7 days, both of which would regress the editorial layout at common viewports. Spacing exception holds.
- **Stripe Payment Element wallets** — Stripe-controlled UI, no tap-target levers available from our side.
