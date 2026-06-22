---
name: booking-platform-perf
description: >-
  Client-first performance and responsiveness auditor for this snowboard booking
  platform (Next.js 15 App Router, RSC, next-intl, TanStack Query v5, Neon
  Postgres). Enforces two things at once: (1) the hard Web Vitals budgets — LCP <
  2.5s mobile home, CLS < 0.1 globally, availability search p95 < 500ms, home
  First Load JS < 200KB gz — and (2) the responsiveness contract for the booking
  funnel: a single-page stepper (no page-to-page navigation), TanStack Query
  client cache with prefetch, and server-side unstable_cache with tag
  invalidation. Use when writing, reviewing, or refactoring any home/marketing
  surface or the reservar booking funnel, when adding client components, motion,
  images, fonts, data fetching, or queries, when a bundle/Lighthouse number
  moves, or before merging a UI ticket to main. Triggers on "perf budget", "web
  vitals", "LCP", "CLS", "bundle size", "First Load JS", "availability latency",
  "tanstack/react-query", "prefetch", "cache", "stepper", "is this within
  budget".
---

# booking-platform-perf — client-first performance auditor

Project-specific auditor. Two mandates: the **Web Vitals budgets** (hard gates)
and the **booking-funnel responsiveness contract**. The funnel must feel instant
— no full-page reloads between steps, data served from cache, next step's data
prefetched before the user asks. Reconstructed after a machine reformat; keep in
sync with `CLAUDE.md` §Performance budget and the `reservar` code it cites.

## Budgets (fail the review if any is exceeded)

| Budget | Limit | Scope |
|---|---|---|
| LCP | < 2.5s | home, mobile (throttled) |
| CLS | < 0.1 | globally, every public route |
| Availability search | < 500ms p95 | `/api/availability/*` |
| First Load JS | < 200KB gzipped | home (`/[locale]`) |
| Images | AVIF + WebP via `next/image` | everywhere |

## North star: client-first responsiveness

The booking funnel is the conversion surface — latency there costs bookings.
Prefer **client responsiveness** over round-trips. The patterns below already
exist in the code; this skill's job is to **enforce and extend** them, not
reinvent them. When you touch the funnel, default to: serve from cache, prefetch
ahead, mutate optimistically, never navigate when you can transition in place.

## The booking-funnel architecture — enforce these

**1. Single-page stepper, not page-to-page navigation.**
`app/[locale]/reservar/booking-stepper.tsx` renders all 5 steps as `section-1..5`
on **one page**; the stepper is a sticky nav that `scrollIntoView`s between
sections. Step state lives in the URL via
`app/[locale]/reservar/use-booking-url-state.ts` (query params like `?dt=`), so
back/forward and deep-links work **without** unmounting the funnel or refetching.
- ❌ Do not split steps into separate routes/pages. That throws away the query
  cache, re-runs RSC, and adds a navigation per step (the exact friction we removed).
- ✅ New step UI = a new in-page section + URL state. Selecting a value calls
  `set({...})` and scrolls; it never `router.push`es to a new page.

**2. TanStack Query is the funnel's data layer.**
`app/[locale]/reservar/query-provider.tsx` configures the client cache:
`staleTime: 5min`, `gcTime: 30min`, `refetchOnWindowFocus: false`, `retry: 1`.
- Query keys are structured: `["availability","calendar",duration,month]`,
  `["availability","slots",duration,date]` (see `month-calendar.tsx`). Keep this
  shape — it's what makes cache hits and invalidation predictable.
- Scrolling back to a completed step must hit the cache (no spinner). If you add
  a refetch-on-mount or drop `staleTime`, you reintroduce flicker — don't.
- Keep `refetchOnWindowFocus: false`; availability is server-cached and a focus
  refetch would hammer the API for no UX gain.

**3. Prefetch the next interaction.**
`month-calendar.tsx` prefetches a day's slots on `onMouseEnter`/`onFocus`
(`handlePrefetchSlots` → `queryClient.prefetchQuery(..., { staleTime: 30_000 })`)
so the slot list is warm before the click. Extend this pattern: prefetch the
likely-next step's data on hover/focus of the control that leads there.

**4. Server cache with tag invalidation.**
The API routes (`app/api/availability/{calendar,slots,nearby}/route.ts`) are thin
Zod-validated handlers that call `lib/booking-engine/cache.ts`. That module wraps
the engine in `unstable_cache` with `revalidate: 30min` **and** tags
(`availability`, `availability:duration:*`, `availability:month:*`,
`availability:date:*`). Mutations (`createBookingDraft`, `voidActiveDraft`, Stripe
webhooks) call `revalidateTag("availability")` so reads stay correct across writes.
- ✅ Any new availability-affecting mutation MUST `revalidateTag` the right tag,
  or the client will serve stale slots.
- ✅ New read endpoints go through an `unstable_cache` wrapper with tags — never
  query Prisma directly from a route handler in the hot path.
- The 30-min `revalidate` is only the idle floor; correctness comes from tags.

**Two-layer cache model to keep straight:** TanStack Query = per-user, in-browser,
instant re-render. `unstable_cache` = shared, server-side, cross-user. A request
hits the browser cache first (0ms), then the server cache (no DB), then the engine
(DB) only on a cold tag. Keep both layers; they solve different problems.

## How to measure each budget

**First Load JS (home < 200KB gz).** Cheapest gate; run it first.
```bash
pnpm build            # reads the /[locale] (home) First Load JS row (already gzipped)
ANALYZE=true pnpm build   # only if a route blows the budget (needs @next/bundle-analyzer)
```
Home (`/[locale]`) is the budgeted route. `/reservar` and `/login` are out of the
home budget by design (TanStack Query + RHF + Stripe live there) but watch them —
the funnel ships client JS, so keep query/UI code lean and lazy.

**LCP (home, mobile < 2.5s).** LCP node must be SSR (hero copy/image in an RSC),
never gated behind client JS or motion.
```bash
pnpm build && pnpm start &
npx lighthouse http://localhost:3000 --form-factor=mobile --throttling-method=simulate --only-categories=performance --quiet
```
Or drive it with `playwright-skill` / `webapp-testing` and read `web-vitals`
(`onLCP`, `onCLS`).

**CLS (< 0.1 everywhere).** Size every image (`width`/`height` or `fill` + sized
parent); `next/font` with `display:'swap'` + matched fallback; reserve height for
banners/nav; animate transform/opacity only — never in-flow height/margin.

**Availability p95 < 500ms.** Measure the real endpoint warm.
```bash
for i in $(seq 1 50); do \
  curl -s -o /dev/null -w "%{time_total}\n" \
  "http://localhost:3000/api/availability/calendar?duration=PRIVATE_90&monthFrom=2026-07-01&monthTo=2026-07-31"; \
done | sort -n | awk '{a[NR]=$1} END{print "p95="a[int(NR*0.95)]"s"}'
```
First call is a cold `unstable_cache` miss (hits the engine + Neon); the rest
should be cache hits. If warm p95 > 0.5s: N+1 or unindexed query in
`lib/booking-engine/`, cold pooled Neon connection (use `DATABASE_URL`, not
`DIRECT_URL`, at runtime), or a missing/!overbroad cache tag forcing recompute.

## Diagnosis playbook (most common regressions on this stack)

- **Funnel feels laggy / spinners between steps** → a step was turned into its own
  route, or a query lost its `staleTime`, or `refetchOnWindowFocus` got turned on.
  Restore the single-page + cache-hit contract above.
- **Slot list flashes a loader on click** → the hover/focus prefetch
  (`handlePrefetchSlots`) was dropped or the query key drifted from the prefetch
  key. They must match exactly.
- **Stale availability after a booking** → a mutation didn't `revalidateTag`
  ("availability" or the specific date/month tag). Add it inside the same action/
  transaction path.
- **Home JS over budget** → a `'use client'` boundary pulled a heavy dep into the
  home chunk; `motion` must come from `motion/react` and be lazy. The funnel's
  TanStack/Stripe code must never be imported by a marketing/home component.
- **LCP regression** → hero now depends on client JS, an unoptimized/late image,
  or a render-blocking font. Make it SSR, give the hero image `priority`, serve
  AVIF/WebP, `setRequestLocale(locale)` at the top of the page so the segment
  stays static.
- **Availability slow** → see the p95 section.

## Output format (what this skill should produce)

Report a verdict per budget AND a funnel-responsiveness check, with **measured
numbers**, not guesses:

```
PERF AUDIT — <surface/ticket>
- First Load JS (home):     188KB / 200KB   PASS
- LCP (mobile, home):       2.1s / 2.5s     PASS
- CLS (<route>):            0.04 / 0.10     PASS
- Availability p95 (warm):  410ms / 500ms   PASS
Funnel contract:
- Single-page stepper preserved:        YES
- Cache hit on step revisit (no spinner): YES
- Next-step prefetch on hover/focus:    YES
- Mutations revalidateTag availability: YES
Punch list:  P1 …  P2 …  P3 …
```
Any FAIL blocks merge. `CLAUDE.md` §Performance budget is the source of truth for
the numbers; the `reservar` code is the source of truth for the patterns. If
either changes, update this skill.
