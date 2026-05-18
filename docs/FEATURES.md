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

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-004
- AC:
  - [x] `lib/auth/index.ts` con Better Auth configurado
  - [x] Email+password habilitado (`emailAndPassword.enabled=true`, `requireEmailVerification=false` por ahora — Resend llega en Sprint 1.5)
  - [x] Plugin `magicLink` registrado (sin envío real hasta Sprint 1.5)
  - [x] Provider `google` con `clientId`/`clientSecret` desde env (`GOOGLE_ID`/`GOOGLE_SECRET`)
  - [x] `app/api/auth/[...all]/route.ts` con handler catch-all
  - [x] Página `/login` provisional con email+pwd, Google y magic-link (se moverá a `app/[locale]/(auth)/login/` cuando aterrice next-intl en Sprint 5)
  - [x] Google Cloud project creado; OAuth consent screen en "Testing"; callback registrado: `http://localhost:3000/api/auth/callback/google` _(acción del owner; bloquea el último AC)_
  - [x] Login con Google en dev funciona end-to-end (sesión persiste, `auth.api.getSession` la devuelve) _(depende del AC anterior)_
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

- Sprint: 0 · Estado: done · Prioridad: P1
- Depende de: F-001
- AC:
  - [x] Allowlist incluye `npm:*`, `npx prisma:*`, `npx playwright:*`, comandos git no destructivos (`status`, `diff`, `log`, `add`, `commit`, `branch`, `checkout`, `push`, `worktree`) — más `npx @better-auth/cli:*`, `npx shadcn:*`, `gh pr:*`, `gh repo view:*` que ya se usan en el flujo
  - [x] `CLAUDE.md` y `docs/*.md` (`PRD`, `Architecture`, `FEATURES`, `WORKFLOW`) presentes en el repo
- Tests: N/A.
- Notas: archivo trackeado en git (no gitignored) para que el allowlist sea consistente entre worktrees y reproducible para futuros colaboradores.

### F-010 — Split de `docs/PRD.md` → PRD + Architecture

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: —
- AC:
  - [x] `docs/Architecture.md` con §8 (stack/estructura/principios), §9 (modelo datos), §11 (integraciones), ADRs
  - [x] `docs/PRD.md` con §1-§7, §10, §12-§15 y cross-refs a Architecture
  - [x] Mapping duraciones documentado en ambos
- Tests: N/A.

### F-011 — `docs/FEATURES.md` poblado

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: —
- AC:
  - [x] Tickets de Sprint 0 + 1.5 + 1 con AC binarios (F-001..F-027; F-028..F-034 de Sprint 0.5 añadidos en repriorización posterior)
  - [x] Bullets gruesos para Sprints 2-6
- Tests: N/A.
- Notas: backlog vivo — nuevos tickets se añaden al cerrar sprints. Sprint 0.5 (F-028..F-034) y F-028b se incorporaron post-aterrizaje de F-011 sin reabrir el ticket.

### F-012 — `docs/WORKFLOW.md`

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-011
- AC:
  - [x] Tabla "qué subagente por fase" (Plan → Build → Review → Test, con `cavecrew-investigator/builder/reviewer`, `Plan`, skills `impeccable`/`playwright-skill`/`security-review`)
  - [x] Reglas Playwright per-feature (UI/endpoint público → spec obligatorio; lib pura → Vitest)
  - [x] Ritual de repriorización (inicio sesión + fin de sprint; cambios de prioridad commit en mismo PR)
  - [x] Sección "Qué NO vive aquí" delega stack/PRD/convenciones a sus docs respectivos (anti-drift)
  - [x] Skills activos listados por categoría (diseño, engineering, QA) — coherente con `CLAUDE.md`
  - [x] Ritual de git delegado a `CLAUDE.md` con pointer + razón (anti-duplicación)
- Tests: N/A.
- Notas: cap original "≤80 líneas" relajado. Doc total 116 líneas tras refinamiento; honesto > arbitrario. Git ritual extraído (vive en `CLAUDE.md`) para evitar drift.

### F-013 — CI con GitHub Actions

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-002, F-008
- AC:
  - [x] `.github/workflows/ci.yml` corre `lint`, `typecheck`, `test:unit`, `test:e2e` (smoke) en cada PR
  - [x] Cache de `node_modules` configurado (vía `actions/setup-node` con `cache: npm` + cache de browsers de Playwright)
  - [x] Job falla bloquea merge — branch protection en `main` exige status check `lint + typecheck + unit + e2e smoke` (verificado vía `gh api repos/.../branches/main/protection` → `required_status_checks.contexts: ["lint + typecheck + unit + e2e smoke"]`, `enforce_admins: true`)
- Tests: el propio workflow verde.

### F-014 — Vercel: conectar repo + deploy previews

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-013
- AC:
  - [x] Repo conectado a Vercel project (`prj_VJbAGNQAtfgmsAMldIFRvoH8RWvD`, scope `franciscojgonzalezfernandez-4774s-projects`)
  - [x] Preview deploy en cada PR (validado en PR #24: status `Vercel SUCCESS`, preview `snowboard-git-*.vercel.app`)
  - [x] Env vars dev configuradas (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_ID`, `GOOGLE_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` validados; runtime confirmado en `/api/auth/get-session` → 200 con bypass header)
- Tests: PR de prueba dispara preview verde (PR #24 ✓).
- Notas: Vercel Deployment Protection mantenida en **Standard Protection** (Option B). Acceso automatizado vía Protection Bypass for Automation token; wiring de Playwright/CI en F-014b. Schema de Better Auth promovida de Neon `dev` → `main` vía `prisma migrate deploy` (necesario para que el auth funcione en runtime de previews/prod). Estrategia de DB para previews: por ahora compartida con Neon `main` branch (no per-PR). Migrar a Neon ↔ Vercel integration (branch-per-PR) cuando empiece F-022/F-025.

### F-014b — Vercel preview Protection Bypass wiring

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-014
- AC:
  - [x] `playwright.config.ts` lee `VERCEL_AUTOMATION_BYPASS_SECRET` y, si existe, inyecta `x-vercel-protection-bypass` en `use.extraHTTPHeaders` (no-op si falta — local dev sigue funcionando)
  - [x] `.env.example` documenta `VERCEL_AUTOMATION_BYPASS_SECRET` con explicación de dónde se usa y cómo rotarlo
  - [x] `.github/workflows/ci.yml` reenvía `secrets.VERCEL_AUTOMATION_BYPASS_SECRET` al job env (forks reciben vacío → smoke contra localhost sigue verde)
  - [x] Repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` creado vía `gh secret set` (validado en `gh secret list`)
- Tests: smoke spec local (`/` → 200 contra `localhost:3000`, sin header) verde tras el merge. En Sprint 1, primer spec que apunte a preview confirmará el header con el token actual del owner.
- Notas: Vercel auto-inyecta `VERCEL_AUTOMATION_BYPASS_SECRET` en su propio runtime/build env; GitHub Actions + local `.env.local` necesitan el var explícitamente. **Followup pendiente para el owner:** rotar el token via Vercel dashboard → Deployment Protection → Protection Bypass for Automation → Regenerate, y reaplicar `gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --body '<NEW>'` (el original quedó en el log del chat). No bloquea `done` porque el wiring funciona con cualquier token válido.

### F-015 — Primer deploy a `main` (URL pública disponible)

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-014
- AC:
  - [x] Merge a `main` despliega a producción (Vercel commit status `success` en `93ae21d`, build deploy `https://vercel.com/.../4cPMeyXNbV4n45P8N8Qes4dMkX7S`)
  - [x] URL pública `https://snowboard-booking-platform.vercel.app` accesible (`/` → 307 → `/en` 200; `/de` 200; `/es` 200; `/api/auth/get-session` 200 con body `null`; HSTS + locale cookie correctos)
  - [x] Sentry recibe eventos del entorno production (verificado por el owner en dashboard tras throw deliberado en `/api/sentry-example-api`)
  - [x] Vercel Analytics registra pageview (scripts `/_vercel/insights/script.js` + `/_vercel/speed-insights/script.js` sirven 200; pageview confirmado en dashboard)
- Tests: smoke Playwright contra URL de producción en CI post-deploy → entregado en F-015b.
- Notas: dominio canónico `snowboard-booking-platform.vercel.app` configurado por el owner en Vercel Project Settings → Domains. Alt domain `snowboard-booking-platform-9b1q.vercel.app` sigue activa; bloquea Google OAuth en prod porque `BETTER_AUTH_URL` apuntaba al alt (ver nota en F-016).

### F-015b — Post-deploy production smoke en CI

- Sprint: 0 · Estado: done · Prioridad: P0
- Depende de: F-015
- AC:
  - [x] `.github/workflows/post-deploy-smoke.yml` se dispara con el evento `deployment_status` filtrado a `state == 'success' && environment == 'Production'` (Vercel publica este evento tras cada deploy)
  - [x] Step de wait-and-poll contra `/api/auth/get-session` (30 intentos × 5s ≈ 2.5min) evita el race entre `deployment_status` y el primer hit servido por Vercel
  - [x] `npx playwright test e2e/smoke.spec.ts --project=chromium` corre contra `PLAYWRIGHT_BASE_URL=https://snowboard-booking-platform.vercel.app`
  - [x] Reenvía `VERCEL_AUTOMATION_BYPASS_SECRET` por si en algún momento se activa Deployment Protection sobre prod (hoy off; el header se ignora si no aplica)
  - [x] Concurrency group por environment con cancel-in-progress evita runs apilados si llegan varios deploys seguidos
- Tests: el propio workflow corre verde en el primer deploy a `main` tras este merge (validable en la pestaña Actions del repo).
- Notas: separado de F-013 (`CI`) porque allí corre contra `localhost:3000` en cada PR; este corre contra el dominio canónico tras cada merge. Si en Sprint 1 movemos preview-smoke a CI, se podrá unificar la lógica.

---

## Sprint 1.5 — Servicios externos que requieren URL pública

### F-016 — Añadir URL de Vercel al callback list de Google OAuth

- Sprint: 1.5 · Estado: done · Prioridad: P0
- Depende de: F-015
- AC:
  - [x] `BETTER_AUTH_URL` en Vercel Production scope = `https://snowboard-booking-platform.vercel.app` (validado: `POST /api/auth/sign-in/social {provider:"google"}` devuelve `redirect_uri=https://snowboard-booking-platform.vercel.app/api/auth/callback/google`)
  - [x] Callback canónico añadido en Google Cloud Console → OAuth 2.0 Client ID → "Authorized redirect URIs"
  - [x] `http://localhost:3000/api/auth/callback/google` permanece para dev local
  - [x] Login Google funciona en production (owner validó manualmente en Chrome: sign-in → consent → callback → sesión activa en `/en`)
- Tests: validación manual del owner. Cobertura automatizada en preview env queda como followup junto con la suite de F-034 cuando se extienda a preview (no estrictamente parte de este ticket).
- Notas: cerrado en la misma sesión que F-015, no en Sprint 1.5 — la fix era barata y desbloquea sign-up real del owner para probar el resto del producto. Diagnóstico inicial: `redirect_uri` apuntaba al alt domain `*-9b1q.vercel.app` porque `BETTER_AUTH_URL` no había sido actualizada al dominio canónico tras configurarlo en Vercel Domains.

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

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-004
- AC:
  - [x] Tablas `Instructor`, `AvailabilityBlock`, `Season`, `Booking`, `Attendee`, `AccountCredit`, `Tip` en `prisma/schema.prisma` (ver Architecture §4.2). 7 modelos de dominio + 4 de Better Auth + `_prisma_migrations` = 11 tablas verificadas en Neon `main`.
  - [x] Enums `Locale`, `Role`, `Duration`, `Level`, `BookingStatus`, `AvailabilityKind`, `CreditReason`, `CreditStatus` (ver Architecture §4.3)
  - [x] Migración `20260517111100_domain_schema` (204 líneas SQL) aplicada en Neon `dev` vía `prisma migrate dev` y promovida a Neon `main` vía `prisma migrate deploy`
  - [x] `npx @better-auth/cli generate` ejecutado (no-op estructural — los modelos auth ya estaban alineados; el CLI confirma que el schema casa con `lib/auth/`)
- Tests: `tests/prisma-schema.test.ts` con 4 specs Vitest cubren snapshot de modelos + enums, unicidad de `Booking.stripePaymentIntentId` + `Booking.icsUid`, y la convención `*Cents: Int` (ADR-004). `prisma validate` corre limpio.
- Notas: índices añadidos para queries que vendrán en F-022/F-023 — `AvailabilityBlock(instructorId, startDateTime)` + `(startDateTime, endDateTime)`, `Booking(instructorId, date)` + `(date, status)` + `(bookerId, status)`, `Season(active, startDate, endDate)`, `AccountCredit(userId, status)` + `(status, expiresAt)`, `Attendee(bookingId)`, `Tip(instructorId, paidAt)`. Tabla `WebhookEvent` (idempotencia Stripe, ADR-006) no aterriza aquí — entra con F-018/Sprint 2 cuando se construya el webhook handler.
- Decisiones de modelado revisadas en review post-commit inicial:
  - `Booking.bookerId` / `instructorId` con `onDelete: Restrict` explícito (preserva historial booking aunque el User o Instructor desaparezca — relevante para legal/audit).
  - `Booking` sin FK a `Season`: el booking-engine deriva la temporada activa desde `Booking.date` en query-time; una FK sería redundante y exigiría backfill si las fechas de temporada cambian.
  - `Attendee.isBooker` con partial unique index `Attendee_oneBookerPerBooking` (CREATE UNIQUE INDEX ... WHERE "isBooker" = true) en migración `20260517222119_attendee_booker_unique_and_restrict_fks` — el booker NO es siempre attendee (p. ej. padre que paga clase para hijos), por lo que el flag puede valer `false` para todos los attendees, pero como mucho uno puede ser `true`.
  - `Tip.requestEmailSentAt` NOT NULL: el row sólo existe cuando la clase ya terminó y el email post-clase con el CTA de tip se envió. Si en el futuro hay tipping in-person sin email, replantear (no bloquea MVP).
  - Comentarios `///` añadidos a `Season.anchorTimes` / `operatingHoursStart` / `operatingHoursEnd` y a `Attendee` para fijar formato `"HH:MM"` 24h y documentar invariantes.

### F-021 — Seed `prisma/seed.ts`

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-020
- AC:
  - [x] 1 user con roles `[student, instructor, admin]` (el owner — `franciscojgonzalezfernandez@gmail.com`, name "Javi", phone `+41 766381870`, locale `en`)
  - [x] 1 instructor enlazado al user, `acceptsSameDayIfBooked=false`, `calendarConnected=false`, idiomas `[en, de, es]`, 6 specialties (`beginner-friendly`, `freestyle`, `powder`, `race-carving`, `kids-4-12`, `special-needs`), bio real del owner
  - [x] 1 season `Season 26/27` activa, `2026-11-15 → 2027-04-30`, anchor times `["09:00","11:00","13:00","15:00"]`, operating hours `09:00 - 17:00`
  - [x] 56 `availabilityBlock` (8 semanas × 7 días, sin huecos) cubriendo desde `startDate`, cada uno con kind `AVAILABLE` y span `operatingHoursStart → operatingHoursEnd` del season
  - [x] `npx prisma db seed` corre limpio (validado dos veces consecutivas → mismos ids → idempotente). Aplicado en Neon `dev` y promovido a Neon `main`.
- Tests: `tests/seed.test.ts` con 6 specs Vitest leyendo `prisma/seed.ts` source — verifican counts (3 roles, 3 languages, 4 anchor times, 8 weeks), pattern idempotente (upsert/findFirst/deleteMany+createMany) y default `acceptsSameDayIfBooked=false`. La verificación con DB real queda para F-022 que decide la estrategia de test DB (branch Neon dedicada vs in-memory).
- Notas: añadido `tsx` (devDep) + bloque `prisma.seed = "tsx prisma/seed.ts"` en `package.json` + script `db:seed`. Bio cargada de transcript del owner (sesión F-021). Foto = `null` por ahora; Vercel Blob URL llegará cuando el owner suba imagen (Sprint 5 / D-LOGO).

### F-022 — `lib/booking-engine/` (algoritmo availability + Vitest 90%+)

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-021
- AC:
  - [x] Función `computeCalendar({duration, monthFrom, monthTo})` → `Array<{date, hasAvailability, instructorCount}>` (en `lib/booking-engine/calendar.ts`)
  - [x] Función `computeSlotsForDate({date, duration})` → `{date, anchorTimes: [{time, available, instructors[]}]}` (en `lib/booking-engine/slots.ts`). Cada instructor expone `{id, name, photo, specialties, languages: Locale[]}`. MVP usa `Locale[]` plano; la forma `[{code, level}]` del ejemplo en PRD §6.2 requiere persistir niveles por idioma (no en schema F-020) — followup si el owner pide más fidelidad
  - [x] Función `findNearbyDates({date, duration, window=14, min=3, max=5})` → 3-5 fechas (en `lib/booking-engine/nearby.ts`). Expansión simétrica desde el target; early-exit cuando se alcanzan `min` resultados pasando la mitad del window
  - [x] Buffer 10min entre clases consecutivas (constante `BUFFER_MINUTES = 10`); validado por specs específicos (5-min-before-existing rechaza; 60-min-gap acepta)
  - [x] 24h advance (`ADVANCE_MINUTES = 24 * 60`) + `acceptsSameDayIfBooked` (instructor con flag true y con ≥1 booking ya en el día acepta dentro de 24h; sin esos requisitos, rechaza)
  - [x] Coverage Vitest 99.34% stmts / 96.62% branches / 100% funcs / 100% lines en `lib/booking-engine/**` (70 tests, threshold 90% enforced en `vitest.config.ts`)
- Tests: Vitest exclusivo, sin HTTP. 9 archivos `*.test.ts` cubriendo time helpers, duration mapping, availability core, calendar, slots, nearby. Scenarios edge cubiertos: instructor saturado (todos los anchor times tomados), fecha pasada (`now > end`), fuera de season (antes de startDate / después de endDate), season inactiva, instructor inactivo, AvailabilityBlock vacío, BLOCKED overrides AVAILABLE, PENDING_PAYMENT bloquea slot, CANCELLED/PAYMENT_FAILED se ignoran, buffer collision 5 min, slot extiende más allá de operatingHoursEnd, slot exactamente 24h ahead, ranking de instructores por menor carga + id ascendente como tiebreak determinístico.
- Decisiones tomadas:
  - **No** Neon dedicada para unit tests del engine: las pruebas son sobre lógica pura con fixtures (no Prisma, no red). La branch Neon `playwright` queda reservada para E2E que sí necesiten DB real (decisión a aterrizar cuando Sprint 1 UI/API genere ese caso, no antes).
  - **No** filtro por idioma en el engine, alineado con PRD §6.1 CRO note y F-025 refactor. Language pasa a ser metadata del card de instructor en Step 3, no input del cálculo.
  - `BLOCKED` overlap gana sobre `AVAILABLE` cuando ambos coexisten — coherente con la semántica del modelo (BLOCKED es una excepción puntual sobre la AVAILABLE base).
  - `PENDING_PAYMENT` se trata como ocupación dura — el slot está locked mientras el PaymentIntent de Stripe vive. F-018/Sprint 2 confirmará el TTL.
  - `MAX_CALENDAR_DAYS = 100` cap defensivo para que un cliente malicioso/buggy no pida 5 años de calendario.

### F-023 — `GET /api/availability/calendar` + nearby fallback

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-022
- AC:
  - [x] Params `duration`, `monthFrom`, `monthTo` validados con Zod (`lib/schemas/availability.ts`). Cap defensivo `MAX_CALENDAR_RANGE_DAYS = 92` (≈3 meses) y refine `monthTo >= monthFrom`
  - [x] `app/api/availability/calendar/route.ts` llama `lib/booking-engine/computeCalendar` con context cargado vía `loadEngineContext(prisma, {from, to})`
  - [x] `app/api/availability/nearby?date&duration` → `lib/booking-engine/findNearbyDates` (3-5 fechas, ventana ±14 días por defecto)
  - [x] p95 < 500ms con seed de 1 instructor — engine es lógica pura sobre datos cargados en una sola Promise.all de 4 queries Prisma; carga típica observada en dev local con 1 instructor + 56 availability blocks: <50ms. Medición formal con autocannon queda como followup post-F-027 (suite Playwright/k6 contra preview)
- Tests: 6 Playwright API specs en `e2e/f-023-availability-calendar.spec.ts` (happy paths para calendar + nearby, rechazo de duration inválida, rechazo de rango invertido, rechazo de rango >92 días, rechazo de nearby sin duration) + 9 Vitest specs unitarios en `lib/schemas/availability.test.ts` para la capa de validación.
- Notas: `loadEngineContext` introducido en `lib/booking-engine/load-context.ts` — único punto que toca Prisma; engine sigue 100% puro. Window de carga ampliado ±1 día a cada lado para que la regla 24h + buffer 10min cerca de los bordes se evalúe contra bookings/blocks reales. `app/api/auth/...` no afectado: el matcher de `middleware.ts` ya excluye `/api/*`.

### F-024 — `GET /api/availability/slots`

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-022
- AC:
  - [x] Params `date`, `duration` validados con Zod (reusan `slotsQuerySchema` definido en F-023 `lib/schemas/availability.ts`)
  - [x] Response shape: `{date, anchorTimes: [{time, available, instructors: [{id, name, photo, specialties, languages}]}]}`. `languages` se entrega como `Locale[]` plano (MVP); la forma `[{code, level}]` del ejemplo en PRD §6.2 requiere persistir niveles por idioma — followup si el owner lo pide
  - [x] Anchor times respetan `operatingHoursEnd` — el engine descarta cualquier anchor cuyo `anchor + duration > operatingHoursEnd` (cubierto por `fitsWithinOperatingHours` en F-022 + spec Playwright FULL_DAY @ 15:00 → unavailable)
  - [x] "Cualquiera disponible" → `instructors[]` viene ordenado por menor carga del día y luego por id ascendente como tiebreak determinístico (round-robin estable). La selección de "cualquiera vs concreto" sucede en la UI sobre este orden
- Tests: 6 Playwright API specs en `e2e/f-024-availability-slots.spec.ts` (happy path 4 anchors, card carries id/name/languages/specialties, rechazos 400 para duration inválida + date malformada + params faltantes, anchor respect operatingHoursEnd con FULL_DAY) + cobertura unitaria del engine ya en F-022 (`computeSlotsForDate` 99% coverage).
- Notas: PR stacked en F-023. Reusa `loadEngineContext` + `parseSearchParams` + `zodErrorToResponse` + `slotsQuerySchema` introducidos en F-023 sin tocarlos; el único archivo nuevo de producto es `app/api/availability/slots/route.ts`.

### F-025 — UI Step 1 (filtro: duración)

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-003
- AC:
  - [x] Página `/[locale]/reservar` con RHF + Zod (`app/[locale]/reservar/page.tsx` + `step1-filters-form.tsx`)
  - [x] Select duración (4 opciones traducidas a horas vía `messages/{en,de,es}.json` namespace `reservar.step1.duration_*`, sin exponer enum)
  - [x] Botón "Continuar" navega a `/[locale]/reservar/step-2?duration=<ENUM>` (locale preservado por `@/i18n/navigation` router)
- Tests: `e2e/f-025-step1.spec.ts` con 9 specs (3 locales × labels traducidas + ausencia de selector de idioma + validación + navegación con duration en query param + preservación de locale DE). `npx playwright test e2e/f-025-step1.spec.ts --project=chromium` → 9 passed.
- Notas: el idioma del instructor **no** se pide aquí (decisión CRO: filtrar por idioma vacía el calendario cuando la oferta es fina; los clientes aceptan idioma secundario si se les expone al elegir instructor). El idioma se elige en Step 3 sobre la tarjeta del instructor, ver F-027 y PRD §6.2. Step-2 placeholder ya existe (renderiza `duration` desde search param) para que la navegación end-to-end del spec sea verificable antes de F-026.

### F-026 — UI Step 2 (smart calendar)

- Sprint: 1 · Estado: done · Prioridad: P0
- Depende de: F-023, F-025
- AC:
  - [x] Calendario mensual con días activos según `/api/availability/calendar` (`app/[locale]/reservar/step-2/page.tsx` SSR + `step2-calendar.tsx` cliente). Initial paint server-rendered via `loadEngineContext + computeCalendar` directos; navegación prev/next fetcha el endpoint HTTP. URL state: `?duration=<ENUM>&month=YYYY-MM`. Missing/invalid duration → redirect `/<locale>/reservar`.
  - [x] Click en día sin disponibilidad (no-past, in-grid) → fetch `/api/availability/nearby?duration=&date=` y muestra 1-5 fechas cercanas o empty state (`nearby-empty`). Click en día disponible → navega a `/<locale>/reservar/step-3?duration=&date=` (placeholder de step-3 añadido en este ticket; F-027 lo reemplazará)
  - [x] Loading state — `data-testid="step2-loading"` mientras el fetch está en vuelo (month nav o nearby); botones del calendario se disablan durante la carga
  - [x] Visual review con skill `impeccable` — ejecutado en la review de PR #41. Salida: aprobación condicional con un punch list. P1 aplicados en esta misma PR (mes en `uppercase` para que Archivo Black lea como display; `docs/design-system.md` §Radius relajada de "buttons only" → radius aplica también a cards/inputs/tabs, ver decision history en la propia sección). P2/P3 (placeholder copy de step-3, disabled-during-load opacity, past-day faint borders, hover-red-vs-ink en day cells, weekday headers a 11px) quedan como followup explícito — step-3 lo cubrirá F-027, el resto pasan a `simplify` pass antes de Sprint 2.
- Tests: `e2e/f-026-step2.spec.ts` con 9 specs (redirects sin/con duration inválida + render trilingüe con etiqueta de mes localizada + prev disabled en mes actual + click día no disponible muestra nearby-empty cuando estamos fuera de season + deep-link a `month=2026-11` lista días available y navega a step-3 conservando duration+date + nearby con 1-5 sugerencias para día quieto en season + nav next/prev actualiza label y URL). Suite chromium completa: 50 passed, 0 failed.
- Notas: `Duration` enum se valida en la page con `z.enum(Duration)`; el cliente recibe `duration: Duration` como prop (type-only) — sin acoplamiento Prisma en el bundle. `month` cap defensivo: prev disabled cuando `month <= todayMonth` (no permite ver meses pasados). Step-3 placeholder añadido en `app/[locale]/reservar/step-3/page.tsx` con testids `step3-duration` + `step3-date` para que el spec de F-026 verifique la transición; F-027 lo reescribirá.

### F-035 — Backend-driven durations (Season config → Step 1)

- Sprint: post-MVP · Estado: backlog · Prioridad: P2
- Depende de: F-022, F-025
- AC:
  - [ ] `Season` (o equivalente) expone las duraciones activas + sus labels traducidos como fuente de verdad — eliminar el hardcode en `app/[locale]/reservar/step1-filters-form.tsx` (`DURATIONS` + `DURATION_LABEL_KEYS`)
  - [ ] Endpoint o cache (p.ej. `GET /api/seasons/active` o bootstrap en `/api/availability/calendar`) sirve `Array<{ value: Duration, hours: number, labelKey: string }>`
  - [ ] El form Step 1 consume la lista del backend; añadir una nueva duración no requiere tocar código del cliente
  - [ ] Mapping `Duration → horas` (`ONE_HOUR=1h, TWO_HOURS=2h, INTENSIVE=4h, FULL_DAY=6h`) deja de duplicarse entre PRD/FEATURES y el bundle del cliente
- Tests: Vitest sobre el endpoint + Playwright que falsea la respuesta con un set extendido y verifica que el select renderiza las opciones nuevas sin recompilar.
- Notas: marcado P2 porque el set actual (4 duraciones) es estable y el coste de cambio es trivial. Ticket existe para no perder el seguimiento; ver `TODO(F-035)` en `step1-filters-form.tsx`.

### F-027 — UI Step 3 (anchor time + instructor + idioma de la clase)

- Sprint: 1 · Estado: backlog · Prioridad: P0
- Depende de: F-024, F-026
- AC:
  - [ ] Lista de anchor times con disponibilidad real
  - [ ] Por anchor: tarjeta de instructor(es) con foto, nombre y **perfil de idiomas** (primario + secundarios con nivel, p.ej. `EN native · DE fluent · ES basic`)
  - [ ] Opción "cualquiera disponible" preseleccionada (asigna por menor carga del día → round-robin; el idioma del instructor asignado se muestra al cliente antes de avanzar para que pueda cambiar de elección si no le sirve)
  - [ ] Selector de **idioma de la clase**: si el instructor seleccionado habla >1 idioma, mostrar pills con sus idiomas (default = primario); si habla 1, auto-asignar sin pedir input. Valor persiste en URL search params y luego en `Booking.language`
  - [ ] Botón "Continuar" navega a Step 4 (no implementado en este sprint — placeholder OK)
- Tests: Playwright E2E `e2e/f-027-step3.spec.ts` — flujo completo Steps 1→3, incluyendo: instructor con 1 idioma (sin selector), instructor con varios (pills visibles, default = primario), cambio de idioma persistido en URL.

---

## Sprint 0.5 — Home + Login visibles (pre-Sprint 1, repriorización)

> Pulled forward from Sprint 5 so the owner can manually validate sessions, locale routing, and brand direction before the booking engine work begins. One branch + PR per ticket per memory rule.

### F-028 — Reprioritize PRD §12 + FEATURES backlog

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-011
- AC:
  - [x] `docs/PRD.md` §12 incluye "Sprint 0.5" entre Sprint 0 y Sprint 1 cubriendo F-028..F-034
  - [x] `docs/PRD.md` §12 Sprint 5 actualiza para reflejar que home minimal + i18n scaffolding ya existen desde Sprint 0.5
  - [x] `docs/FEATURES.md` añade tickets F-028..F-034 con AC binarios
  - [x] PR mergeado a `main`
- Tests: N/A (docs only).
- Notas: rama `f-028-repriorize-docs`. No toca código.

### F-028b — Reset `app/globals.css` + drop Cormorant baseline

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-028
- AC:
  - [x] `app/globals.css` colapsado a baseline neutro: blanco/casi-negro, sin warm hue, sin chart palette. Nombres de variables shadcn preservados (background, foreground, primary, secondary, muted, accent, destructive, border, input, ring, popover, card, sidebar\*, chart-1..5, radius)
  - [x] `app/layout.tsx` elimina import de `Cormorant_Garamond` y la variable `--font-display` queda sin asignar (el override de F-030 reintroducirá lo que toque)
  - [x] `npm run build` corre limpio
  - [x] `/login` carga sin errores y los primitives shadcn renderizan (botón, input) — visual "feo pero funcional" es aceptable; F-030 viene después
- Tests: smoke Playwright existente sigue verde en `/`.
- Notas: rama `f-028b-reset-design-baseline`. Acto deliberado de borrado — no se reintroduce nada estético aquí.

### F-029 — Design exploration: 3 hi-fi mockups (huashu-design)

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-028b
- AC:
  - [x] `docs/design-exploration/variant-A/index.html`, `variant-B/index.html`, `variant-C/index.html` — cada uno cubre **home + login** del producto, con su propia paleta, tipografía, tono editorial. Greenfield (no anclar al placeholder warm-neutral previo)
  - [x] `docs/design-exploration/README.md` — tabla de 1 página: por variante, su filosofía (ej. Pentagram-editorial / Field.io alpine-motion / Kenya Hara Swiss-minimal o lo que proponga el advisor), paleta hex/oklch, type pairing, tono
  - [x] Owner elige una variante; el README anota la elección al final ("Chosen: Variant X — date")
- Tests: visual inspection en navegador.
- Notas: rama `f-029-design-exploration`. Usa skill `huashu-design` modo "design direction advisor". No toca `app/*` aún.

### F-030 — Design tokens + design-system.md (impeccable)

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-029
- AC:
  - [x] `app/globals.css` reescrito con tokens de la variante elegida (oklch values reales)
  - [x] `app/layout.tsx` reintroduce las fuentes de la variante elegida (display + body o lo que aplique), wired vía `next/font` y variables CSS
  - [x] `docs/design-system.md` — tabla concisa: paleta (token name + oklch + uso), type scale (display/h1..h4/body/small con sizes y line-heights), spacing scale, radius scale, motion tokens (durations/easings)
  - [x] `npm run build` corre limpio
  - [x] Visual review por skill `impeccable` antes de marcar done
- Tests: Playwright screenshot de `/login` y `/` confirma que tokens se aplican (no es regresión visual, es smoke).
- Notas: rama `f-030-design-tokens`. Usa skill `impeccable`.

### F-031 — `next-intl` scaffolding ([locale] + middleware + messages)

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-030
- AC:
  - [x] `npm i next-intl` instalado
  - [x] `i18n/routing.ts` con `defineRouting({ locales: ['en','de','es'], defaultLocale: 'en' })`
  - [x] `i18n/request.ts` con `getRequestConfig` cargando `messages/{locale}.json`
  - [x] `middleware.ts` en root con `createMiddleware(routing)`. Matcher excluye `/api/*` (crítico para better-auth catch-all), `/_next`, `/sentry-example-page`, `/api/sentry-example-api`, assets estáticos
  - [x] `next.config.ts` envuelve config con `withNextIntl(routing)` **antes** de `withSentryConfig`
  - [x] `messages/en.json`, `messages/de.json`, `messages/es.json` con namespaces vacíos (`home: {}`, `login: {}`, `nav: {}`) — F-032/F-033 los pueblan
  - [x] `app/[locale]/layout.tsx` creado con `<html lang={locale}>`, `NextIntlClientProvider`, `setRequestLocale(locale)`
  - [x] `app/layout.tsx` actualizado: elimina `<html lang="en">` y `<body>`-wrap (esos viven en `[locale]/layout`); mantiene Analytics + SpeedInsights
  - [x] Visitar `/` redirige a `/en` (default locale); `/de` y `/es` rinden con su `<html lang>` correcto
  - [x] `/api/auth/get-session` sigue respondiendo (verificación de matcher de middleware)
- Tests: Playwright API `/api/auth/get-session` devuelve 200; smoke en `/en`, `/de`, `/es`.
- Notas: rama `f-031-next-intl`. Mergeada en PR #15 (commit `27a635d`). No incluye UI nueva — solo plumbing.

### F-032 — Home page minimal × 3 locales

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-031
- AC:
  - [x] `app/[locale]/page.tsx` con hero (headline + sub-copy + CTA primario "Book a lesson" → `/${locale}/reservar` placeholder + secundario "Sign in" → `/${locale}/login`)
  - [x] `app/components/LanguageSwitcher.tsx` (client) usando `useLocale()` + `usePathname()` + `useRouter()` de `next-intl`; preserva path al cambiar locale
  - [x] Nav header con logo placeholder + `LanguageSwitcher` + "Sign in" link
  - [x] `messages/{en,de,es}.json` namespace `home` y `nav` poblados (headline, sub, CTAs)
  - [x] `app/page.tsx` (root) eliminado o reemplazado por redirect a default locale (next-intl middleware ya lo cubre; eliminar para evitar duplicación)
- Tests: Playwright E2E (cubierto por F-034) — cada locale renderiza copy correcto, switcher cambia URL+copy, CTAs llevan a path con locale.
- Notas: rama `f-032-home`. Mergeada en PR #16 (commit `eaa94df`). Variante visual elegida: Patagonia-editorial (Variant B de F-029). Imágenes: placeholders; D-LOGO sigue blocking para Sprint 5.

### F-033 — Move login to `app/[locale]/login/` + translate strings

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-031
- AC:
  - [x] `app/[locale]/login/page.tsx` (server component) con `auth.api.getSession({ headers: await headers() })`; si sesión, `redirect(\`/\${locale}\`)`; copy traducido (heading, sub, terms link)
  - [x] `app/[locale]/login/login-form.tsx` (client) usa `useTranslations('login')` para labels (email, password, name), tab labels (sign in / sign up), button copy (sign in / create account / continue with Google / email me a magic link), magic-sent confirmation, error fallback
  - [x] `callbackURL` de `signIn.social` y `signIn.magicLink` pasa a `/${locale}` (no `/`)
  - [x] `messages/{en,de,es}.json` namespace `login` poblado
  - [x] `app/login/page.tsx` y `app/login/login-form.tsx` eliminados
  - [x] Auth wiring intacto: `authClient.signIn.email`, `signUp.email`, `signIn.social({ provider: 'google' })`, `signIn.magicLink` sin cambios
  - [x] `middleware.ts` matcher actualizado: removida la exclusión `/login` (ya no existe ruta legacy fuera de `[locale]`)
- Tests: cubierto por F-034.
- Notas: rama `f-033-login-i18n`. Google OAuth callback (`/api/auth/callback/google`) en Google Cloud Console NO cambia — sigue sin locale prefix. `setRequestLocale(locale)` añadido al top de la page server-side para mantener el segmento estático (recomendación skill `booking-platform-perf`). Bundle First Load JS `/[locale]/login` = 374 kB total (113 kB de página + 258 kB shared) — auth client + RHF + Zod; aceptable porque /login no entra en el budget de home.

### F-034 — Playwright E2E: home + login × 3 locales

- Sprint: 0.5 · Estado: done · Prioridad: P0
- Depende de: F-032, F-033
- AC:
  - [x] `e2e/f-005-auth-google.spec.ts` actualizado: paths `/login` → `/en/login`; quick check en `/de/login` y `/es/login` renderiza los 3 métodos
  - [x] `e2e/f-032-home-locales.spec.ts` nuevo: `/`, `/en`, `/de`, `/es` rinden; H1 distinto por locale; language switcher rota EN→DE→ES; CTAs incluyen locale en href
  - [x] `e2e/f-033-login-locales.spec.ts` nuevo: labels traducidas por locale (match `messages/{locale}.json`); tab signin↔signup funciona; redirect-on-session va a `/${locale}` (no `/`)
  - [x] `npm run test:e2e` corre verde (20/20 chromium suites)
- Tests: las propias suites.
- Notas: rama `f-034-e2e-locales`. PR cierra Sprint 0.5.

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

- Home editorial completa (sections, instructor teaser, narrative) — la home **minimal** ya existe desde F-032 (Sprint 0.5); aquí se expande.
- Página de instructores + perfiles individuales.
- Página de precios.
- Blog MDX (2-3 posts iniciales).
- Estáticas: sobre, contacto, FAQ, T&C, privacidad.
- SEO completo: sitemap dinámico con hreflang, structured data Schema.org/LocalBusiness, OG images dinámicas, robots.txt.
- next-intl ya scaffolded en F-031 (Sprint 0.5); aquí se añaden **slugs traducidos** vía `pathnames` (`/es/iniciar-sesion`, `/de/anmelden`, etc.) y mensajes para el resto del producto.
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
