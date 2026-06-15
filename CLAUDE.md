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

**Design + testing (kept from before):**
- **impeccable** — primary design driver, both "brand" mode (landing) and "product" mode (booking/dashboard)
- **playwright-skill** — E2E testing + visual review loop (browser automation)

**Engineering experts (Next.js 15 + Prisma + i18n):**
- **vercel-react-best-practices** — React/Next.js perf base from Vercel Engineering (402K installs)
- **nextjs-app-router-patterns** — App Router, RSC, streaming, Server Actions
- **typescript-advanced-types** — strict-mode TS, generics, conditional/mapped types
- **prisma-database-setup** — Prisma schema + provider setup (official Prisma)
- **prisma-client-api** — query patterns, `$transaction`, filters (official Prisma)
- **prisma-postgres** — Neon-compatible Postgres provisioning + operations
- **next-intl-add-language** — add/maintain locale `en | de | es` and slug translations

**UI / components:**
- **vercel:shadcn** — shadcn/ui CLI, component installation, composition patterns, theming, custom registries. Default reference for any UI primitive work. Invoke before hand-rolling `<input>`/`<button>`/`<select>`/`<dialog>`/etc.

**QA + performance:**
- **testing-strategy** — Anthropic-official test strategy & coverage design
- **playwright-testing** — extra Playwright tactics (augments `playwright-skill`)
- **booking-platform-perf** — Web Vitals auditor enforcing this project's budgets (LCP < 2.5s, CLS < 0.1, availability p95 < 500ms, home bundle < 200KB)

**Skills installed globally but NOT active here unless I explicitly invoke them:**
- huashu-design — not compatible with Next.js architecture
- taste — invoke with `"use taste for X"`
- ui-ux-pro-max — invoke with `"check ui-ux-pro-max for Y"`
- design-taste-frontend, high-end-visual-design, imagegen-frontend-web, imagegen-frontend-mobile — design-asset skills, invoke explicitly when needed

**Out of scope for now (can install later if needed):**
- Better Auth specialist skill
- Stripe payments / webhooks specialist skill
- Accessibility / WCAG auditor
- System architect / ADR writer

---

## Design direction

**Editorial / premium aesthetic.** References: Aesop, Cereal magazine, Outdoor Voices, Monocle.

**Required:**
- Serif typography for display (NOT Inter, NOT DM Sans, NOT Geist)
- Generous whitespace
- High contrast, low color saturation
- Photography-led (not illustration-led)
- Choreographed motion via `motion` (the `lib/motion/` primitives), always gated behind `prefers-reduced-motion`; no gratuitous spin/bounce/glow. Principles in `docs/brand/motion.md`.

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
│   ├── (marketing)/         # Landing, terms, privacy — shared chrome layout (SiteNav with utility bar)
│   ├── (auth)/              # Login, register, verify — shared chrome layout (SiteNav, no utility bar)
│   ├── dashboard/           # Authenticated student — own layout with SiteNav + Sign out
│   ├── reservar/            # Booking funnel — own BookingHeader (NOT inside any route group, deliberate per F-068)
│   └── layout.tsx           # Root locale layout: NextIntlClientProvider + SiteFooter
├── instructor/              # EN only, outside [locale]
├── admin/                   # EN only, outside [locale]
├── api/
└── sitemap.ts, robots.ts
```

- **Public + student dashboard:** trilingual (`/`, `/de/`, `/es/`)
- **Instructor + admin panels:** English only
- **Slug translations:** path segments translated per locale (e.g. `/de/instruktoren/`, `/es/instructores/`)
- **EN locale: no prefix** in URLs (better SEO for English market)
- **`reservar/` stays outside `(booking)` group on purpose** (F-068). `BookingHeader` already implements the funnel-only chrome contract; renaming would add churn without payoff. Pages inside `reservar/` must not mount `SiteNav`.

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

## Git workflow (full spec in `docs/WORKFLOW.md` §Ritual de git)

**Worktrees por defecto.** Cada ticket vive en su propio worktree hermano del repo (`../booking-platform.f-XXX`), cortado desde `origin/main`. No hacer `checkout` que cambie la branch del repo principal salvo edits triviales a meta-docs.

**Usa el helper** `scripts/new-worktree.sh` — crea el worktree desde `origin/main` **y** copia los env gitignored (`.env`, `.env.local`) desde el worktree primario. Sin esto el worktree nace sin `DATABASE_URL`/`DIRECT_URL` (apuntan a la branch Neon `dev` en `.env.local`) y dev local + Playwright fallan, o peor: caen al `.env` que apunta a Neon `main` (prod).

```
scripts/new-worktree.sh f-XXX-kebab-slug
# equivale a: git fetch origin + git worktree add -b f-XXX-kebab-slug ../booking-platform.f-XXX origin/main + cp .env .env.local
```

Si se crea un worktree a mano (`git worktree add ...`), copiar los env después: `cp ../booking-platform/.env{,.local} ../booking-platform.f-XXX/`.

Tras merge: `git worktree remove ../booking-platform.f-XXX && git branch -d f-XXX-kebab-slug`.

**Commits descriptivos.** Cada commit debe leerse aislado. No `wip`, no `update X`, no `fixes`.

**Subject (≤72 chars):** `tipo(f-XXX): verbo + objeto concreto + motivación corta`
- Good: `feat(f-005): add Better Auth email+password to unblock student signup`
- Bad: `update auth`, `f-005 changes`

**Body (obligatorio):**
```
Qué:
- <archivos/módulos relevantes y qué cambió>

Por qué:
- <motivación de negocio o técnica>

Cómo verificar:
- <pasos manuales / comando de test / "N/A: refactor">

Refs: F-XXX[, PRD §X.Y][, Architecture §A.B][, ADR-NNN]
```

Trivial commits (typo, rename mecánico) pueden llevar body de una línea, pero el footer `Refs:` con el ticket es siempre obligatorio. Staging explícito por archivo/carpeta — nunca `git add -A`.

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
- **shadcn/ui is the default for every UI primitive.** Before writing a raw `<input>`, `<button>`, `<select>`, `<dialog>`, `<textarea>`, etc., check `components/ui/`; install via `npx shadcn@latest add <comp>` if missing. Reach for the `vercel:shadcn` skill when composing, theming, or extending. Modify the installed primitive aggressively to match editorial design (no default rounded cards with shadows) — do not work around by hand-rolling a parallel element.
- **Hand-rolled HTML primitives only allowed when** (a) the shadcn equivalent does not exist AND installing it would add disproportionate bloat, or (b) the element is a structural layout container with zero state/behavior (`<section>`, `<div>`, `<header>`, `<main>`). Document the exception inline.
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

1. Final pricing per duration
2. Google Business Profile Place ID for review CTA
3. Brand identity assets (logo, hero photography)
4. Tipping split policy (instructor 100% or split with school)

---

**Last updated:** 2026-05-14
