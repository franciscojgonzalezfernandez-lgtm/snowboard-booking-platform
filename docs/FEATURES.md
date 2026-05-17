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

- Sprint: 0 · Estado: review · Prioridad: P0
- Depende de: F-002, F-008
- AC:
  - [x] `.github/workflows/ci.yml` corre `lint`, `typecheck`, `test:unit`, `test:e2e` (smoke) en cada PR
  - [x] Cache de `node_modules` configurado (vía `actions/setup-node` con `cache: npm` + cache de browsers de Playwright)
  - [ ] Job falla bloquea merge (status check requerido por branch protection de F-001 — requiere marcar `CI / lint + typecheck + unit + e2e smoke` como required check en GitHub tras el primer run verde)
- Tests: el propio workflow verde.

### F-014 — Vercel: conectar repo + deploy previews

- Sprint: 0 · Estado: review · Prioridad: P0
- Depende de: F-013
- AC:
  - [x] Repo conectado a Vercel project (`prj_VJbAGNQAtfgmsAMldIFRvoH8RWvD`, scope `franciscojgonzalezfernandez-4774s-projects`)
  - [x] Preview deploy en cada PR (validado en PR #24: status `Vercel SUCCESS`, preview `snowboard-git-*.vercel.app`)
  - [x] Env vars dev configuradas (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_ID`, `GOOGLE_SECRET` validados en runtime: `/api/auth/get-session` → 200 con bypass header). Pendiente: `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (acción del owner antes de marcar `done`).
- Tests: PR de prueba dispara preview verde (PR #24 ✓).
- Notas: Vercel Deployment Protection mantenida en **Standard Protection** (Option B). Acceso automatizado vía Protection Bypass for Automation token; wiring de Playwright/CI en F-014b. Estrategia de DB para previews: por ahora compartida con Neon `main` branch (no per-PR). Migrar a Neon ↔ Vercel integration (branch-per-PR) cuando empiece F-022/F-025.

### F-014b — Vercel preview Protection Bypass wiring

- Sprint: 0 · Estado: review · Prioridad: P0
- Depende de: F-014
- AC:
  - [x] `playwright.config.ts` lee `VERCEL_AUTOMATION_BYPASS_SECRET` y, si existe, inyecta `x-vercel-protection-bypass` en `use.extraHTTPHeaders` (no-op si falta — local dev sigue funcionando)
  - [x] `.env.example` documenta `VERCEL_AUTOMATION_BYPASS_SECRET` con explicación de dónde se usa y cómo rotarlo
  - [x] `.github/workflows/ci.yml` reenvía `secrets.VERCEL_AUTOMATION_BYPASS_SECRET` al job env (forks reciben vacío → smoke contra localhost sigue verde)
  - [x] Repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` creado vía `gh secret set` (owner action; token rotable post-leak)
- Tests: smoke spec local (`/` → 200 contra `localhost:3000`, sin header) sigue verde. En Sprint 1, primer spec que apunte a preview confirmará el header.
- Notas: token compartido en chat → rotar tras merge (Vercel dashboard → Deployment Protection → Protection Bypass for Automation → Regenerate). Vercel auto-inyecta `VERCEL_AUTOMATION_BYPASS_SECRET` en su propio runtime/build env; GitHub Actions + local `.env.local` necesitan el var explícitamente.

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

- Sprint: 1.5 · Estado: backlog · Prioridad: P0
- Depende de: F-015
- AC:
  - [ ] `BETTER_AUTH_URL` en Vercel Production scope = `https://snowboard-booking-platform.vercel.app` (no el alt domain `*-9b1q.vercel.app`)
  - [ ] Callback `https://snowboard-booking-platform.vercel.app/api/auth/callback/google` añadido en Google Cloud Console (sección "Authorized redirect URIs" del OAuth 2.0 Client ID)
  - [ ] `http://localhost:3000/api/auth/callback/google` permanece para dev local
  - [ ] Login Google funciona en preview + production (sign-in flow termina con sesión activa, no `redirect_uri_mismatch`)
- Tests: Playwright E2E en preview env.
- Notas: diagnóstico realizado en sesión post-F-015 — `POST /api/auth/sign-in/social {provider:"google"}` contra prod devolvía `redirect_uri=https://snowboard-booking-platform-9b1q.vercel.app/...`. Root cause: `BETTER_AUTH_URL` apunta al alt domain. Pulled forward de Sprint 1.5 sólo si bloquea validación manual del owner; ya está priorizado P0 en su sprint.

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
