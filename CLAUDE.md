# CLAUDE.md — Snowboard Booking Platform

> This file is read by Claude Code at the start of every session. It defines the project context, constraints, and conventions Claude must follow when generating or modifying code.

---

## Project

**Snowboard booking platform** for a single ski school in Switzerland. Single-developer MVP. Operated initially by one instructor (the owner), architected for multi-instructor expansion.

**Documentos del proyecto:**
- [`docs/PRD.md`](docs/PRD.md) — producto/negocio.
- [`docs/Architecture.md`](docs/Architecture.md) — stack, modelo de datos, integraciones, ADRs.
- [`docs/FEATURES.md`](docs/FEATURES.md) — backlog vivo (fuente de verdad del scope por ticket).
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — workflow con subagentes + reglas Playwright per-feature.

---

## Stack

**Strict — do not substitute any of these:**

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) |
| Language | TypeScript strict mode |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Forms | React Hook Form + Zod |
| i18n | next-intl (public routes only) |
| Auth | **Better Auth** (NOT NextAuth/Auth.js) |
| ORM | **Prisma** (NOT Drizzle) |
| DB | Neon Postgres |
| Payments | Stripe Payment Element |
| Email | Resend + React Email |
| Calendar | `ics` package + Google Calendar API |
| Storage | Vercel Blob |
| Monitoring | Sentry |
| Hosting | Vercel |
| Testing | Playwright (E2E) + Vitest (unit) |

---

## Skills active in this project

- **impeccable** — primary design driver, both "brand" mode (landing) and "product" mode (booking/dashboard)
- **playwright-skill** — E2E testing + visual review loop

**Skills installed globally but NOT active here unless I explicitly invoke them:**
- huashu-design — not compatible with Next.js architecture
- taste — invoke with `"use taste for X"`
- ui-ux-pro-max — invoke with `"check ui-ux-pro-max for Y"`

---

## Design direction

**Editorial / premium aesthetic.** References: Aesop, Cereal magazine, Outdoor Voices, Monocle.

**Required:**
- Serif typography for display (NOT Inter, NOT DM Sans, NOT Geist)
- Generous whitespace
- High contrast, low color saturation
- Photography-led (not illustration-led)
- Subtle, intentional animations only

**Forbidden:**
- Purple/blue gradients
- Generic 3-column card grids with icons on top
- Hero + CTA + subtitle + 3 stacked features pattern
- Emoji as decoration
- Glassmorphism, neumorphism
- Drop shadows on cards (use borders instead)
- Lottie animations of generic shapes

When in doubt: check what **Impeccable** would do. The skill is the source of truth for visual decisions.

---

## Routing conventions

```
app/
├── [locale]/                # i18n: en, de, es
│   ├── (marketing)/         # Landing, instructores, blog
│   ├── (booking)/           # Reservation flow
│   ├── (auth)/              # Login, register, verify
│   ├── dashboard/           # Authenticated student
│   └── layout.tsx
├── instructor/              # EN only, outside [locale]
├── admin/                   # EN only, outside [locale]
├── api/
└── sitemap.ts, robots.ts
```

- **Public + student dashboard:** trilingual (`/`, `/de/`, `/es/`)
- **Instructor + admin panels:** English only
- **Slug translations:** path segments translated per locale (e.g. `/de/instruktoren/`, `/es/instructores/`)
- **EN locale: no prefix** in URLs (better SEO for English market)

---

## Naming conventions

- **Files:** kebab-case (`booking-engine.ts`, `availability-calendar.tsx`)
- **React components:** PascalCase (`BookingCalendar.tsx` exports `BookingCalendar`)
- **Hooks:** camelCase with `use` prefix
- **Server Actions:** verbNoun (`createBooking`, `cancelBookingByUser`)
- **API routes:** REST-ish (`/api/availability/calendar`, `/api/webhooks/stripe`)
- **DB tables:** singular camelCase in Prisma schema (`user`, `instructor`, `accountCredit`)
- **Enums:** SCREAMING_SNAKE_CASE values (`CANCELLED_BY_USER`)
- **Constants:** SCREAMING_SNAKE_CASE
- **Money:** always store as `priceInCents: Int`, never as float

---

## Data and money

- All monetary fields end in `Cents` (`totalPriceCents`, `amountCents`)
- All currency operations on the server, never in the client
- Currency: only CHF in MVP
- Format display via `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' })`
- Dates: store as UTC, display in `Europe/Zurich` timezone
- `Date` objects for date-only fields use `@db.Date` in Prisma

---

## Auth and authorization

- **Better Auth** is the only auth library. Do not import `next-auth`.
- Session shape: `{ user: { id, email, name, image, locale, roles: Role[] } }`
- Role check: `session.user.roles.includes('admin')`
- Protected routes via middleware OR via `auth()` in Server Components
- Never trust client-sent role; always re-check on the server

---

## Component conventions

- **Server Components by default.** Add `'use client'` only when needed (state, effects, events).
- **shadcn/ui as base**, but modify aggressively to match editorial design (no default rounded cards with shadows)
- **No barrel files** (`index.ts` re-exports) — explicit imports
- **Zod schemas** live next to their use, exported from `lib/schemas/` when shared
- **Server Actions** in `app/(group)/actions.ts` files, never inline in Client Components

---

## Forms

- React Hook Form for client state
- Zod for validation (client + server)
- Server Actions consume the same Zod schema for validation
- Error messages translated via next-intl
- Loading states obligatory (no silent submits)

---

## Database operations

- **All mutations of multiple tables use Prisma transactions** (e.g. booking cancellation, credit redemption, payment confirmation)
- **No raw SQL** unless explicitly justified and commented
- **Migrations:** `prisma migrate dev` for development, `prisma migrate deploy` for production
- **Seed data** in `prisma/seed.ts` with 1 instructor (the owner) and 1 active season

---

## API and webhooks

- **Stripe webhooks** must verify signature using `STRIPE_WEBHOOK_SECRET`
- **All webhooks idempotent** via deduplication on `event.id`
- **Server Actions for mutations** when called from the same app
- **Route Handlers** for external integrations (webhooks, OAuth callbacks, cron)
- **Cron secrets:** verify `CRON_SECRET` env var before executing scheduled jobs

---

## Testing

- **E2E tests with Playwright** for: happy-path booking, cancellation, credit redemption, auth flows
- **Unit tests with Vitest** for: `lib/booking-engine/` (availability algorithm), Zod schemas, currency utils
- **Visual review:** Playwright opens the running app, takes screenshots, Claude evaluates against design rules
- **Coverage target:** booking engine 90%+, rest reasonable

---

## Performance budget

- LCP < 2.5s on home (mobile)
- CLS < 0.1 globally
- API availability search < 500ms p95
- Bundle JS < 200KB gzipped on home
- Images via `next/image` with AVIF + WebP

---

## Security checklist (always apply)

- [ ] CSRF protection on mutations (Better Auth handles for auth, Server Actions handle for app mutations)
- [ ] Zod validation on all server inputs
- [ ] Rate limiting on auth + availability endpoints
- [ ] Secrets in env vars (never in repo, never logged)
- [ ] Encrypt sensitive data at rest (Google refresh tokens via AES-256-GCM)
- [ ] HTTPS only, HSTS header
- [ ] CSP header with strict policy
- [ ] No `dangerouslySetInnerHTML` unless sanitized

---

## When Claude proposes code

**Always:**
- Check this CLAUDE.md first for conventions
- Use TypeScript strict mode (no `any` without justification)
- Prefer Server Components and Server Actions
- Use Prisma transactions for multi-table mutations
- Reference `docs/PRD.md` (qué hace) y `docs/Architecture.md` (cómo está construido) when in doubt about requirements
- Toda nueva feature debe tener su ticket en `docs/FEATURES.md` antes de delegar a un subagente

**Never:**
- Substitute the stack (no Drizzle, no Auth.js, no SendGrid, no other ORM)
- Use `localStorage` for sensitive data (use server session)
- Hardcode strings that should be translated (use next-intl `useTranslations`)
- Generate UI without consulting Impeccable conventions
- Skip the design rules in this file because "it would be faster"

---

## Outstanding decisions (to be revisited)

These were flagged in the PRD as needing review:

1. Legal validation of credit-only model for operational cancellations
2. Final pricing per duration
3. Google Business Profile Place ID for review CTA
4. Brand identity assets (logo, hero photography)
5. Tipping split policy (instructor 100% or split with school)

---

**Last updated:** 2026-05-14
