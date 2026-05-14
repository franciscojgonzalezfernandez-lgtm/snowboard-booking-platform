# Architecture — Snowboard Booking Platform

**Versión:** 1.0
**Fecha:** 2026-05-14
**Complementa:** [`docs/PRD.md`](./PRD.md) (producto/negocio) y [`CLAUDE.md`](../CLAUDE.md) (reglas operativas).

Este documento contiene la arquitectura técnica, el modelo de datos, las integraciones externas y las decisiones arquitectónicas (ADRs).

---

## 1. Stack confirmado

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS v4 + shadcn/ui (modificado según skill Impeccable) |
| Forms | React Hook Form + Zod |
| i18n | next-intl con prefix path (solo público) |
| Auth | Better Auth (email+pwd + magicLink plugin + Google OAuth) |
| ORM | Prisma |
| DB | Neon Postgres (serverless, HTTP driver via `@prisma/adapter-neon`) |
| Pagos | Stripe (Payment Element + Webhooks) |
| Emails | Resend + React Email |
| Calendar | `ics` package + Google Calendar API |
| Storage | Vercel Blob |
| Analytics | Vercel Analytics + Speed Insights |
| Monitoring | Sentry |
| Blog | MDX en repositorio |
| Hosting | Vercel (+ Cron Jobs) |
| Testing | Playwright (E2E) + Vitest (unit/integration) |

> Las sustituciones de stack están prohibidas — ver [`CLAUDE.md`](../CLAUDE.md) sección "Stack".

---

## 2. Estructura del proyecto

```
snowboard-booking/
├── .claude/
│   ├── skills/                      # impeccable + playwright-skill
│   └── settings.local.json
├── CLAUDE.md                        # Reglas operativas del proyecto
├── docs/
│   ├── PRD.md                       # Producto/negocio
│   ├── Architecture.md              # Este documento
│   ├── FEATURES.md                  # Backlog vivo
│   └── WORKFLOW.md                  # Workflow + subagentes + Playwright
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── app/
│   ├── [locale]/                    # Rutas i18n: EN (sin prefix), DE, ES
│   │   ├── (marketing)/             # Landing, instructores, blog
│   │   ├── (booking)/               # Flujo de reserva
│   │   ├── (auth)/                  # Login, registro
│   │   ├── dashboard/               # Dashboard alumno
│   │   └── layout.tsx
│   ├── instructor/                  # EN only, fuera de [locale]
│   ├── admin/                       # EN only, fuera de [locale]
│   ├── api/
│   │   ├── auth/[...all]/           # Better Auth handler (catch-all)
│   │   ├── webhooks/stripe/
│   │   ├── cron/
│   │   ├── availability/
│   │   └── google-calendar/
│   ├── sitemap.ts
│   └── robots.ts
├── lib/
│   ├── db/                          # Prisma client (Neon adapter)
│   ├── auth/                        # Better Auth config
│   ├── stripe/                      # Stripe client + helpers
│   ├── email/                       # React Email templates + Resend
│   ├── calendar/                    # ICS generator + Google Calendar
│   ├── i18n/                        # next-intl config
│   └── booking-engine/              # Algoritmo availability (core, aislado)
├── messages/                        # Traducciones JSON (en/de/es)
├── content/blog/                    # MDX del blog
├── e2e/                             # Playwright tests
└── public/
```

---

## 3. Principios arquitectónicos

- **Server-first.** Server Components y Server Actions por defecto. Client Components solo cuando hay interactividad real (state, effects, eventos).
- **Edge runtime cuando aplique:** i18n middleware, simple API routes.
- **Type-safety end-to-end:** Zod schemas compartidos cliente↔servidor; tipos generados desde Prisma.
- **Booking engine aislado:** la lógica core de availability vive en `lib/booking-engine/` con unit tests Vitest independientes del HTTP layer (target 90%+ coverage).
- **Transactional integrity:** todas las mutaciones multi-tabla (reserva, cancelación, redención de crédito, payment confirmation) usan Prisma transactions.
- **Idempotencia en webhooks:** Stripe webhooks idempotentes vía deduplicación por `event.id`.
- **Money on server:** todas las operaciones monetarias en el servidor. Formato display via `Intl.NumberFormat('de-CH')`.

---

## 4. Modelo de Datos

### 4.1 Tablas Better Auth (gestionadas por la librería)

**user**
```
id              String   @id @default(cuid())
email           String   @unique
emailVerified   Boolean  @default(false)
name            String?
image           String?
locale          Locale   @default(en)
roles           Role[]   @default([student])
phone           String?
preferences     Json?
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
```

**session, account, verification:** según convención Better Auth + Prisma adapter. Regenerar con `npx @better-auth/cli generate` tras cambios en `lib/auth/`.

### 4.2 Tablas de dominio

**instructor**
```
id                       String   @id @default(cuid())
userId                   String   @unique
photo                    String?  (Vercel Blob URL)
bio                      String?  @db.Text
specialties              String[]
languages                Locale[]
active                   Boolean  @default(true)
acceptsSameDayIfBooked   Boolean  @default(false)
calendarConnected        Boolean  @default(false)
googleRefreshToken       String?  (encrypted AES-256-GCM, ver ADR-007)
createdAt                DateTime @default(now())
user                     User     @relation(fields: [userId], references: [id])
```

**availabilityBlock**
```
id              String            @id @default(cuid())
instructorId    String
startDateTime   DateTime
endDateTime     DateTime
kind            AvailabilityKind  (AVAILABLE | BLOCKED)
instructor      Instructor        @relation(fields: [instructorId], references: [id])
```

**season**
```
id                      String     @id @default(cuid())
name                    String
startDate               DateTime
endDate                 DateTime
active                  Boolean    @default(true)
anchorTimes             String[]   (ej: ["09:00","11:00","13:00","15:00"])
operatingHoursStart     String     (ej: "09:00")
operatingHoursEnd       String     (ej: "17:00")
```

**booking**
```
id                        String          @id @default(cuid())
bookerId                  String
instructorId              String
date                      DateTime        @db.Date
anchorTime                String          (ej: "09:00")
duration                  Duration        (ONE_HOUR | TWO_HOURS | INTENSIVE | FULL_DAY)
language                  Locale
status                    BookingStatus   (PENDING_PAYMENT | CONFIRMED | COMPLETED | CANCELLED_BY_USER | CANCELLED_BY_OPS | PAYMENT_FAILED)
totalPriceCents           Int
stripePaymentIntentId     String?         @unique
icsUid                    String          @unique
googleEventId             String?
notes                     String?         @db.Text
cancelledByUserAt         DateTime?
cancelledByOpsAt          DateTime?
opsReason                 String?
reminder24hSentAt         DateTime?
postClassEmailSentAt      DateTime?
createdAt                 DateTime        @default(now())
booker                    User            @relation(fields: [bookerId], references: [id])
instructor                Instructor      @relation(fields: [instructorId], references: [id])
attendees                 Attendee[]
tip                       Tip?
```

**attendee**
```
id              String   @id @default(cuid())
bookingId       String
name            String
birthDate       DateTime @db.Date
level           Level    (BEGINNER | INTERMEDIATE | ADVANCED | EXPERT_FREESTYLE)
isBooker        Boolean  @default(false)
booking         Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
```

**accountCredit**
```
id                   String         @id @default(cuid())
userId               String
amountCents          Int
sourceBookingId      String
usedOnBookingId      String?
lockedByBookingId    String?
reason               CreditReason   (USER_CANCEL | OPS_CANCEL)
status               CreditStatus   (ACTIVE | LOCKED | USED | EXPIRED)
expiresAt            DateTime
usedAt               DateTime?
createdAt            DateTime       @default(now())
user                 User           @relation(fields: [userId], references: [id])
sourceBooking        Booking        @relation("CreditSource", fields: [sourceBookingId], references: [id])
usedOnBooking        Booking?       @relation("CreditRedemption", fields: [usedOnBookingId], references: [id])
```

**tip**
```
id                       String   @id @default(cuid())
bookingId                String   @unique
instructorId             String
amountCents              Int
stripePaymentIntentId    String   @unique
paidAt                   DateTime
requestEmailSentAt       DateTime
booking                  Booking  @relation(fields: [bookingId], references: [id])
instructor               Instructor @relation(fields: [instructorId], references: [id])
```

### 4.3 Enums

```
enum Locale            { en, de, es }
enum Role              { student, instructor, admin }
enum Duration          { ONE_HOUR, TWO_HOURS, INTENSIVE, FULL_DAY }
                       // ONE_HOUR=1h, TWO_HOURS=2h, INTENSIVE=4h, FULL_DAY=6h
enum Level             { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT_FREESTYLE }
enum BookingStatus     { PENDING_PAYMENT, CONFIRMED, COMPLETED, CANCELLED_BY_USER, CANCELLED_BY_OPS, PAYMENT_FAILED }
enum AvailabilityKind  { AVAILABLE, BLOCKED }
enum CreditReason      { USER_CANCEL, OPS_CANCEL }
enum CreditStatus      { ACTIVE, LOCKED, USED, EXPIRED }
```

---

## 5. Integraciones externas

| Servicio | Propósito | Bloqueante para |
|---|---|---|
| Stripe | Pagos (Card, TWINT, Apple/Google Pay) + webhooks | Sprint 2 (requiere URL pública en onboarding) |
| Resend | Emails transaccionales (verificación de dominio DNS) | Sprint 2 (verificación DNS puede tardar — arrancar día 1 de Sprint 1.5) |
| Google Cloud — OAuth | Login Google + Calendar API offline access | Sprint 0 dev (localhost callback); Vercel URL se añade en Sprint 1.5 |
| Google Cloud — Calendar API | Inserción/borrado de eventos en agenda del instructor | Sprint 4 |
| Google Business Profile | Place ID para CTA de review en email post-clase | Sprint 5 (CTA email) |
| Sentry | Error monitoring frontend + backend | Sprint 0 |
| Vercel | Hosting + Blob + Cron + Analytics + Speed Insights | Sprint 0 |
| Neon | Postgres (branches dev/preview/prod) | Sprint 0 |
| GitHub | Repo + CI (Actions: lint+typecheck+vitest+playwright smoke) | Sprint 0 |

---

## 6. Decisiones Arquitectónicas (ADRs)

### ADR-001 — Auth: Better Auth, no NextAuth/Auth.js
- **Contexto:** Necesitamos email+pwd + magic link + Google OAuth con TypeScript estricto y Prisma adapter.
- **Decisión:** Better Auth.
- **Por qué:** API más limpia, tipado superior, plugins (magicLink) idiomáticos, integración directa con Prisma sin adapters de terceros. NextAuth/Auth.js tiene historial de breaking changes mayores.
- **Coste:** comunidad menor, menos tutoriales — mitigado con `docs/Architecture.md` + `CLAUDE.md` claros.

### ADR-002 — ORM: Prisma + Neon HTTP adapter
- **Contexto:** Neon es serverless; el driver TCP estándar de `pg` no funciona bien en Edge/Vercel Functions cold-start.
- **Decisión:** Prisma con `@prisma/adapter-neon` + `@neondatabase/serverless` (HTTP driver).
- **Por qué:** Type-safety + migraciones declarativas + serverless-friendly. Drizzle se evaluó pero Prisma tiene mejor DX para schemas con muchas relaciones (como el nuestro: ~10 tablas).
- **Coste:** bundle Prisma client más grande — aceptable porque corre en server.

### ADR-003 — i18n: next-intl solo en rutas públicas
- **Contexto:** Público (marketing + booking + student dashboard) trilingüe; instructor/admin son herramientas internas con un solo usuario (EN nativo).
- **Decisión:** `app/[locale]/` para rutas públicas (`en` sin prefix, `de`, `es`); `app/instructor/` y `app/admin/` fuera de `[locale]`, EN-only.
- **Por qué:** evita traducir paneles internos (work duplicado para 1 usuario). EN sin prefix mejora SEO en mercado anglo-internacional.
- **Coste:** dos shells de layout — manejable.

### ADR-004 — Dinero: `priceInCents: Int`
- **Contexto:** Floats causan errores de redondeo en operaciones monetarias.
- **Decisión:** todos los campos monetarios terminan en `Cents` y se almacenan como `Int`. Display via `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' })`.
- **Por qué:** estándar de la industria de pagos (Stripe usa cents); evita bugs invisibles.

### ADR-005 — Mutaciones multi-tabla: Prisma transactions obligatorias
- **Contexto:** Booking confirmation toca booking + availabilityBlock + accountCredit + (opcional) tip. Sin transaction, fallos parciales corrompen estado.
- **Decisión:** toda mutación que toque ≥2 tablas usa `prisma.$transaction([...])` o `prisma.$transaction(async (tx) => ...)`.
- **Coste:** transacciones largas pueden bloquear; mantenerlas cortas (<200ms) y revisar índices.

### ADR-006 — Stripe webhooks idempotentes vía `event.id`
- **Contexto:** Stripe puede reintentar webhooks; sin deduplicación se procesarían pagos múltiples veces.
- **Decisión:** tabla `webhookEvent (id, processedAt)` con `event.id` como PK. Antes de procesar: `INSERT ... ON CONFLICT DO NOTHING`; si conflicto, skip.
- **Coste:** una tabla extra; barrer entradas >30 días con cron.

### ADR-007 — Refresh tokens Google encriptados AES-256-GCM
- **Contexto:** Refresh tokens de Google Calendar permiten acceso indefinido a calendario del instructor; almacenarlos en plain text sería negligente.
- **Decisión:** encriptar con AES-256-GCM antes de persistir; key en `ENCRYPTION_KEY` (env var, 32 bytes base64). Helpers en `lib/calendar/crypto.ts`.
- **Coste:** rotación de key requiere re-encriptar todos los tokens — proceso documentado en `lib/calendar/README.md` cuando se implemente.

### ADR-008 — Cancelaciones: credit-only (legal review pendiente)
- **Contexto:** Modelo de negocio prefiere créditos a refunds cash; reduce fricción operativa pero puede ser legalmente cuestionable bajo CO Art. 19 (cláusulas leoninas) y nLPD.
- **Decisión MVP:** todas las cancelaciones generan crédito (válido 1 año, FIFO al redimir, locking durante PaymentIntent).
- **Pendiente:** review legal con bufete suizo antes de producción. Si invalida el modelo para cancelaciones operativas, v1.1 añade refund cash automático en ops cancellations.
- **Trazabilidad:** `accountCredit.reason` distingue `USER_CANCEL` de `OPS_CANCEL` — facilita migración a futuro.

---

## Fin de Architecture.md
