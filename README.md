# 🏂 Snowboard Booking Platform

> An **AI-first**, production-grade booking system for a single ski school in Switzerland. Built end-to-end by one developer + Claude Code, architected for multi-instructor expansion.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Better Auth](https://img.shields.io/badge/Better%20Auth-1.6-1f6feb)](https://www.better-auth.com)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757)](https://docs.anthropic.com/en/docs/claude-code)
[![Live Demo](https://img.shields.io/badge/Live-Demo-000?logo=vercel)](https://snowboard-booking-platform-9b1q.vercel.app)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

👈 **[Live Demo](https://snowboard-booking-platform-9b1q.vercel.app)** · 📖 **[Product Requirements](docs/PRD.md)** · 🧱 **[Architecture](docs/Architecture.md)** · 🛠️ **[Workflow](docs/WORKFLOW.md)** · 📋 **[Backlog](docs/FEATURES.md)**

---

## 🎯 Why This Project

A real product I'm shipping for **a snowboard school in the Swiss Alps**. It also doubles as the canonical example of how I build software in 2026 — **AI-first**, with strict conventions, explicit agents, and a workflow that produces production code instead of prototype slop.

**The thesis:** generic booking platforms (Bókun, Peek, FareHarbor) are functional but ugly, generic, and expensive. Small independent schools deserve a premium, editorial brand and a frictionless multilingual booking flow. That's what this builds — minus the 18% commission.

---

## 🤖 AI-First Development

This isn't "I used Copilot to autocomplete." This is a full agentic pipeline. Every feature follows the same loop, with a documented context surface so Claude makes the right decision the first time.

### 1. Context surface (read by Claude every session)

| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Stack rules, naming, design direction, security checklist, money handling, git ritual |
| [`docs/PRD.md`](docs/PRD.md) | Product + business: personas, KPIs, cancellation policy, monetization |
| [`docs/Architecture.md`](docs/Architecture.md) | Data model, integrations, ADRs |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Living backlog. **No ticket → no work.** Source of truth for scope |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Subagent orchestration: Plan → Build → Review → Test |

### 2. Feature loop

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  A. LOCATE │ →  │  B. PLAN   │ →  │  C. BUILD  │ →  │  D. REVIEW │
│ investigtr │    │   agent    │    │   builder  │    │  + tests   │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
   where is X?      step plan         1-2 files         diff + e2e
                    no edits          surgical edit     + visual
```

- **Locate** — `cavecrew-investigator` finds the code, no fixes proposed.
- **Plan** — `Plan` agent designs the implementation. Does not edit.
- **Build** — `cavecrew-builder` or main thread. Strict scope from the ticket.
- **Review** — `cavecrew-reviewer` for the diff, `playwright-skill` for E2E + visual, `impeccable` for UI, `security-review` before merging `main`.

### 3. Skills active on this repo

| Skill | Role |
|---|---|
| `impeccable` | Editorial UI direction (Aesop, Cereal, Monocle references) |
| `playwright-skill` | E2E + visual review loop |
| `vercel-react-best-practices` | React/Next.js perf base |
| `nextjs-app-router-patterns` | RSC, streaming, Server Actions |
| `typescript-advanced-types` | strict-mode TS, generics, mapped types |
| `prisma-database-setup` · `prisma-client-api` · `prisma-postgres` | Prisma + Neon end-to-end |
| `next-intl-add-language` | Locale + slug translation maintenance |
| `testing-strategy` · `booking-platform-perf` | QA + Web Vitals budgets |

### 4. Hard rules baked into `CLAUDE.md`

- **No stack substitutions** — Better Auth (not NextAuth), Prisma (not Drizzle), Resend (not SendGrid).
- **Server Components by default.** `'use client'` only when truly needed.
- **All multi-table mutations inside Prisma transactions.**
- **Money:** stored as `priceInCents: Int`. Currency math on the server. Always.
- **Worktree per ticket** (`../booking-platform.f-XXX`), descriptive commits with `Qué / Por qué / Cómo verificar / Refs` body, push + PR before `done`.

---

## 🧱 Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, RSC, Server Actions) | RSC ships less JS, Server Actions kill API boilerplate |
| Language | **TypeScript** (`strict`, `noUncheckedIndexedAccess`) | Compile-time guarantees on a booking domain that loves edge cases |
| Styling | **Tailwind v4** + **shadcn/ui** (heavily modified) | Editorial-grade defaults, zero runtime CSS |
| Forms | **React Hook Form** + **Zod** | Same Zod schema validates client + server |
| i18n | **next-intl** (public routes only) | EN / DE / ES with translated slugs, EN has no prefix for SEO |
| Auth | **Better Auth** 1.6 (email+pwd, magic link, Google OAuth) | Modern, framework-native, type-safe sessions |
| ORM | **Prisma** 6 + `@prisma/adapter-neon` | Neon HTTP driver for Edge/serverless runtimes |
| DB | **Neon Postgres** | Branch-per-feature DBs, serverless pricing |
| Payments | **Stripe** Payment Element (Card · TWINT · Apple Pay · Google Pay) | TWINT is non-negotiable for the Swiss market |
| Email | **Resend** + React Email | Receipts, reminders, post-class CTA to Google review |
| Calendar | `ics` package + **Google Calendar API** | `.ics` for the student, push to instructor's Google Calendar |
| Storage | **Vercel Blob** | Instructor photos, blog assets |
| Monitoring | **Sentry** + Vercel Analytics + Speed Insights | Errors, Web Vitals, RUM |
| Hosting | **Vercel** + Cron Jobs | Edge runtime, scheduled jobs (reminder emails, calendar resync) |
| Testing | **Playwright** (E2E) + **Vitest** (unit) | Booking engine has 90%+ coverage target |

---

## 🗺️ Project Layout

```
booking-platform/
├── CLAUDE.md                       ← AI context: stack, conventions, security, git
├── docs/
│   ├── PRD.md                      ← product/business: personas, KPIs, policies
│   ├── Architecture.md             ← data model, integrations, ADRs
│   ├── FEATURES.md                 ← living backlog (source of truth for scope)
│   ├── WORKFLOW.md                 ← subagent orchestration
│   └── design-system.md            ← editorial tokens, typography, spacing
│
├── app/
│   ├── [locale]/                   ← i18n: EN (no prefix), DE, ES
│   │   ├── (marketing)/            ← landing, instructors, blog
│   │   ├── (booking)/              ← reservation flow
│   │   ├── (auth)/                 ← login, signup, verify
│   │   ├── dashboard/              ← authenticated student area
│   │   └── layout.tsx
│   ├── instructor/                 ← EN only, outside [locale]
│   ├── admin/                      ← EN only, outside [locale]
│   ├── api/
│   │   ├── auth/[...all]/          ← Better Auth catch-all
│   │   ├── webhooks/stripe/        ← signature-verified, idempotent
│   │   ├── cron/                   ← reminder emails, calendar resync
│   │   ├── availability/           ← booking engine endpoint (< 500ms p95)
│   │   └── google-calendar/
│   ├── sitemap.ts
│   └── robots.ts
│
├── lib/
│   ├── db/                         ← Prisma client (Neon adapter)
│   ├── auth/                       ← Better Auth config
│   ├── stripe/                     ← Stripe client + helpers
│   ├── email/                      ← React Email templates + Resend
│   ├── calendar/                   ← ICS generator + Google Calendar
│   ├── i18n/                       ← next-intl config
│   └── booking-engine/             ← availability algorithm (core, isolated)
│
├── messages/{en,de,es}.json        ← translations
├── prisma/schema.prisma            ← single source of truth for the data model
├── e2e/                            ← Playwright suites (per-ticket)
└── tests/                          ← Vitest unit tests
```

---

## 🌐 Routing

```
/                            EN  landing
/de/                         DE  landing
/es/                         ES  landing
/instructors                 EN  instructor directory
/de/instruktoren             DE  translated slug
/es/instructores             ES  translated slug
/book                        EN  booking flow
/dashboard                   EN  student dashboard (auth)
/instructor                  EN  instructor panel (auth, role: instructor)
/admin                       EN  admin panel (auth, role: admin)
/api/webhooks/stripe         POST  signature-verified, idempotent
/api/cron/reminders          POST  CRON_SECRET-gated
```

- **Public + student dashboard:** trilingual (EN / DE / ES).
- **Instructor + admin panels:** English only — no audience benefit from translating.
- **EN has no `/en` prefix** — better SEO for the English-speaking market.

---

## ⚡ Performance Budget

Enforced by the `booking-platform-perf` skill on every UI change.

| Metric | Budget |
|---|---|
| LCP (home, mobile) | **< 2.5s** |
| CLS (global) | **< 0.1** |
| Availability search | **< 500ms p95** |
| JS bundle on home | **< 200 KB gzipped** |
| Images | `next/image` with AVIF + WebP |

---

## 🎨 Design Direction

**Editorial / premium.** References: Aesop, Cereal magazine, Outdoor Voices, Monocle.

- ✅ Serif display typography, generous whitespace, high contrast, low saturation.
- ✅ Photography-led. Subtle, intentional motion.
- ❌ No purple/blue gradients. No 3-column-icon-card grids. No glassmorphism. No emoji decoration. No drop shadows — borders only.

When in doubt, the `impeccable` skill is the source of truth.

---

## 🔐 Security Checklist (applied per PR)

- [x] CSRF on mutations (Better Auth + Server Actions)
- [x] Zod validation on every server input
- [x] Rate limiting on auth + availability endpoints
- [x] Stripe webhooks: signature verified + idempotent on `event.id`
- [x] Cron jobs gated by `CRON_SECRET`
- [x] Google refresh tokens encrypted at rest (AES-256-GCM)
- [x] CSP + HSTS headers, HTTPS only
- [x] Roles re-checked on the server — never trust the client

---

## 🚀 Getting Started

```bash
# 1. Clone
git clone https://github.com/franciscojgonzalezfernandez-lgtm/snowboard-booking-platform.git
cd snowboard-booking-platform

# 2. Install
npm install

# 3. Env
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
#          STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY,
#          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CRON_SECRET

# 4. Database
npx prisma migrate dev
npx prisma db seed

# 5. Dev server
npm run dev          # http://localhost:3000
```

### Useful scripts

```bash
npm run dev              # Next.js dev (Turbopack)
npm run build            # production build (Turbopack)
npm run start            # production server
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test:unit        # Vitest
npm run test:unit:watch  # Vitest watch
npm run test:e2e         # Playwright
```

---

## 🧪 Testing Strategy

| Layer | Tool | Target |
|---|---|---|
| Booking engine (`lib/booking-engine/`) | Vitest | **90%+ coverage** |
| Zod schemas, currency utils | Vitest | full |
| Happy-path booking, cancellation, credit redemption, auth | Playwright | per-ticket E2E spec |
| Visual review | Playwright + Claude | screenshot diff vs. design rules |

**Rule:** every Sprint ≥1 ticket that touches UI or a public endpoint ships with `e2e/<ticket-id>.spec.ts`. No green E2E, no `done`.

---

## 📊 Status

This is an **active, in-progress** MVP. Sprint 0 (setup, scaffolding, CI, i18n, design tokens) is done. The booking flow, payments, and instructor panel are next.

Follow progress in [`docs/FEATURES.md`](docs/FEATURES.md) — every shipped commit references a `F-XXX` ticket there.

---

## 📜 License

**Proprietary — All Rights Reserved.** See [`LICENSE`](LICENSE).

This repository is **source-available, not open-source**. The code is published publicly for portfolio and read-only educational reference. You may **view** it; you may **not** copy, fork for redistribution, modify, redistribute, use commercially, or use it to train AI models. No license is granted by the act of cloning or forking.

For commercial licensing or any permission request: **franciscojgonzalezfernandez@gmail.com**.

---

## 👤 Author

**Francisco Javier González** — Full-Stack Developer, Zürich

- 🌍 [javier-gonzalez-portfolio.com](https://javier-gonzalez-portfolio.com/)
- 💼 [LinkedIn](https://www.linkedin.com/in/fjgonzalezfernandez/)
- 🐙 [GitHub](https://github.com/franciscojgonzalezfernandez-lgtm)

---

> Built with ❤️ in the Swiss Alps, with **Next.js 15**, **Claude Code**, and a strong opinion about how AI-assisted software should be shipped in 2026.

**⭐ Star if this is the kind of workflow you want to see more of.**
