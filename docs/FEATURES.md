# FEATURES — Backlog vivo

**Fuente de verdad del scope por ticket.** Cada feature requiere su ticket aquí antes de delegar a cualquier subagente. Ver [`WORKFLOW.md`](./WORKFLOW.md) para el loop Plan → Build → Review → Test.

**Estados:** `backlog | in-progress | review | done | blocked`
**Prioridad:** `P0` bloqueante MVP · `P1` MVP nice-to-have · `P2` post-MVP

**Mapping duraciones (referencia global):** `ONE_HOUR=1h, TWO_HOURS=2h, INTENSIVE=4h, FULL_DAY=6h`.

---

## Sprint 0 — Setup (antes del primer deploy a Vercel)

### F-001 — Init repo en GitHub

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: —
- AC:
  - [x] `gh repo create` ejecutado, repo público o privado según preferencia del owner
  - [x] Branch protection en `main`: require PR + 1 approval (auto, con bot) + status checks (CI verde)
  - [x] `README.md` mínimo con título + enlace a `docs/PRD.md`
  - [x] `.gitignore` Next.js default + `.env*`
- Tests: N/A (setup)
- Notas: trabajar siempre en branch feature `f-XXX-slug`.

### F-002 — Scaffold Next.js 15 + TypeScript strict + Tailwind v4

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-001
- AC:
  - [x] `create-next-app` con App Router + TS + Tailwind v4 + alias `@/*`
  - [x] `tsconfig.json` con `"strict": true` y `"noUncheckedIndexedAccess": true`
  - [x] `npm run dev` sirve `/` con HTTP 200
  - [x] `npm run build` corre limpio
- Tests: smoke Playwright `/` → 200 (definido en F-008).

### F-003 — shadcn/ui base + tokens iniciales (Impeccable)

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-002
- AC:
  - [x] `npx shadcn@latest init` con preset configurado (base-nova, neutral)
  - [x] Fuente serif para display registrada — Cormorant Garamond (300/400/500/600) via `--font-display`
  - [x] Paleta inicial: low-saturation warm neutral oklch(hue 85), alto contraste
  - [x] Componentes mínimos instalados: `button`, `input`, `label`, `form`, `card`
- Notas: `form.tsx` creado manualmente (base-nova no lo tiene en registry); `card` usa ring-1 no shadow (✓ CLAUDE.md).
- Tests: N/A (visual review viene en F-026/F-027).

### F-004 — Prisma + Neon adapter + schema mínimo Better Auth

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-002
- AC:
  - [x] Neon project `booking-platform` (id `sweet-fog-90943639`) + branch `dev` (id `br-quiet-art-ajwht9s8`) creados; `DATABASE_URL` + `DIRECT_URL` en `.env`
  - [x] `npm i prisma @prisma/client @prisma/adapter-neon @neondatabase/serverless ws` (Prisma v6.19.3 — v7 introduce breaking change en `datasource`)
  - [x] `prisma/schema.prisma` con tablas Better Auth mínimas (User, Session, Account, Verification) + enums `Locale`/`Role` — ver Architecture §4.1, §4.3
  - [x] `lib/db/index.ts` exporta `prisma` singleton con `PrismaNeon` adapter (ver ADR-002)
  - [x] `npx prisma migrate dev --name init` corre limpio sobre branch `dev`
- Notas: secrets en `.env` (no `.env.local`) porque Prisma CLI sólo autocarga `.env`; Next.js también lo lee. `.env` está en `.gitignore`. `.env.example` documenta nombres.
- Tests: `prisma db push` smoke en CI; Vitest test que importa `prisma` y hace `prisma.user.count()` (Vitest llega en F-008).

### F-005 — Better Auth completo (email+pwd + magicLink + Google OAuth)

- Sprint: 0 · Estado: review · Prioridad: P0
- Depende de: F-004
- AC:
  - [x] `lib/auth/index.ts` con Better Auth configurado
  - [x] Email+password habilitado (`emailAndPassword.enabled=true`, `requireEmailVerification=false` por ahora — Resend llega en Sprint 1.5)
  - [x] Plugin `magicLink` registrado (sin envío real hasta Sprint 1.5)
  - [x] Provider `google` con `clientId`/`clientSecret` desde env (`GOOGLE_ID`/`GOOGLE_SECRET`)
  - [x] `app/api/auth/[...all]/route.ts` con handler catch-all
  - [x] Página `/login` provisional con email+pwd, Google y magic-link (se moverá a `app/[locale]/(auth)/login/` cuando aterrice next-intl en Sprint 5)
  - [x] Google Cloud project creado; OAuth consent screen en "Testing"; callback registrado: `http://localhost:3000/api/auth/callback/google` _(acción del owner; bloquea el último AC)_
  - [ ] Login con Google en dev funciona end-to-end (sesión persiste, `auth.api.getSession` la devuelve) _(depende del AC anterior)_
- Tests: Playwright E2E `e2e/f-005-auth-google.spec.ts` — `/login` renderiza los tres métodos, signup crea sesión leíble por `/api/auth/get-session`, signin reusa credenciales, botón Google emite `POST /api/auth/sign-in/social {provider:"google"}`, magic-link muestra confirmación stub.
- Notas: para correr el spec en local hace falta `DATABASE_URL` apuntando a una branch Neon limpia; el test de Google no necesita OAuth real (verifica wiring vía request intercept). Subir a `done` cuando el owner registre credenciales Google y el último AC pase.
- Decisiones pendientes: cuándo subir OAuth consent screen a "Production" (Sprint 1.5 + dominio propio).

### F-006 — Sentry init (frontend + backend, source maps)

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-002
- AC:
  - [x] `@sentry/nextjs` instalado vía wizard (`^10.53.1`)
  - [x] `instrumentation-client.ts` (Next 15 + Turbopack reemplaza `sentry.client.config.ts`) + `sentry.server.config.ts` + `sentry.edge.config.ts` + `instrumentation.ts` register hook + `app/global-error.tsx`
  - [x] `withSentryConfig` envuelve `next.config.ts`; source maps suben con `SENTRY_AUTH_TOKEN` (de `.env.sentry-build-plugin` local o env de Vercel)
  - [x] Ruta de test `/sentry-example-page` + `/api/sentry-example-api` con throws deliberados (frontend + backend)
- Tests: N/A (verificación manual de dashboard tras configurar `SENTRY_AUTH_TOKEN`).
- Notas: org `fjgf-dt`, project `javascript-nextjs` (renombrar a `snowboard-booking` en Sentry UI cuando proceda). DSN hardcoded en configs (público por diseño). `tunnelRoute: "/monitoring"` activado por el wizard — revisar colisión con middleware al introducirlo. Ruta de ejemplo borrable post-verificación.

### F-007 — Vercel Analytics + Speed Insights

- Sprint: 0 · Estado: done · Prioridad: P1
- Depende de: F-002
- AC:
  - [x] `@vercel/analytics` (`^2.0.1`) y `@vercel/speed-insights` (`^2.0.0`) instalados
  - [x] `<Analytics />` y `<SpeedInsights />` montados en `app/layout.tsx` (imports `/next`)
- Tests: N/A (verificación post-deploy en F-015).

### F-008 — Playwright + Vitest instalados, smoke test

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-002
- AC:
  - [x] `npm i -D @playwright/test vitest @vitejs/plugin-react happy-dom`
  - [x] `playwright.config.ts` con baseURL configurable y proyecto chromium
  - [x] `vitest.config.ts` con `happy-dom` env
  - [x] `e2e/smoke.spec.ts` — `/` carga con HTTP 200 y muestra título esperado
  - [x] `npm run test:e2e` y `npm run test:unit` funcionan local
- Tests: el propio smoke test corre verde.

### F-009 — `.claude/settings.local.json` con allowlist mínimo

- Sprint: 0 · Estado: backlog · Prioridad: P1
- Depende de: F-001
- AC:
  - [ ] Allowlist incluye `npm:*`, `npx prisma:*`, `npx playwright:*`, comandos git no destructivos
  - [ ] `CLAUDE.md` y `docs/*.md` presentes en el repo
- Tests: N/A.

### F-010 — Split de `docs/PRD.md` → PRD + Architecture

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: —
- AC:
  - [x] `docs/Architecture.md` con §8 (stack/estructura/principios), §9 (modelo datos), §11 (integraciones), ADRs
  - [x] `docs/PRD.md` con §1-§7, §10, §12-§15 y cross-refs a Architecture
  - [x] Mapping duraciones documentado en ambos
- Tests: N/A.

### F-011 — `docs/FEATURES.md` poblado

- Sprint: 0 · Estado: in-progress · Prioridad: P0
- Depende de: —
- AC:
  - [ ] Tickets de Sprint 0 + 1.5 + 1 con AC binarios
  - [ ] Bullets gruesos para Sprints 2-6
- Tests: N/A.

### F-012 — `docs/WORKFLOW.md` (corta, ≤80 líneas)

- Sprint: 0 · Estado: backlog · Prioridad: P0
- Depende de: F-011
- AC:
  - [ ] Tabla "qué subagente por fase"
  - [ ] Reglas Playwright per-feature
  - [ ] Ritual de repriorización
- Tests: N/A.

### F-013 — CI con GitHub Actions

- Sprint: 0 · Estado: backlog · Prioridad: P0
- Depende de: F-002, F-008
- AC:
  - [ ] `.github/workflows/ci.yml` corre `lint`, `typecheck`, `test:unit`, `test:e2e` (smoke) en cada PR
  - [ ] Cache de `node_modules` configurado
  - [ ] Job falla bloquea merge (status check requerido por branch protection de F-001)
- Tests: el propio workflow verde.

### F-014 — Vercel: conectar repo + deploy previews

- Sprint: 0 · Estado: backlog · Prioridad: P0
- Depende de: F-013
- AC:
  - [ ] Repo conectado a Vercel project
  - [ ] Preview deploy en cada PR
  - [ ] Env vars de dev configuradas (DATABASE_URL preview, etc.)
- Tests: PR de prueba dispara preview verde.

### F-015 — Primer deploy a `main` (URL pública disponible)

- Sprint: 0 · Estado: backlog · Prioridad: P0
- Depende de: F-014
- AC:
  - [ ] Merge a `main` despliega a producción
  - [ ] URL pública (`https://<project>.vercel.app`) accesible
  - [ ] Sentry recibe eventos del entorno production
  - [ ] Vercel Analytics registra pageview
- Tests: smoke Playwright contra URL de producción en CI post-deploy.

---

## Sprint 1.5 — Servicios externos que requieren URL pública

### F-016 — Añadir URL de Vercel al callback list de Google OAuth

- Sprint: 1.5 · Estado: backlog · Prioridad: P0
- Depende de: F-015
- AC:
  - [ ] Callback `https://<vercel-url>/api/auth/callback/google` añadido en Google Cloud Console
  - [ ] Login Google funciona en preview + production
- Tests: Playwright E2E en preview env.

### F-017 — Resend account + verificación de dominio DNS

- Sprint: 1.5 · Estado: backlog · Prioridad: P0
- Depende de: F-015
- AC:
  - [ ] Cuenta Resend creada
  - [ ] Dominio (a definir) verificado con DKIM/SPF/DMARC
  - [ ] API key en Vercel env (prod + preview)
  - [ ] Email de prueba enviado vía Resend MJML / React Email a una cuenta de control
- Tests: integration test que envía email mock en CI (no real).
- Decisiones pendientes: dominio definitivo + proveedor DNS suizo.

### F-018 — Stripe account + activar TWINT + claves test

- Sprint: 1.5 · Estado: backlog · Prioridad: P0
- Depende de: F-015
- AC:
  - [ ] Cuenta Stripe creada con datos de la escuela
  - [ ] TWINT activado (request a Stripe support si necesario)
  - [ ] Claves de test (`pk_test_*`, `sk_test_*`) en Vercel env
  - [ ] Webhook endpoint registrado apuntando a `<vercel-url>/api/webhooks/stripe`
  - [ ] `STRIPE_WEBHOOK_SECRET` en Vercel env
- Tests: Stripe CLI `stripe trigger payment_intent.succeeded` en dev, verifica que el webhook se procesa.

### F-019 — Secrets de Stripe + Resend + Google en Vercel

- Sprint: 1.5 · Estado: backlog · Prioridad: P0
- Depende de: F-016, F-017, F-018
- AC:
  - [ ] Todas las env vars sensibles en Vercel env (no commits)
  - [ ] `.env.example` documenta nombres (sin valores)
- Tests: N/A (smoke en F-018).

---

## Sprint 1 — Core booking engine + UI Steps 1-3

> Playwright E2E obligatorio en tickets que tocan UI o endpoint público.

### F-020 — Schema completo (dominio + enums)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-004
- AC:
  - [ ] Tablas `instructor`, `availabilityBlock`, `season`, `booking`, `attendee`, `accountCredit`, `tip` en `prisma/schema.prisma` (ver Architecture §4.2)
  - [ ] Enums `Locale, Role, Duration, Level, BookingStatus, AvailabilityKind, CreditReason, CreditStatus` (ver Architecture §4.3)
  - [ ] Migración aplicada en branch Neon dev
  - [ ] `npx @better-auth/cli generate` ejecutado tras cambios a `lib/auth/`
- Tests: Vitest snapshot del schema; `prisma validate`.

### F-021 — Seed `prisma/seed.ts`

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-020
- AC:
  - [ ] 1 user con roles `[student, instructor, admin]` (el owner)
  - [ ] 1 instructor enlazado al user, `acceptsSameDayIfBooked=false`, idiomas `[en, de, es]`
  - [ ] 1 season activa (Nov-Apr) con `anchorTimes=["09:00","11:00","13:00","15:00"]`, `operatingHoursStart="09:00"`, `operatingHoursEnd="17:00"`
  - [ ] `availabilityBlock` cubriendo días del season
  - [ ] `npx prisma db seed` corre limpio sobre branch vacío
- Tests: Vitest que tras seed verifica counts y relaciones.

### F-022 — `lib/booking-engine/` (algoritmo availability + Vitest 90%+)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-021
- AC:
  - [ ] Función `computeCalendar({duration, language, monthFrom, monthTo})` → `Array<{date, hasAvailability, instructorCount}>`
  - [ ] Función `computeSlotsForDate({date, duration, language})` → `{anchorTimes: [{time, available, instructors[]}]}`
  - [ ] Función `findNearbyDates({date, duration, language, window=14})` → 3-5 fechas
  - [ ] Respeta buffer 10min entre clases consecutivas mismo instructor
  - [ ] Respeta 24h advance + `acceptsSameDayIfBooked`
  - [ ] Coverage Vitest ≥90% (medido con `vitest --coverage`)
- Tests: Vitest exclusivo, sin HTTP. Múltiples scenarios edge (instructor saturado, fecha pasada, fuera de season, idioma no soportado).
- Decisiones pendientes: ¿branch Neon dedicada para tests o SQLite en memoria? — decidir aquí. Recomendación: branch Neon `playwright` + reset entre suites.

### F-023 — `GET /api/availability/calendar` + nearby fallback

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-022
- AC:
  - [ ] Params `duration`, `language`, `monthFrom`, `monthTo` validados con Zod
  - [ ] Llama `lib/booking-engine/computeCalendar`
  - [ ] `GET /api/availability/nearby?date&duration&language` devuelve 3-5 fechas cercanas
  - [ ] p95 < 500ms con seed de 1 instructor (verificar con `autocannon` o similar)
- Tests: Playwright API test que cubre happy path + edge (rango >3 meses → 400; idioma inválido → 400).

### F-024 — `GET /api/availability/slots`

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-022
- AC:
  - [ ] Params `date`, `duration`, `language` validados con Zod
  - [ ] Response shape según PRD §6.2
  - [ ] Anchor times respetan `operatingHoursEnd`
  - [ ] "cualquiera disponible" devuelve lista de instructores en orden de prioridad (idioma exacto → menor carga del día → round-robin)
- Tests: Playwright API + Vitest unit en booking-engine.

### F-025 — UI Step 1 (filtros: duración + idioma)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-003
- AC:
  - [ ] Página `/[locale]/reservar` con RHF + Zod
  - [ ] Select duración (4 opciones, mostradas en horas, no en enum)
  - [ ] Select idioma (EN/DE/ES) — preselecciona locale de la URL
  - [ ] Botón "Continuar" navega a Step 2 con state preservado en URL search params
- Tests: Playwright E2E `e2e/f-025-step1.spec.ts` — completar filtros, verificar navegación + URL.

### F-026 — UI Step 2 (smart calendar)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-023, F-025
- AC:
  - [ ] Calendario mensual con días activos según `/api/availability/calendar`
  - [ ] Click en día sin disponibilidad → muestra 3-5 fechas cercanas (nearby endpoint)
  - [ ] Loading skeleton mientras carga
  - [ ] Visual review con skill `impeccable` antes de marcar done (no shadows en days, borders OK)
- Tests: Playwright E2E `e2e/f-026-step2.spec.ts` — seleccionar día activo, intentar click en día inactivo, verificar nearby UI.

### F-027 — UI Step 3 (anchor time + instructor)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-024, F-026
- AC:
  - [ ] Lista de anchor times con disponibilidad real
  - [ ] Por anchor: tarjeta de instructor(es) con foto, nombre, idiomas
  - [ ] Opción "cualquiera disponible" preseleccionada
  - [ ] Botón "Continuar" navega a Step 4 (no implementado en este sprint — placeholder OK)
- Tests: Playwright E2E `e2e/f-027-step3.spec.ts` — flujo completo Steps 1→3.

---

## Sprints 2-6 — Bullets gruesos (desglose al cerrar Sprint 1)

### Sprint 2 — Auth + Pagos (semanas 4-5)

- Auth UI: login, registro, magic link recibido por email (depende de F-017), Google OAuth en producción.
- Dashboard alumno básico: lista de reservas (vacío en MVP), datos personales.
- Step 4: booker + attendees (1-4) + niveles + notas + T&C.
- Step 5: pago Stripe Payment Element (Card + TWINT + Apple/Google Pay).
- Webhook handler `/api/webhooks/stripe` con idempotencia (ADR-006).
- Emails: confirmación con `.ics` adjunto + cron horario para recordatorio 24h + cron horario para post-clase T+2h.
- Página de éxito `/[locale]/reservar/exito/[id]`.
- **Decisión pendiente que bloquea:** precios por duración.

### Sprint 3 — Cancelaciones + Créditos (semana 6)

- Flujo cancelación user desde dashboard (≥1h antes).
- Sistema de créditos: generación, locking durante PaymentIntent, commit en webhook success.
- UI aplicar créditos en Step 5 (toggle + breakdown).
- Cron mensual de expiración (`0 0 1 * *`).
- Email cancelación user + notif a instructor.

### Sprint 4 — Vista instructor + Admin (semanas 7-8)

- Vista instructor: agenda diaria, gestión de `availabilityBlock`, perfil.
- Conectar Google Calendar (OAuth offline access, encriptación ADR-007).
- Inserción/borrado de eventos en Google Calendar.
- Panel admin: CRUD instructores, vista de reservas, modal "Cancel day" (ops batch + preview de impacto).
- Email cancelación ops en locale del booker.
- **Decisión pendiente:** tip split policy (afecta `Tip` table flow).

### Sprint 5 — Landing + SEO (semanas 9-10)

- Home editorial (skill `impeccable` mode "brand").
- Página de instructores + perfiles individuales.
- Página de precios.
- Blog MDX (2-3 posts iniciales).
- Estáticas: sobre, contacto, FAQ, T&C, privacidad.
- SEO completo: sitemap dinámico con hreflang, structured data Schema.org/LocalBusiness, OG images dinámicas, robots.txt.
- next-intl con 3 locales completados (mensajes JSON, slugs traducidos).
- **Decisión pendiente:** logo, hero photography, Place ID Google Business.

### Sprint 6 — Polish + QA (semanas 11-12)

- E2E Playwright críticos: happy path booking, cancelación user, redención crédito, cancelación ops, auth flows.
- Visual review loop con skill `playwright-skill` + screenshots.
- Accessibility audit WCAG 2.1 AA.
- Performance audit Lighthouse > 95 mobile.
- Security review con skill `security-review`.
- Soft launch interno → producción.

---

## Bloqueantes / decisiones abiertas (consolidadas)

| Ref     | Decisión                           | Bloquea                           | Acción                               |
| ------- | ---------------------------------- | --------------------------------- | ------------------------------------ |
| D-PRC   | Precios por duración               | Sprint 2 (Step 5 muestra totales) | Owner define antes de Sprint 2       |
| D-TIP   | Tip split policy                   | Sprint 4 (flujo `Tip`)            | Owner define antes de Sprint 4       |
| D-LEG   | Legal review credit-only (ADR-008) | Producción (no Sprint 1-3)        | Contratar bufete antes de Sprint 5   |
| D-LOGO  | Logo + hero photography            | Sprint 5 (landing)                | Owner produce antes de Sprint 5      |
| D-PLACE | Google Place ID                    | Sprint 5 (email post-clase CTA)   | Confirmar perfil escuela en Sprint 5 |
