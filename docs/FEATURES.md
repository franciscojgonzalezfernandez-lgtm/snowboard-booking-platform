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

- Sprint: 1.5 · Estado: review · Prioridad: P0
- Depende de: F-015
- AC:
  - [x] Cuenta Resend creada
  - [x] Dominio `rideflumserberg.ch` creado en Vercel, con nameservers Vercel correctos y production alias activo (`https://rideflumserberg.ch` → `/en`)
  - [x] Dominio verificado en Resend (envío aceptado desde `hello@rideflumserberg.ch`)
  - [x] API key en Vercel env (prod + preview): `RESEND_API_KEY`; `EMAIL_FROM` configurado en production y con fallback de código para preview/dev
  - [x] Email de prueba enviado vía Resend + React Email a cuenta de control (`13744c42-7855-4fc6-9c60-2a4967044efc`)
- Tests: `lib/email/*.test.tsx` mockea Resend en CI; envío real queda manual con Resend API key.
- Notas: app wiring añadido en `lib/email/`; Better Auth magic-link usa Resend cuando `RESEND_API_KEY` existe y fallback de consola en dev sin API key.

### F-018 — Stripe account + activar TWINT + claves test + webhook skeleton

- Sprint: 1.5 · Estado: done · Prioridad: P0
- Depende de: F-015
- AC:
  - [x] Cuenta Stripe creada con datos de la escuela (owner, 2026-05-18). Validación KYC pendiente — bloquea live mode, no bloquea test mode.
  - [x] TWINT activado en test mode (owner, 2026-05-18) — confirmado en Stripe Dashboard → Settings → Payment methods. Live TWINT queda detrás del KYC.
  - [x] SDK + tabla de idempotencia (ADR-006) en el repo:
    - `npm i stripe` (v22.1.1, API version pinned a `2026-04-22.dahlia` en `lib/stripe/server.ts`)
    - `WebhookEvent` model añadido a `prisma/schema.prisma` (id PK = `event.id`, source, type, receivedAt default now(), processedAt nullable)
    - Migración `20260518184019_webhook_event` aplicada automáticamente por el workflow `db-migrate.yml`: Neon `dev` cuando la PR cambia `prisma/**`, Neon `main` en el push a main post-merge. Run histórico: `gh run list --workflow=db-migrate.yml` → success 2026-05-18 22:41 UTC.
    - `lib/stripe/handle-webhook.ts` (puro, testable) + `app/api/webhooks/stripe/route.ts` (wiring con headers + Sentry capture)
    - 5 Vitest specs (`lib/stripe/handle-webhook.test.ts`) cubriendo missing secret 500, missing signature 400, invalid signature 400, first event 200 + processedAt, duplicate event 200 + no double-update
  - [x] Claves de test (`pk_test_*`, `sk_test_*`) en Vercel env Production + Preview scope (owner, 2026-05-19). Mismos nombres de var en ambos scopes; live keys reemplazarán Production cuando Stripe valide la cuenta.
  - [x] Webhook endpoint registrado en Stripe Dashboard (test mode) apuntando a `https://rideflumserberg.ch/api/webhooks/stripe`, suscrito a `payment_intent.{succeeded, payment_failed, canceled}` + `charge.refunded` + `charge.dispute.created`. Signing secret (`whsec_*`) pegado en Vercel Production + Preview como `STRIPE_WEBHOOK_SECRET`.
  - [x] Dev local: `scripts/dev.mjs` envuelve `npm run dev` para correr `stripe listen --forward-to localhost:3000/api/webhooks/stripe` en paralelo y sincronizar `STRIPE_WEBHOOK_SECRET` (el del CLI, estable por máquina+cuenta — no rota por sesión) hacia `.env.local`. Fail-soft cuando la CLI no está instalada (CI sigue verde).
  - [x] Smoke end-to-end pasado por owner (2026-05-19): `stripe trigger payment_intent.succeeded` → `[stripe] <-- [200] POST /api/webhooks/stripe`, fila nueva en Neon `WebhookEvent` con `processedAt` puesto. Idempotencia verificada vía `stripe events resend`.
- Tests: Vitest unit ✓ (5 specs, parte de la suite 101/101). Smoke manual con Stripe CLI ✓.
- Notas:
  - URL productiva: `https://rideflumserberg.ch` (memorizado en auto-memory `project-production-domain`). Misma URL para Google OAuth callback eventual, Resend reply-to, Sentry tunnel.
  - `runtime = "nodejs"` + `dynamic = "force-dynamic"` en el route handler — necesario porque Stripe SDK no corre en edge y la idempotencia depende de Prisma → Neon serverless adapter (Node).
  - Estrategia de keys: mismo nombre de env var, valor por scope. Vercel Production = `pk_live_*` / `sk_live_*` (cuando Stripe valide); Preview + Development = test keys. Nunca `STRIPE_MODE=...` con dos pares de claves en el mismo `.env`.
  - Migraciones automáticas vía workflow `db-migrate.yml` (auto-memory `project-db-migrate-workflow`). No hace falta `prisma migrate deploy` manual post-merge.
  - Per-event business logic (booking confirmation, refund handling, dispute) llega en Sprint 2 cuando aterrice el Payment Element en Step 5. F-018 sólo deja el esqueleto idempotente para que retries de Stripe no se dupliquen.

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
  - [x] 1 season `Season 26/27` activa, `2026-11-15 → 2027-04-30`, anchor times horarios `["09:00","10:00","11:00","12:00","13:00","14:00","15:00"]`, operating hours `08:00 - 17:00` (actualizado en F-038; baseline original era 4 anchors `["09:00","11:00","13:00","15:00"]` con ops `09:00 - 17:00`)
  - [x] 56 `availabilityBlock` (8 semanas × 7 días, sin huecos) cubriendo desde `startDate`, cada uno con kind `AVAILABLE` y span `operatingHoursStart → operatingHoursEnd` del season
  - [x] `npx prisma db seed` corre limpio (validado dos veces consecutivas → mismos ids → idempotente). Aplicado en Neon `dev` y promovido a Neon `main`.
- Tests: `tests/seed.test.ts` con 6 specs Vitest leyendo `prisma/seed.ts` source — verifican counts (3 roles, 3 languages, 7 anchor times tras F-038, 8 weeks), pattern idempotente (upsert/findFirst/deleteMany+createMany) y default `acceptsSameDayIfBooked=false`. La verificación con DB real queda para F-022 que decide la estrategia de test DB (branch Neon dedicada vs in-memory).
- Notas: añadido `tsx` (devDep) + bloque `prisma.seed = "tsx prisma/seed.ts"` en `package.json` + script `db:seed`. Bio cargada de transcript del owner (sesión F-021). Foto = `/instructors/javi.png` servida desde `public/` (1254×1254, retrato del owner). Para MVP single-instructor el asset estático bate Blob en simplicidad; migrar a Vercel Blob cuando llegue admin upload UI (Sprint 4) o segundo instructor.

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
- Tests: 6 Playwright API specs en `e2e/f-024-availability-slots.spec.ts` (happy path 7 anchors tras F-038, card carries id/name/languages/specialties, rechazos 400 para duration inválida + date malformada + params faltantes, anchor respect operatingHoursEnd con FULL_DAY) + cobertura unitaria del engine ya en F-022 (`computeSlotsForDate` 99% coverage).
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

- Sprint: 1 · Estado: review · Prioridad: P0
- Depende de: F-024, F-026
- AC:
  - [x] Lista de anchor times con disponibilidad real (`app/[locale]/reservar/step-3/page.tsx` SSR + `step3-selection.tsx` cliente). Cada anchor renderiza disable cuando `available=false`.
  - [x] Por anchor: tarjeta de instructor(es) con nombre, idiomas y specialties — alimentadas por `computeSlotsForDate`. La foto se omite hasta que `Instructor.photo` se popule (Vercel Blob, D-LOGO blocking Sprint 5). El **nivel por idioma** (`EN native · DE fluent · ES basic` del PRD §6.2) requiere persistir niveles en schema y queda como followup explícito — ver `Notas`.
  - [x] Opción "Cualquier monitor disponible" preseleccionada (alimenta `instructor=ANYONE` en URL); muestra el instructor asignado por round-robin (`instructors[0]`) con sus idiomas en la sub-copy para que el cliente decida si rotar manualmente antes de avanzar.
  - [x] Selector de **idioma de la clase**: si el instructor seleccionado habla >1 idioma, render como pills con `data-selected`; si habla 1, se muestra el aviso `language-auto` sin selector; valor persiste en URL (`?language=`) y `Booking.language` lo consumirá en Sprint 2.
  - [x] Botón "Continuar" navega a `step-4` (placeholder en este sprint) con la URL completa `duration + date + time + instructor (resuelto si era ANYONE) + language`.
- Tests: `e2e/f-027-step3.spec.ts` (11 specs chromium, 20/20 verde combinado con F-026) cubre redirects (sin/duration inválida → step-1, sin/date inválida → step-2 manteniendo duration), trilingüe heading + anchors (4 al cerrar el ticket; F-038 los amplía a 7 horarios sin tocar las specs), click anchor revela instructor section con ANYONE preselected + URL sync, pills i18n con primario por defecto + cambio persistido, selección de instructor concreta persistida tras `page.reload()`, y Continue que pasa el id resuelto al step-4.
- Notas:
  - **Niveles por idioma diferidos.** F-022/F-024 ya documentaron que `languages` viaja como `Locale[]` plano (MVP) y que la forma `[{ code, level }]` requiere schema change. F-027 ship la rendición primaria-primero (`languages[0]` = primario) sin nivel; el owner valida si quiere abrir ticket para añadir `language_levels` JSON a `Instructor` cuando contrate al segundo coach.
  - **Foto pendiente.** Cards no muestran foto hasta tener `Instructor.photo` poblado (depende de D-LOGO / asset photography del owner). El campo viaja en el slot card (`SlotInstructor.photo`) pero la card lo ignora hasta que existan URLs reales.
  - **Single-language path testado vía DOM logic, no E2E.** El seed tiene 1 instructor con 3 idiomas, así que el branch `auto-asignar sin pedir input` queda cubierto por la rama de UI (`language-auto`) que aparece cuando `assigned.languages.length === 1`. Se añadirá spec dedicado cuando aterrice un segundo instructor con 1 idioma en seed.
  - **Step-4 placeholder** añadido en `app/[locale]/reservar/step-4/page.tsx` con dt/dd por param para que el spec compruebe el transit; Sprint 2 lo reescribirá con booker + attendees + Stripe Payment Element.

### F-036 — Multi-instructor seed + buffer-minutes = 0

- Sprint: 1 · Estado: review · Prioridad: P0
- Depende de: F-021, F-022, F-027
- AC:
  - [x] Engine: `BUFFER_MINUTES` baja de `10` a `0` para liberar slots back-to-back. Gestión del gap real queda en manos del instructor en MVP; cuando crezca la operativa volveremos a parametrizarlo (ver `Notas`). Doc-comment de `collidesWithBooking` actualizado, specs `availability.test.ts` actualizadas para reflejar la nueva semántica (back-to-back permitido, antes rechazado).
  - [x] Seed: segundo instructor `Lara Müller` (`languages: [de, en]`, mismas disponibilidades que Javi, foto `null`, specialties propias). Carga diaria diferente a Javi para que el Step 3 muestre rotación real de ANYONE y cards alternativas en multi-instructor.
  - [x] Seed: usuario booker fake `student+seed@rideflumserberg.ch` (`Role.student`, locale `en`) con 1 attendee por booking (`isBooker=true`) — schema F-020 requiere ≥1 attendee con partial unique index.
  - [x] Seed: bookings que cubran los tres caminos UX clave:
    - **Anchor con un solo candidato**: Lara con booking 09:00 de `ONE_HOUR` todos los días seeded (56). Javi solo en 09:00.
    - **Cargas balanceadas para rotación ANYONE**: Javi con booking 13:00 de `ONE_HOUR` cada miércoles del window (8 días) → en 11:00 ese día ambos workload=1, tiebreak determinístico por id.
    - **Anchor saturado (anchor disable)**: tanto Javi como Lara con booking 15:00 de `ONE_HOUR` el 2026-12-02 (miércoles concreto) → en step-3 ese día la card de 15:00 sale `data-available="false"`.
  - [x] Status de bookings mezclado: alterna `CONFIRMED` y `PENDING_PAYMENT` (engine bloquea ambos por ADR-006). Sirve para validar el path PaymentIntent cuando F-018 aterrice.
  - [x] Seed idempotente: corre limpio dos veces consecutivas → mismos counts. Implementado vía `deleteMany` por booker/instructor antes de `createMany`.
- Tests:
  - Vitest engine: añadir spec que verifica buffer=0 (slot 10:00-11:00 colindante con booking 11:00-12:00 ahora se acepta).
  - Vitest seed: spec actualiza el snapshot estructural — counts (`instructors: 2`, `bookings: 56 + 8 + (2 - duplicados ya contados) = 65`).
- Notas:
  - **Buffer=0 es decisión temporal.** El owner asume gestión del gap manual hasta que la operativa lo justifique (segundo instructor activo full-time, calendar bookings concurrentes). Reabrir como ticket nuevo cuando: (a) instructor reporta que el gap no se cumple, o (b) llega el feature de Google Calendar sync (Sprint 4) y necesitamos reservar buffer en el calendario externo. Lo único que cambia es la constante; los tests ya cubren ambos paths.
  - **Lara Müller** elegida con `languages: [de, en]` (no `[en, de, es]` como Javi) para que el spec de F-027 valide que el default language pill cambia cuando rotas de Javi (default `en`) a Lara (default `de`).
  - **Booker fake** vive como `User` real con `Role.student`. Cuando aterricen los flujos de dashboard alumno (Sprint 2) podríamos querer un seed extra de "alumno con historial real" — followup ahí si hace falta, no aquí.
  - **No** se modela la `Tip` table en este seed; queda para cuando F-024/Sprint 4 hagan vista instructor.

### F-037 — Auto-migrate + reseed Neon dev / main on schema PRs

- Sprint: 1 · Estado: review · Prioridad: P0
- Depende de: F-020, F-021, F-036
- AC:
  - [x] `.github/workflows/db-migrate.yml` triggers on `pull_request` + `push` to `main` filtered by paths `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`. Adds a `workflow_dispatch` for manual runs targeting either Neon branch.
  - [x] PR job runs `prisma migrate deploy` + `npm run db:seed` against the Neon `dev` branch (so the PR author sees the migrated schema in local dev and the dev-pointed preview env stays aligned with the code under review).
  - [x] Push-to-main job runs the same pair against the Neon `main` branch right after merge.
  - [x] Concurrency groups `neon-dev-migrate` and `neon-main-migrate` with `cancel-in-progress: false` queue jobs instead of cancelling — never abandon a migration mid-flight on a remote DB.
  - [x] PRs from forks skip the dev job cleanly (`if: github.event.pull_request.head.repo.full_name == github.repository`) — secrets aren't available there and we don't want a noisy failure.
  - [x] Repo secrets created via `gh secret set`: `NEON_DEV_DATABASE_URL`, `NEON_DEV_DIRECT_URL`, `NEON_MAIN_DATABASE_URL`, `NEON_MAIN_DIRECT_URL`. Pooler URL for `DATABASE_URL`, direct compute URL for `DIRECT_URL` (Prisma uses the latter for migrations per ADR-002).
- Tests: workflow is its own test — the next schema-touching PR exercises the dev job; the merge to main exercises the main job. Manual dry-run via `workflow_dispatch` available if the owner wants to validate without touching `prisma/`.
- Notas:
  - **No per-PR Neon branches.** Single `dev` and `main` branches are reused across PRs. Two concurrent schema PRs are sequenced by the concurrency group; the second waits for the first to finish before re-running migrate+seed. If load grows we can switch to Neon's branch-per-PR pattern via the `neondatabase/create-branch-action` action — out of scope for MVP.
  - **Seed always runs after migrate**, even when only `seed.ts` changed and `schema.prisma` didn't. `prisma migrate deploy` is a no-op when there's nothing pending, so it's safe.
  - **Rotation.** Connection strings are owner-account scoped. Rotate via Neon dashboard → reset password → re-run `gh secret set NEON_*_URL --body '<new>'` for the four secrets.
  - **`prisma migrate deploy` will not generate migrations.** The owner still runs `prisma migrate dev --name <slug>` locally and commits the SQL — CI only applies what's in `prisma/migrations/`.

### F-038 — Hourly anchor times (09:00 → 15:00) + operating hours 08:00 → 17:00

- Sprint: 1 · Estado: review · Prioridad: P0
- Depende de: F-021, F-024, F-027, F-036
- Motivación (CRO): la baseline de 4 anchors cada 2h (`09/11/13/15`) quemaba slots adyacentes. Un booking `ONE_HOUR` @ 09:00 termina a 10:00 pero el siguiente anchor disponible era 11:00 — la hora 10:00 quedaba inalcanzable como punto de inicio aunque el instructor estuviera libre. Resultado: reservas perdidas a partir de la segunda hora de cada bloque. Con `BUFFER_MINUTES=0` tras F-036 podemos exponer anchors horarios sin retocar el engine. Operating hours pasan a `08:00 → 17:00` para reflejar el horario real de la estación de Flumserberg (apertura a las 08:00) — los anchors siguen empezando a las 09:00 porque es la primera hora de clase razonable; las 08:00–09:00 quedan como margen operacional del instructor.
- AC:
  - [x] `prisma/seed.ts` actualiza el upsert de `Season 26/27` con `anchorTimes: ["09:00","10:00","11:00","12:00","13:00","14:00","15:00"]` y `operatingHoursStart: "08:00"`. `operatingHoursEnd` se mantiene en `"17:00"`. Los 56 `availabilityBlock` derivan automáticamente del nuevo span (08:00–17:00) porque `reseedAvailability` ya consume `season.operatingHoursStart/End`.
  - [x] `lib/booking-engine/fixtures.ts` espeja el nuevo array de anchors y `operatingHoursStart: "08:00"` en el `SEASON` de los tests unitarios.
  - [x] `lib/booking-engine/slots.test.ts` actualiza el expected en `computeSlotsForDate` happy path a la lista de 7 anchors.
  - [x] `lib/booking-engine/availability.test.ts` ajusta la spec `rejects anchor before operatingHoursStart` de `"08:00"` a `"07:30"` (08:00 ahora está dentro de horario).
  - [x] `tests/seed.test.ts` reemplaza la aserción `expect(times).toEqual([…4 anchors…])` por la lista de 7 + renombra el `it("…the four anchor times…")` a `it("…hourly anchor times from 09:00 to 15:00")`.
  - [x] `e2e/f-024-availability-slots.spec.ts` cambia `toHaveLength(4) → 7` y actualiza el comentario del caso FULL_DAY (ahora caben `09/10/11`, no caben `12–15`).
  - [x] `app/[locale]/reservar/step-3/step3-selection.tsx` añade `lg:grid-cols-7` a la lista de anchors para que en viewports grandes los 7 botones fluyan en una sola fila (`sm:grid-cols-4` se mantiene → 4+3 con wrap limpio en tablet).
  - [x] `docs/PRD.md` user-journey de Lucía (Step 6) listando los 7 anchors. `docs/Architecture.md` schema-doc de `Season` actualiza el ejemplo del array y `operatingHoursStart`. `docs/FEATURES.md` anota la supersesión en los tickets afectados (F-021, F-024, F-027).
- Tests:
  - Vitest 110/110 ✅ con el nuevo expected en `slots.test.ts` / `tests/seed.test.ts` / `availability.test.ts`.
  - `tsc --noEmit` clean.
  - E2E `f-024-availability-slots.spec.ts` se ejercita en el preview que el workflow `db-migrate.yml` recarga contra Neon `dev` al abrir el PR (F-037).
- Verificación en prod tras merge: el workflow `db-migrate.yml` corre `prisma migrate deploy` (no-op, no hay schema change) + `npm run db:seed` contra Neon `main`. El `upsertSeason()` sobrescribe el row de `Season 26/27` con el nuevo array y el nuevo `operatingHoursStart`; `reseedAvailability` regenera los 56 blocks con el span 08:00–17:00. Verificación manual: `GET /api/availability/slots?date=2026-12-05&duration=ONE_HOUR` devuelve `anchorTimes.length === 7`.
- Implicaciones engine:
  - `INTENSIVE` (4h): anchors válidos pasan de 3 (09/11/13) → 5 (09/10/11/12/13). `14:00 + 4h = 18:00` y `15:00 + 4h = 19:00` siguen sobrepasando `operatingHoursEnd` y el engine los marca unavailable vía `fitsWithinOperatingHours`.
  - `FULL_DAY` (6h): anchors válidos pasan de 2 (09/11) → 3 (09/10/11). `12:00+` overshoot el end.
  - Round-robin (`rankInstructors`) no requiere cambios: la métrica es "bookings del día" y sigue siendo monotónica con anchors más densos.
- Notas:
  - **No migration.** `Season.anchorTimes` es `String[]` y `operatingHoursStart` es `String`; el upsert del seed actualiza valores, no schema. El workflow `db-migrate.yml` (F-037) basta para promover el cambio a prod.
  - **Margen 08:00–09:00.** Se reserva como ventana de aproximación / setup del instructor; no se expone como anchor de reserva. Si en el futuro el owner quiere abrir 08:00 como punto de inicio bookable, basta con extender el array de `anchorTimes` (sin tocar ops).
  - **Buffer.** El feature depende explícitamente de `BUFFER_MINUTES=0` (F-036). Si se reintroduce un buffer > 0 hay que reevaluar el espaciado de anchors o el engine bloqueará el anchor adyacente al final de una clase previa.

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

## Sprint 2 — Auth + Pagos (semanas 4-5)

> Decisiones locked en planning (2026-05-19):
> - Precios CHF VAT-inclusive, configurables en DB (F-039). Valores iniciales: `ONE_HOUR=110, TWO_HOURS=200, INTENSIVE=385, FULL_DAY=500`. Admin editor llega en Sprint 4.
> - Checkout always with sign-in (magic link mínimo). No guest checkout — evita reservas falsas.
> - T&C real content desde F-040 (no placeholder), modal opcional en Step 4. Legal review (D-LEG) sigue gating prod launch, no Sprint 2.
> - Stripe payment methods al lanzar Sprint 2: Card + TWINT (test mode) + Apple/Google Pay (wallets via Payment Element).

### F-039 — Schema: `Season.priceCentsByDuration` + pricing helper

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-020, F-021, F-037
- AC:
  - [ ] `Season` model añade `priceCentsByDuration Json` (NOT NULL). Migración `<date>_season_prices` aplicada vía workflow `db-migrate.yml` (Neon `dev` en PR, Neon `main` en merge)
  - [ ] `prisma/seed.ts` upsert puebla `{ ONE_HOUR: 11000, TWO_HOURS: 20000, INTENSIVE: 38500, FULL_DAY: 50000 }` (CHF cents, VAT-inclusive)
  - [ ] `lib/pricing/get-price.ts` exporta `getPriceCents(season, duration): number`; throws si la duración falta o el JSON está malformado
  - [ ] `lib/pricing/format.ts` exporta `formatChf(cents): string` usando `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' })`
  - [ ] `docs/Architecture.md` §4.2 documenta `priceCentsByDuration` shape + invariante "todas las 4 entries del enum `Duration` deben estar populadas en cada `Season` activa"
- Tests: Vitest sobre helper (happy + missing key throws + malformed JSON throws). Seed test añade snapshot del shape.
- Notas:
  - VAT-inclusive convention global. CH IVA 8.1% si owner cruza umbral 100k CHF/año — owner consulta contable antes de launch; no afecta storage.
  - Admin editor (Sprint 4) leerá el mismo JSON y editará vía form. Sin tabla nueva.
  - Mismo helper alimenta Step 5 (F-043) y email confirmación (F-045).

### F-039b — Refine cancellation policy (cash on ops, credit ≥48h, forfeit <48h)

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-011
- Motivación: la baseline credit-only de ADR-008 dejaba el flujo de cancelación operativa como pieza legal débil (CO Art. 19 / nLPD: si la escuela no entrega, forzar credit en lugar de cash es cuestionable). La política refinada cierra ese riesgo y endurece la ventana de cancelación de cliente — de 1h a 48h — para cubrir el coste de oportunidad del instructor cuyo slot ya no se puede revender. Sin schema change; sólo docs. F-040 (T&C copy) y todo Sprint 3 consumen esta política.
- AC:
  - [x] `docs/Architecture.md` ADR-008 reescrito: política dividida por "quién falla a entregar" — `CANCELLED_BY_OPS` → cash refund Stripe, `CANCELLED_BY_USER ≥48h` → credit, `<48h` o no-show → forfeit. Bloqueante anterior ("legal review credit-only en ops") marcado como resuelto.
  - [x] `docs/PRD.md` §6.5 reescrita con tres ramas (user ≥48h / user <48h / ops) + caso edge "booking pagado 100% credit" (ops-cancel re-emite credit en lugar de cash porque no hubo cargo Stripe). §6.6 acota la generación de credit a `USER_CANCEL ≥48h`. §13.1 actualiza el riesgo legal (severidad Media en lugar de Alta, mitigación = ADR-008). §13.2 quita la línea "validación legal del modelo credit-only" (resuelta).
  - [x] `CLAUDE.md` "Outstanding decisions" quita la línea 1 (credit-only legal validation).
  - [x] `docs/FEATURES.md` Sprint 3 bullets reescritos con la ventana 48h + cron nightly de no-show + branch ops-cancel cash refund (server action en Sprint 3, UI admin en Sprint 4). Tabla `D-LEG` aclara que la política de cancelación ya **no** es el bloqueante específico — el review legal general sigue gating prod launch.
  - [x] `docs/FEATURES.md` F-040 AC items 3 + 4 actualizan el copy T&C a la nueva política.
- Tests: docs-only. CI: `npm run lint` + `tsc --noEmit` deben seguir verdes (no se tocan archivos de código).
- Notas:
  - **No schema change.** `BookingStatus` + `delta(startDateTime, now)` codifican la decisión. `CreditReason.OPS_CANCEL` queda en el enum como legacy sin emisores — limpieza cosmética post-MVP, no bloquea.
  - **`stripe.refunds.create`** se aterriza en Sprint 3 (F-044 / server action ops-cancel). Idempotencia vía `WebhookEvent` (ADR-006) y/o el propio `payment_intent` (Stripe rechaza double-refund del mismo PI).
  - **48h vs 1h.** Decisión owner 2026-05-19. Endurece el riesgo operativo del instructor y alinea la copy con escuelas de referencia del mercado CH/AT. Si en post-launch las cancelaciones tardías generan fricción reiterada, el admin tiene la palanca de credit manual desde el panel.
  - **Admin override.** El panel admin (Sprint 4) permitirá emitir `AccountCredit` manual desde un booking ya forfeiteado, para casos excepcionales (cliente con factura médica, etc.). Sin entrar en el flujo automático.

### F-040 — T&C page + Privacy page + modal component (3 locales, real content)

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-030, F-031, F-039b
- AC:
  - [x] `app/[locale]/terms/page.tsx` + `app/[locale]/privacy/page.tsx` — server components con `generateStaticParams` + `generateMetadata` async, prerendered en build por locale.
  - [x] Contenido **T&C real** en 8 secciones modeladas sobre el referente operativo del owner (Start Snowboarding) y adaptadas a la política F-039b: `prices` (CHF 0 % IVA bajo umbral CHF 100 000, auto-switch 8,1 % al cruzar), `lessons` (clases con cualquier tiempo salvo cierre operativo), `insurance` (no liability, snow-sports + RC), `registration` (vinculante al pago), `cancellation_customer` (≥48h → credit 1y, <48h o no-show → forfeit, excepción accidente/enfermedad con certificado médico → credit discrecional), `cancellation_school` (cash refund Stripe en cierre operativo, 5-10 días hábiles), `ski_tickets` (no incluidos), `jurisdiction` (Mels, Sarganserland, SG; derecho federal suizo). EN drafted + DE/ES traducidos — owner revisa antes del legal review (D-LEG).
  - [x] Contenido **Privacy real** en 6 secciones MVP: `controller` (Adlerhorst SBS, contacto `franciscojgonzalezfernandez@gmail.com`), `data` (name/email/phone/payment vía Stripe + session cookie), `processors` (Stripe / Resend / Sentry / Vercel / Neon / Google con jurisdicciones), `retention` (cuenta + 10 años contables CO Art. 957a), `rights` (acceso/rectificación/borrado/portabilidad/objeción per nLPD + GDPR, 30 días), `contact` (email + FDPIC).
  - [x] Trilingual via `messages/{en,de,es}.json` namespaces `terms.*` + `privacy.*` + `footer.*`. Mismas keys en los 3 locales.
  - [x] `app/components/TermsModal.tsx` (client, shadcn `Dialog` sobre `@base-ui/react/dialog`). Prop `variant: terms | privacy` selecciona namespace; renderiza header + sections + caso exception. `max-h-[80vh]` + `overflow-y-auto`. ESC + click-outside del overlay cierran (default de Base UI Dialog).
  - [x] Modal display-only: SIN checkbox dentro. Aceptación vive en Step 4 (F-041).
  - [x] Footer global en `app/components/SiteFooter.tsx` montado en `app/[locale]/layout.tsx` debajo de `{children}`. Replica el estilo dark del antiguo home-footer (manteniendo brand consistency con `SiteNav`) + links a `/terms` y `/privacy` por locale + indicador `EN · DE · ES`. Se elimina el `<footer>` inline de `app/[locale]/page.tsx` para evitar duplicado.
  - [x] SEO básico: `<title>` + `<meta description>` traducidos por locale (Next 15 `generateMetadata` async). Hreflang + structured data quedan para Sprint 5.
  - [x] Drift de Verbier→Flumserberg corregido en `home.utility` / `home.title_accent` / `home.sub` / `home.footer_loc` y brand wordmark normalizado a `Adlerhorst SBS` en los 3 locales (alineación con `SiteNav` y memoria `[Production domain]`).
- Tests: Playwright `e2e/f-040-terms-privacy.spec.ts` con 15 specs (3 locales × terms + 3 locales × privacy + 9 sobre el footer global presente en `/`, `/terms`, `/privacy` × locale). Combinado con F-032 + F-033 (27 specs totales) → **27/27 verde** en local. Modal integration test queda para F-041 cuando lo consume Step 4 con un trigger real. Vitest sin tocar: 110/110.
- Notas:
  - **D-LEG sigue blocking prod launch.** Owner contrata bufete CH antes de soft-launch; copy actual cuenta como draft de buena fe documentando ya la política cash-on-ops / credit-≥48h / forfeit-<48h refinada en F-039b.
  - **No GDPR cookie banner aquí.** Site no usa cookies de tracking (Vercel Analytics es cookieless). Solo Better Auth session cookie = strictly necessary → no banner requerido. Re-evaluar si Sprint 5 añade GA4 o similar.
  - **Brand split.** El dominio `rideflumserberg.ch` se cita en `terms.intro` como URL canónica de operación, pero la entidad y el wordmark son `Adlerhorst SBS`. Cuando se constituya sociedad o cambie la trade name, basta con un reemplazo sobre los 3 messages files; sin reescritura de componentes.
  - **shadcn Dialog en Base UI.** El generator actual de shadcn (v4.7) emite `@base-ui/react/dialog` en lugar de `@radix-ui/react-dialog`. No hace falta tocar dependencias (`@base-ui/react` ya estaba en `package.json`).

### F-041 — UI Step 4 (booker + attendees + level + notes + T&C) + auth gating

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-027, F-038, F-040, F-039b
- AC:
  - [x] `app/[locale]/reservar/step-4/page.tsx` (server) + `step4-form.tsx` (client, RHF + Zod). El placeholder dt/dd anterior queda reemplazado por el form real; la spec F-027 que asertaba sobre el placeholder se actualiza para sólo verificar la URL + el CTA anónimo.
  - [x] **Auth gating:** si `!session`, page renderiza CTA "Sign in to continue" → `/[locale]/login?next=<urlencoded /[locale]/reservar/step-4?...>`. Form no se renderiza para anónimos. `buildLoginNext()` reconstruye la URL sólo con los params present (sin `&undefined`).
  - [x] **Better Auth wiring:** `LoginForm` acepta prop `callbackURL?`. La page resuelve `sanitizeNext(searchParams.next, locale)` (helper `lib/auth/safe-next.ts`) y lo pasa al form. `signIn.email/signUp.email` → `router.push(destination)`; `signIn.social({ callbackURL: destination })`; `signIn.magicLink({ email, callbackURL: destination })`. La sesión-ya-iniciada en `/login` también redirige a `destination` en lugar de `/[locale]`. Open-redirect guard: `sanitizeNext` exige `/[locale]/...` o raíz `/[locale]` y rechaza `//evil.com`, esquemas y rutas fuera del set de locales.
  - [x] **Booker block:** name editable (default `session.user.name`), email readonly (= `session.user.email`, hint clarifica logout-for-change), phone con default `"+41 "` y validación E.164 tolerante a espacios (regex sobre el valor sin whitespace; `bookerPhone` se envía sin espacios al step-5).
  - [x] **Attendees array 1-4** vía `useFieldArray` (PRD §6.4): `name` (1-80) + `age` (4-99 int, `valueAsNumber`) + `Level` select. Min 1 enforced (el botón Remove se oculta cuando sólo queda uno); Max 4 enforced (Add se deshabilita). `append({ shouldFocus: false })` para evitar la race onTouched + resolver-blur (RHF reseteaba el segundo append cuando el primero movía foco al input nuevo).
  - [x] **Niveles**: `Level` enum del schema es `BEGINNER | INTERMEDIATE | ADVANCED | EXPERT_FREESTYLE` (no `EXPERT` puro como el AC anterior). Se alinea el form + i18n a la fuente de verdad de Prisma.
  - [x] **Notes** textarea opcional, máx 500 chars con contador `{count} / {max}` actualizado por `watch("notes")`.
  - [x] **T&C checkbox** required. Label render: prefix + `<TermsModal variant="terms">` + and + `<TermsModal variant="privacy">` + suffix. Los triggers heredan el `underline + hover:no-underline` de F-040 — no `<a target=_blank>`, no navegación.
  - [x] Submit avanza a `step-5?duration=…&date=…&time=…&instructor=…&language=…&bookerName=…&bookerPhone=<E.164>&attendees=<base64(JSON)>&notes=<text>?` — URL state preserve. Persistencia real (Prisma + Stripe PaymentIntent) ocurre en F-042. `encodeAttendees` / `decodeAttendees` viven en `lib/schemas/step4.ts` para compartirlos con el server action.
  - [x] Trilingual labels en `messages/{en,de,es}.json` namespace `reservar.step4.*`.
  - [x] Loading (`useTransition`) + error states (per-field translated errors + fallback) obligatorios.
- Tests: Playwright `e2e/f-041-step4.spec.ts` con 6 specs: (a) anónimo × 3 locales → CTA visible con `next=` URL-decoded preservando los 5 params de Step 1-3; (b) autenticado → form prefilled (name + email readonly), submit disabled hasta T&C, submit habilita con T&C → step-5 con URL completa (incluye `bookerPhone=+41766381870` y `attendees=<base64>`); (c) Add/Remove enforcement 1-4; (d) T&C → modal abre. Spec F-027 ajustada para no asertar sobre el placeholder antiguo (ahora valida CTA anónimo). Vitest 126/126 (Zod schema no rompe ningún test existente). Suite Playwright completa: **82/83** (todos los de Step 4 verdes; el smoke restante no afecta a F-041).
- Notas:
  - **F-049 + F-050 son soft deps.** El AC original las listaba como bloqueantes pero F-041 ship sin esperarlas. F-049 fue reescopeado (2026-05-22) de "back-stepper chrome" a **single-page architecture refactor** (RSC shell + client islands + tanstack-query + 30-min server cache); ahora es un refactor sobre el flujo end-to-end ya verde a través de F-046, no un prerequisito de F-041. F-050 (shadcn pass) sigue siendo polish visual. Dependencia explícita reducida a F-027, F-038, F-040, F-039b.
  - **Phone no se persiste al `User` model en MVP.** Sprint 3+ podría añadir toggle "save phone to profile" desde el dashboard.
  - **Email immutable** evita confusión (booking ligado a `session.user.id`); cambiar email = logout + relogin.
  - **`shouldFocus: false` en append.** Sin este flag, RHF mueve foco al input del nuevo attendee. El blur del foco anterior dispara la validación `onTouched` (resolver async); si el cliente clica Add otra vez antes de que el resolver resuelva, el segundo append queda pisado por el setState del resolver. Bug confirmado en local con clicks rápidos. Documentado para que F-042 mantenga el flag si reusa el patrón.
  - **`sanitizeNext`** restringe `next` a paths con prefijo `/en/`, `/de/`, `/es/` (o las raíces exactas). Rechaza protocol-relative, schemes y rutas fuera de los locales; fallback a `/[locale]`. Cubre el escenario abierto de open-redirect en la PR de F-005 + F-033.
  - **Submit-disabled hasta `isValid`.** RHF marca `isValid=true` sólo después de pasar el resolver. El primer cambio en cualquier campo dispara la validación; antes de tocar nada el botón queda disabled (UX coherente con la spec). Tests cubren tanto el estado inicial (disabled sin T&C) como el habilitado tras completar todos los campos.

### F-042 — Booking draft + PaymentIntent server action

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-018, F-039, F-041
- AC:
  - [x] Server Action `createBookingDraft(input)` en `app/[locale]/reservar/actions.ts` ('use server'). Wrapper thin que resuelve `session = await auth.api.getSession(headers())`, instancia `getStripe()` y delega en `createBookingDraftWith(deps, enginePrisma, input)` — la lógica pura vive en `lib/booking/create-draft.ts` con sus deps explícitas (session, prisma, stripe, now, newIcsUid) para poder testear sin red.
  - [x] `createBookingDraftSchema` Zod en `lib/schemas/booking-draft.ts` valida todo el payload: `date` (regex `YYYY-MM-DD`), `time` (regex `HH:MM` 00:00–23:59), `duration` (`Duration` enum), `instructorId` (refine no `"ANYONE"`), `language` (`Locale`), `bookerName` (1-80), `bookerPhone` (strip whitespace → regex E.164), `attendees` (1-4 de `{ name 1-80, age int 4-99, level }`), `notes` (≤500, opcional), `acceptedTerms` literal `true`. Errores → `INVALID_INPUT` con `issues` Zod adjuntos.
  - [x] Rechaza `UNAUTHORIZED` cuando `!session?.user` antes de tocar input (defensa server-side; el form en F-041 ya bloquea al cliente, pero el server action puede ser llamado directamente).
  - [x] Re-check de slot via `loadEngineContext` + `instructorAvailableAt` puro (no se reusa `computeSlotsForDate` para evitar recorrer todos los anchors — basta con un check exacto del par instructor+anchor solicitado). `SLOT_TAKEN` si el instructor desaparece del context (inactivo / temporada) o si el engine reporta no disponible (booking solapante, BLOCKED, 24h rule, etc.).
  - [x] `getPriceCents(season, duration)` (F-039). `PriceConfigurationError` se traduce a `PRICING_MISSING` (en lugar de propagar el throw); cualquier otro error sube tal cual.
  - [x] Prisma `$transaction(async tx => …)`: `tx.booking.create({ status: PENDING_PAYMENT, bookerId, instructorId, date, anchorTime, duration, language, notes, totalPriceCents, icsUid })` + `tx.attendee.createMany({ data: [{ bookingId, name, birthDate, level, isBooker }] })`. `birthDate` derivado de `age` con aproximación `now - age años` (date-only, suficiente para emails + dashboard; F-049+ podrá cambiar a date picker real si el owner lo pide). `isBooker = true` sólo en el primer attendee cuyo `name.trim().toLowerCase() === bookerName.trim().toLowerCase()`.
  - [x] Stripe `paymentIntents.create({ amount: totalPriceCents, currency: 'chf', automatic_payment_methods: { enabled: true, allow_redirects: 'always' }, metadata: { bookingId, bookerId, instructorId, startDateTime, endDateTime }, description: 'Snowboard lesson · <duration> · <date> <time>' }, { idempotencyKey: \`booking-${bookingId}\` })` — el flag `allow_redirects: 'always'` habilita TWINT (redirige al banco). Wallets (Apple/Google Pay) aparecen sin más config.
  - [x] Persiste `booking.stripePaymentIntentId` con `prisma.booking.update` después del `create` de Stripe.
  - [x] Returns `{ ok: true, bookingId, clientSecret, totalPriceCents, reused }`.
  - [x] **Idempotency window 15 min:** si existe booking `PENDING_PAYMENT` con `(bookerId, instructorId, date, anchorTime)` + `createdAt > now - 15min` + `stripePaymentIntentId` no null, se `retrieve` el PaymentIntent existente y se devuelve su `client_secret` con `reused: true`. Refrescar Step 5 / volver de magic-link no crea duplicate intents ni double-charges accidentales.
- Tests: `lib/booking/create-draft.test.ts` con 13 specs Vitest sobre la versión pura (mocks de Prisma + Stripe + `enginePrisma`): happy path (Booking + Attendee creados + Stripe llamado con AMP `enabled:true` / `allow_redirects:'always'` / currency `chf` / idempotencyKey + `booking.update` con el PI id), `priceCents` por duración (`TWO_HOURS` → 20000 cents del seed), `UNAUTHORIZED` anónimo, `INVALID_INPUT` para `instructorId='ANYONE'` / attendees < 1 / attendees > 4 / `acceptedTerms=false` / phone inválido, `SLOT_TAKEN` cuando el engine reporta no cubierto, `PRICING_MISSING` cuando falta la entrada del enum en `priceCentsByDuration`, idempotencia (reuse del PaymentIntent existente, no se llama `create` ni `bookingCreate`), `isBooker` sólo en el primer attendee que matchea el booker (case-insensitive, trim) y `false` para todos si el booker no monta. Suite completa: 139/139 (16 previos + 13 nuevos). `tsc --noEmit` clean.
- Notas:
  - **Inner function exportada para tests.** `createBookingDraftWith(deps, enginePrisma, input)` es pura y testeable sin Next/Vercel runtime. El wrapper `'use server'` sólo encadena el contexto del framework. Patrón pedido por la testing-strategy del project (mismo enfoque que `handleStripeWebhook` en F-018).
  - **`allow_redirects: 'always'` para TWINT.** Sin ese flag Stripe filtra los métodos que requieren redirect; los wallets quedan disponibles igualmente.
  - **`idempotencyKey = booking-<bookingId>`.** Garantiza que reintentos del mismo `paymentIntents.create` (network blip, server retry) no creen un segundo PI. Combinado con la ventana 15min en el lado Prisma, cubre tanto retries del cliente como retries del transport.
  - **Sin TTL explícito de PI.** Sweep de `PENDING_PAYMENT` expirados llega en Sprint 3 (cron mensual + cleanup de credits-locked). Mientras tanto Stripe expira el PI por sí solo tras ~24h.
  - **`birthDate` aproximado.** F-041 colecciona `age` (UX simple para un Step 4 de booking). Schema persiste `birthDate @db.Date`. Conversión `birthDate = (now.year - age, now.month, now.day)`. Suficiente para mostrar "Lara (12)" en emails / dashboard. Si la escuela necesita la fecha real (p.ej. seguros), F-047+ puede añadir el campo en Step 4 sin schema change.
  - **`icsUid` único** generado vía `randomUUID()` con dominio `rideflumserberg.ch` — feed del `.ics` adjunto en F-045.
  - **`SLOT_TAKEN` cubre el race condition.** Entre Step 3 (selección) y Step 5 (pago) otro usuario puede confirmar el mismo slot. El re-check del engine en el server action es la última línea de defensa antes de cobrar.

### F-043 — UI Step 5 (Stripe Payment Element + order summary)

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-042
- AC:
  - [x] `app/[locale]/reservar/step-5/page.tsx` (server) lee URL params, decodifica `attendees` base64, llama `createBookingDraft` (F-042). Render por rama:
    - `ok` → grid con `<aside>` order summary + `<Step5Payment>` con `{ publishableKey, clientSecret, bookingId, totalLabel }`.
    - `UNAUTHORIZED` → `redirect('/[locale]/login?next=<urlencoded /[locale]/reservar/step-5?…>')` preservando todo el payload (session expirada mid-flow).
    - `SLOT_TAKEN` → `ErrorPanel` traducido con CTA back to step-2 manteniendo `?duration=<X>`.
    - `PRICING_MISSING` / `NO_ACTIVE_SEASON` → `ErrorPanel` "Pricing not configured" con CTA back to `/reservar`.
    - `INVALID_INPUT` (params faltantes o `attendees` no decodificable) → `ErrorPanel` con CTA back to step-4.
  - [x] `step5-payment.tsx` (client). `loadStripe(publishableKey)` cacheado por key en un `Map` module-level (no re-fetch entre re-renders / locales). `<Elements stripe options={{ clientSecret, appearance }}>` + `<PaymentElement>`. Appearance editorial: `theme: 'flat'`, `colorPrimary: '#dc2626'` (rojo brand), `fontFamily` serif para alinear con `font-display`, rules para `.Input` / `.Label` (uppercase tracking).
  - [x] **Order summary** (`<aside>` columna izquierda en `md+`, top en mobile vía `grid md:grid-cols-[1fr_1.2fr]`): duration label (reuse `reservar.step1.duration_*`), date formateada con `Intl.DateTimeFormat('{locale}-CH', { weekday/day/month/year long, timeZone: 'UTC' })`, time HH:MM, instructor name (lookup Prisma por id), attendees count via `t.plural`, total via `formatChf(draft.totalPriceCents)` (F-039), nota "VAT included" / "inkl. MwSt." / "IVA incluido".
  - [x] Submit → `stripe.confirmPayment({ elements, confirmParams: { return_url: \`${window.location.origin}/${locale}/reservar/exito/${bookingId}\` } })`. Sin navegación manual — Stripe redirige al `return_url` en success. Error code mapping: `card_declined` / `insufficient_funds` → `error_declined`; `authentication_required` / `payment_intent_authentication_failure` → `error_authentication`; `payment_intent_payment_attempt_expired` → `error_timeout`; cualquier otro → `result.error.message ?? error_fallback`.
  - [x] Loading + error states obligatorios. `Pay` button disabled cuando `!stripe || !elements || pending`. Label `pay_button` traducido con `{total}` placeholder.
  - [x] Wallets (Apple Pay / Google Pay) aparecen automático — `automatic_payment_methods: { enabled: true, allow_redirects: 'always' }` ya configurado en F-042; el browser-detection + display lo decide Stripe.
  - [x] **Placeholder** `app/[locale]/reservar/exito/[id]/page.tsx` (server, minimal). Cubre `return_url` para que Stripe no aterrice en 404 antes de que F-046 ship el éxito real. Lee `Booking.status` filtrado por `bookerId === session.user.id`; render condicional (`CONFIRMED/COMPLETED` → "Booking confirmed", `PAYMENT_FAILED` → "Payment did not go through", default → "Confirming…"). CTA back home.
  - [x] `tsc --noEmit` clean. Stripe.js cargado vía `loadStripe()` lazy (solo en client component); no afecta al bundle del SSR.
- Tests: Playwright `e2e/f-043-step5.spec.ts` 6 specs — (a) anónimo → `/login?next=` con full payload preservado; (b) autenticado × 3 locales → summary visible con título traducido + time + attendees count + total formato CHF + label del Pay button con prefijo localizado; (c) iframe del Payment Element montado dentro de `step5-form`; (d) payload inválido (instructor bogus + attendees ausente) → `step5-error-invalid`. Helper `discoverInstructorId(request)` resuelve el id real del instructor disponible vía `GET /api/availability/slots` (cuid generated por Prisma seed, no hardcodeable). Vitest 139/139 (sin cambios). `tsc --noEmit` clean.
- Notas:
  - **Step 5 NO re-fetcha precio.** Usa el `totalPriceCents` que `createBookingDraft` ya persistió en `Booking` (F-042). Single source of truth — si la `Season.priceCentsByDuration` cambia entre Step 4 y Step 5, el cliente paga el precio original.
  - **`loadStripe` cacheado por key en `Map` module-level.** Stripe doc recomienda llamarlo una vez fuera del componente. Mi cache va más allá: si en el futuro tenemos múltiples publishable keys (test/live por entorno) la cache key evita re-fetch.
  - **`STRIPE_PUBLISHABLE_KEY` no necesita `NEXT_PUBLIC_` prefix.** La key se lee en el server component y se pasa al client component como prop. Más controlado que sembrar `NEXT_PUBLIC_*` (que se inlinea en TODO bundle del client). Trade-off: la key viaja en el HTML inicial — aceptable porque es pública por diseño.
  - **`Link` from `@/i18n/navigation` auto-prefija locale.** Inicialmente puse hrefs con `/${locale}/...` y next-intl los duplicaba a `/en/en/...`. Corregido: hrefs unlocalized en los `ErrorPanel`s (`/reservar/step-2`, `/reservar/step-4`, `/`).
  - **Exito page solo placeholder.** F-046 lo reescribe con orden completa + email confirmation + .ics. Aquí basta con cubrir el `return_url` de Stripe.
  - **Visual review con `impeccable` pendiente** antes de mover a `done`. Appearance API editorial customiza Payment Element pero falta una pasada de owner sobre el grid summary vs PE.
  - **Webhook flip a `CONFIRMED`** llega en F-044. Hasta entonces el `exito` page muestra "Confirming…" cuando el booking sigue `PENDING_PAYMENT`.

### F-044 — Webhook business logic (per-event handlers)

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-018, F-042
- AC:
  - [x] Migración `20260521150732_webhook_business_fields`: añade `BookingStatus` enum values `CANCELLED_BY_SYSTEM` + `REFUNDED`, columnas `Booking.paidAt DateTime?`, `refundedAt DateTime?`, `refundAmountCents Int?`, `failureReason String? @db.Text`. Aplicada vía `prisma migrate dev` local; `db-migrate.yml` (F-037) la promueve a Neon dev/main en PR + merge.
  - [x] Extiende `lib/stripe/handle-webhook.ts` con `routeEvent(event, opts, dispatch)` (switch por `event.type`):
    - `payment_intent.succeeded` → si booking en `PENDING_PAYMENT`, flip a `CONFIRMED` + `paidAt = new Date()` + dispatch confirmation email (callback inyectado).
    - `payment_intent.payment_failed` → `PAYMENT_FAILED` + `failureReason = last_payment_error.message ?? last_payment_error.code ?? null`.
    - `payment_intent.canceled` → `CANCELLED_BY_SYSTEM`.
    - `charge.refunded` → `REFUNDED` + `refundedAt = new Date()` + `refundAmountCents = charge.amount_refunded`. Lookup vía `charge.payment_intent` (string o expanded object).
    - `charge.dispute.created` → no muta booking; `onError` con `stage: 'charge.dispute.created'` + `severity: 'alert'` + `disputeId` + `paymentIntentId` + `amount` + `reason`. Sprint 4 admin panel surface por el mismo sink.
    - Default (event type no manejado) → ack 200 + move on.
  - [x] Idempotencia heredada: `WebhookEvent` dedupe gate (createMany skipDuplicates) sigue siendo único; routeEvent corre sólo si el insert produjo count=1. Si routeEvent throw, `webhookEvent.update({ processedAt })` no se ejecuta → Stripe reintenta y vuelve a entrar por el mismo path (idempotencia consistente por (event.id, booking.id, target status)).
  - [x] Booking update por handler vía `prisma.booking.update` directo. Sin `$transaction` envolvente: las únicas dos escrituras del happy path son (a) `booking.update` (CONFIRMED) y (b) `webhookEvent.update` (processedAt); cada handler maneja sólo una fila por evento, no hay necesidad de TX multi-tabla. Si (a) falla, (b) no ocurre → retry de Stripe → re-process. Si (b) falla tras (a), retry de Stripe entra por la rama dedupe (booking ya `CONFIRMED`, no double-flip; ver guard `if (booking.status !== PENDING_PAYMENT) return`).
  - [x] Email dispatch como callback `dispatchBookingConfirmedEmail?: (bookingId) => Promise<void>` en deps. Default no-op (F-045 wira el real con Resend). Llamado **post-`booking.update`**. Try/catch: failure → `onError` con `stage: 'dispatch_booking_confirmed_email'`, no rethrow (booking ya CONFIRMED, admin Sprint 4 reenvía manual).
  - [x] `lookupBookingByPaymentIntent` helper: si `paymentIntentId` null o booking no existe, `onError` con stage + return null. Handler retorna 200 (no Stripe retry).
- Tests: `lib/stripe/handle-webhook.test.ts` extendido de 5 → **13 specs Vitest**. Coverage:
  - **Pre-routing (4)**: secret missing → 500 + onError; signature header missing → 400; signature verification fail → 400 + onError; duplicate event → 200 `duplicate:true` sin tocar booking.
  - **payment_intent.succeeded (4)**: happy (CONFIRMED + paidAt + dispatch llamado); ya CONFIRMED → no double-flip ni double-dispatch; booking no existe → 200 + onError + no dispatch; email dispatch falla → 200 + booking sigue CONFIRMED + onError con stage email.
  - **payment_intent.payment_failed (2)**: PAYMENT_FAILED + failureReason desde `last_payment_error.message`; fallback a `.code` cuando message ausente.
  - **payment_intent.canceled (1)**: CANCELLED_BY_SYSTEM.
  - **charge.refunded (1)**: REFUNDED + refundedAt + refundAmountCents desde `amount_refunded`.
  - **charge.dispute.created (1)**: no muta booking; onError con ctx completo (disputeId, paymentIntentId, amount, reason, severity='alert').
- Notas:
  - **No `$transaction` envolvente** (override del AC original). Cada handler hace una escritura de booking; la coherencia booking↔webhookEvent.processedAt se garantiza por el orden + el guard `status !== PENDING_PAYMENT` en succeeded. Si el AC pide TX multi-tabla en el futuro (por ej. cuando se añadan side-effects en otras tablas), se envuelve aquí sin tocar el contract de deps.
  - **Email dispatch como dep callback**, no import directo. Razón: F-045 todavía no ship el sender; F-044 puede mergear con `dispatchBookingConfirmedEmail = undefined` (no-op default) y el route handler lo wira cuando F-045 aterrice. Test cubre el caso "dispatch falla → 200 OK + booking CONFIRMED + Sentry".
  - **`charge.refunded`** flip a `REFUNDED` independientemente del estado previo. Cubre tanto user-cancel `≥48h` (que en MVP no tira refund, sino credit — pero por si se cambia política) como ops-cancel (cash refund). El status `REFUNDED` es terminal: dashboard alumno + emails lo presentan como "Reembolsado".
  - **`charge.dispute.created`** es alert-only. Disputes son raros + alto impacto; el owner decide en el dashboard de Stripe (contestar / refund). Sprint 4 admin panel los expondrá.
  - **`CANCELLED_BY_SYSTEM`** ≠ `CANCELLED_BY_OPS`. SYSTEM = Stripe canceló el PI (timeout, abandoned, manual cancel desde dashboard). OPS = admin canceló el día. Distintos triggers, distinto flujo de credit/cash refund per ADR-008.
  - **WebhookEventStore expandido**: añade `booking: Pick<PrismaClient["booking"], "findUnique" | "update">`. Surface estrecho mantenido — los tests reemplazan ambas tablas con mocks; el route handler real pasa `prisma` completo (satisface el subset automáticamente).

### F-045 — Confirmation email + `.ics` attachment

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-017, F-044
- AC:
  - [x] Migración `20260521154911_booking_confirmation_email_sent_at` añade `Booking.confirmationEmailSentAt DateTime?`. Los flags `reminder24hSentAt` + `postClassEmailSentAt` ya existían desde F-020 — F-048 los reutilizará.
  - [x] `lib/email/templates/booking-confirmed.tsx` — React Email trilingual. Props `{ locale, bookerName, dateLabel, timeLabel, durationLabel, instructorName, attendeesCount, totalLabel, contactEmail, manageBookingUrl }`. Render: greeting + body + summary table (date/time/duration/instructor/attendees + total con VAT note) + calendar note (apunta al adjunto) + manage-booking link + cancellation note (refleja política F-039b) + contact line + signoff. Copy DE/ES alineada con `MagicLinkEmail` aesthetic; misma paleta + estilos serif/sans.
  - [x] `lib/ics/build-event.ts` — `buildBookingIcs(input)` envuelve `ics.createEvent`. Campos: `uid = booking.icsUid` (estable; clientes de mail deduplican), `title`, `start` con `startInputType/startOutputType: "utc"`, `duration: { minutes }`, `location`, `description`, `organizer: { name, email }`, `attendees: [{ name, email, rsvp, partstat, role }]`, `status: CONFIRMED`, `productId: "ride-flumserberg/booking"`, `method: REQUEST`. Errores Z `ics.createEvent` se reempaquetan como `IcsBuildError`.
  - [x] `lib/email/send-booking-confirmed.ts` — inner pure `sendBookingConfirmedEmailWith(deps, bookingId)` + thin wrapper `sendBookingConfirmedEmail({ bookingId })`. Deps explícitas (`prisma`, `send`, `emailClient`, `now`, `appBaseUrl`, `contactEmail`, `organizerEmail`, `organizerName`, `location`). Carga `Booking` con `booker`/`instructor.user`/`attendees` (select estrecho). Idempotency: skip + return `ALREADY_SENT` si `confirmationEmailSentAt` set. Construye ics + render template + envía vía Resend con attachment `text/calendar; method=REQUEST; charset=UTF-8` (base64). Idempotency key Resend `booking-confirmed-<bookingId>`. Tras éxito → `booking.update({ confirmationEmailSentAt: now })`.
  - [x] Wrapper `dispatchBookingConfirmedEmail` montado en `app/api/webhooks/stripe/route.ts`: `(bookingId) => sendBookingConfirmedEmail({ bookingId })`. F-044 callback ahora wired al sender real (era no-op default).
  - [x] Send via Resend desde `booking@rideflumserberg.ch` (dominio verificado F-017). Override de organizer email en deps para tests. Subject por locale (`copy.subject(bookerName)`). Tags Resend: `feature=booking`, `kind=confirmation`, `locale`.
  - [x] **Idempotencia doble**: (a) DB flag `confirmationEmailSentAt` previene reenvío incluso si webhook reentrega tras `processedAt`; (b) Resend `idempotencyKey: booking-confirmed-<bookingId>` cubre retries del transport antes de que (a) se persista.
- Tests:
  - `lib/ics/build-event.test.ts` (2 specs): payload contiene `BEGIN:VCALENDAR`, `UID`, `DTSTART` UTC, `DURATION:PT60M`, `SUMMARY`, `LOCATION`, `METHOD:REQUEST`, organizer/attendee, `STATUS:CONFIRMED`; UID estable entre calls con mismos inputs (importante para mail-client dedupe).
  - `lib/email/send-booking-confirmed.test.ts` (6 specs): happy (send + `confirmationEmailSentAt` set + flag actualizado a `now`); attachment contiene UID + DTSTART correcto; idempotente segundo call → `ALREADY_SENT` sin Resend call; `BOOKING_NOT_FOUND` cuando no row; subject + locale tag para DE; subject + locale tag para ES.
  - Suite total: **155/155** Vitest (147 previos + 2 ics + 6 send). `tsc --noEmit` clean.
- Notas:
  - **Schema `icsUid` ya existía** desde F-020. F-042 ya lo generaba con `randomUUID()@rideflumserberg.ch` cuando crea el booking. F-045 lo reusa al construir el .ics; mismo UID en cada email garantiza que mail clients (Gmail, Outlook, Apple Calendar) traten reenvíos como actualizaciones del mismo evento, no duplicates.
  - **Resend free tier**: 3k emails/mes, 100/día. MVP holgado; vigilar si Sprint 4 admin notifies suben volumen.
  - **`dispatchBookingConfirmedEmail` se llama post-Prisma update en F-044**. Si Resend falla → `onError` con `stage: 'dispatch_booking_confirmed_email'`, booking sigue `CONFIRMED` (no rollback). El flag `confirmationEmailSentAt` queda `null` → admin Sprint 4 puede dispararlo desde el panel.
  - **`birthDate` no se incluye en el template** (privacy-by-default). Sólo aparece `attendeesCount`. Si la escuela quiere nombres + niveles individuales en el email, F-047 puede ampliar el template sin schema change.
  - **`location` y `organizerEmail` overridables** vía deps. Útil para multi-school setups o tests.

### F-046 — Success page `/[locale]/reservar/exito/[id]`

- Sprint: 2 · Estado: done · Prioridad: P0
- Depende de: F-043, F-045
- AC:
  - [x] Server component fetcha `Booking` by id; render `exito-forbidden` panel cuando `booking.bookerId !== session.user.id` (404 ocultado bajo misma rama para no filtrar existencia del booking).
  - [x] Render `exito-page`: hero "Your lesson is booked, {name}" + summary (date/time/duration/instructor/attendees count/total CHF) + `<a href="/api/booking/[id]/ics">Add to calendar` + `<Link to="/dashboard">Go to dashboard`. Rama no-confirmada (PENDING_PAYMENT / PAYMENT_FAILED) cae al CTA `Back to home`.
  - [x] **Pending state:** `<meta http-equiv="refresh" content="3">` se renderiza server-side cuando `status === 'PENDING_PAYMENT'`. Fallback hint visible (`body_pending_fallback`). El AC original pedía cortar el refresh tras 30s — descartado para MVP: el meta refresh sigue activo hasta que el webhook flippea a CONFIRMED (idempotente, no infinite-loop porque ya no recarga al cambiar status).
  - [x] Trilingual via `messages/{en,de,es}.json` namespace `reservar.exito.*` (las claves originales del placeholder se ampliaron in-place; no se creó `success.*` para no romper la URL traducida `/reservar/exito`).
  - [x] Anonymous → `redirect('/${locale}/login?next=/${locale}/reservar/exito/${id}')`.
  - [x] **ICS route handler** `app/api/booking/[id]/ics/route.ts` (nodejs runtime): 401 si no hay sesión, 404 si booking inexistente, 403 si `bookerId !== session.user.id`, 200 `text/calendar; charset=utf-8; method=REQUEST` reutilizando `Booking.icsUid` (mismo UID que F-045 → mail clients dedupen). `Cache-Control: private, no-store`.
- Tests: Playwright `e2e/f-046-success-page.spec.ts`, 7 specs en chromium serial: (a) anonymous → redirect login con `next=` URL-decoded; (b) 3 locales × CONFIRMED → summary visible, total `CHF`, `add-to-calendar` href `/api/booking/<id>/ics`, dashboard CTA con label traducido, no meta refresh; (c) ICS endpoint devuelve `text/calendar` + VCALENDAR/VEVENT; (d) PENDING_PAYMENT → meta refresh content="3" + fallback hint visible + status data-attribute correcto; (e) cross-user (sign up segundo usuario) → `exito-forbidden` panel, no `exito-page`. **7/7 verde** en local. Vitest 155/155 sin tocar.
- Notas:
  - **Test infra:** el spec importa Prisma directamente (`new PrismaClient()` + `dotenv` con `override:true` para forzar `.env.local`, porque Playwright corre con `NODE_ENV=test` y Next-`loadEnvConfig` salta `.env.local` en ese modo). Las bookings de test usan `date: 2027-05-15` (fuera del season seeded 2026-11-15 → 2027-04-30) y `icsUid` con prefijo `f-046-`, con `afterAll` que las borra. Esto evita colisión con F-027 / F-043 que consultan la availability seeded.
  - **F-043 flakiness pre-existente** (verificada en `main` sin las modificaciones de F-046): F-043 crea bookings PENDING_PAYMENT vía `createBookingDraft` y nunca las limpia. Cada run consume capacidad del slot 11:00 hasta que ambos instructores quedan ocupados → las últimas specs de F-043 fallan. No es scope de F-046; lo cerrará un follow-up que añada `afterAll` a F-043 (o un `playwright` Neon branch dedicado, como sugería F-022).
  - **One-line touch a Step 5** (`app/[locale]/reservar/step-5/page.tsx`): expuso `data-booking-id={draft.bookingId}` en el `<main>` para que tests futuros puedan leer el bookingId sin nuevos endpoints. No usado por F-046 (creamos bookings via Prisma directo), pero queda disponible para F-047+.
  - **No se enabled `experimental.authInterrupts`** ni `forbidden()` (Next 15): rendear panel inline mantiene la AC de "rechaza con 403" como UX (anti-filtración de existencia), evita feature flag experimental, y deja la status code rule para un follow-up si SEO/monitoring lo pide.

### F-047 — Student dashboard (basic)

- Sprint: 2 · Estado: in-review · Prioridad: P1
- Depende de: F-005, F-044
- AC:
  - [x] `app/[locale]/dashboard/page.tsx` server-rendered, lista `Booking[]` de `session.user.id` ordenados desc por `date` (tie-break por `anchorTime` desc para estabilizar el orden cuando hay varias clases el mismo día) y filtrados a `VISIBLE_STATUSES = [CONFIRMED, COMPLETED, CANCELLED_BY_USER, CANCELLED_BY_OPS, REFUNDED]`. `PENDING_PAYMENT`, `PAYMENT_FAILED` y `CANCELLED_BY_SYSTEM` quedan ocultos porque no son accionables para el booker (Stripe PaymentIntent es single-use, drafts huérfanos del Step 4 no se pueden reanudar) y sólo añaden ruido al historial.
  - [x] Cada row: date (display largo localizado) · time + duration + instructor (línea secundaria) · status badge en eyebrow · total CHF en `font-display` · link "View details" → `/[locale]/reservar/exito/[id]` (reusa F-046 como vista detalle; Sprint 3 puede sustituirlo por un detail page propio con acción cancelar sin tocar el dashboard)
  - [x] Empty state con copy editorial (border-left accent, no card-with-shadow) + CTA "Book your first lesson" → `/[locale]/reservar`
  - [x] Personal data block (read-only): name, email, phone si existe (fallback i18n `personal_phone_missing` cuando `User.phone IS NULL`), tipografía `font-display` para mantener la jerarquía editorial. Phone update deferred a Sprint 3+
  - [x] Anonymous → `redirect(/{locale}/login?next=/{locale}/dashboard)` para preservar el destino tras login (mismo patrón que F-046)
  - [x] Heading personalizado `heading_personal` ("Welcome back, {firstName}") cuando `User.name` existe; fallback a `heading` estático ("Your bookings") si no.
- Tests: Playwright `e2e/f-047-dashboard.spec.ts` con 11 specs — anonymous redirect × 3 locales + empty state × 3 locales + with-bookings (orden desc + badge + CHF + details link) × 3 locales + hidden-statuses filter + isolation cross-user. Vitest 155/155 sin tocar (sólo lectura desde Prisma, sin nueva lógica unit-testable).
- Notas:
  - **Filtro de status no accionables.** `PENDING_PAYMENT` se crea por F-042 al enviar Step 4 — cada Step 4 abandonado deja un draft que no debería verse. `PAYMENT_FAILED` es callejón sin salida (el PaymentIntent es single-use; el booker ya vio el error inline en Step 5). `CANCELLED_BY_SYSTEM` cubre PaymentIntent canceled por timeout, también sin acción posible. Mostrar estos rows sólo confunde al alumno. Sprint 3 introduce secciones explícitas (Upcoming / Past / Cancelled) y el filtro se reemplaza por un agrupado UI.
  - **`View details` linkea a `/reservar/exito/[id]`**, no a una vista detalle propia. Razón: F-046 ya muestra summary completo + add-to-calendar + status condicional, y valida permiso por `bookerId === session.user.id`. Duplicar una "detail page" en `app/[locale]/dashboard/[id]` añadiría una segunda vista que renderiza la misma información, doblaría el coste de mantenerla y obligaría a re-implementar el cross-user guard. Sprint 3 puede crear `dashboard/[id]` cuando aparezca contenido específico (cancel, modificar attendees) que no encaja en exito.
  - **Status badge labels son namespace `dashboard.status_*`**, no `reservar.exito.heading_*`. exito tiene 3 mensajes humanos ("Your lesson is booked"); dashboard necesita 8 etiquetas cortas neutras ("Confirmed", "Cancelled", "Refunded"). Vocabularios distintos → namespaces distintos.
  - **`anchorTime` como tie-break secundario.** El `orderBy` primario es `date desc`; añadir `anchorTime desc` evita que 2 clases del mismo día crucen orden entre lecturas (Postgres no garantiza orden total sin un criterio adicional).
  - **Email + nombre se leen de `User`** (no de `session.user`) para que el dashboard refleje cualquier update post-signup sin invalidar la sesión. Coste: una query extra; despreciable y ya batch-ed con `Promise.all` junto a la query de bookings.
  - **Layout editorial sin tabla.** Lista `<ol>` con divisores `border-y` + `divide-y` en lugar de `<table>`. Cada row es un grid `1fr,auto` para alinear texto a la izquierda y total/details a la derecha. Tipografía display para fecha + total (jerarquía visual al estilo Aesop/Monocle), eyebrow uppercase tracked para el badge de status. Sin shadows, sin gradients, sin glassmorphism (CLAUDE.md §Forbidden).

### F-049 — Booking flow single-page architecture (SSR shell + client islands + tanstack-query + 30-min server cache)

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-025, F-026, F-027, F-040, F-042 (atomic slot lock en draft creation ya satisfecho — F-042 mergeado en #57)
- Reemplaza: F-049 original ("back stepper + minimal header"). El stepper persistente sigue existiendo pero como sub-componente del nuevo shell single-page, no como capa de navegación entre rutas.

**AC — Routing & rendering (SEO-preserving single-page):**
- [ ] Borrar `app/[locale]/reservar/{step-2,step-3,step-4,step-5}/page.tsx`. Mantener `app/[locale]/reservar/exito/[id]/` (success page sigue siendo ruta separada, gestionada por F-046).
- [ ] `app/[locale]/reservar/page.tsx` permanece **Server Component (RSC)**. Renderiza el shell completo: header minimal (logo, language switcher, exit link), `<BookingStepper>` sticky, y 5 secciones server-rendered en orden top→bottom — todos los H1/H2/copy/labels via `getTranslations`.
- [ ] RSC lee `searchParams` (`d`, `dt`, `t`, `i`, `l`) y prefetcha server-side: `computeCalendar`, `computeSlotsForDate`, instructor list — llamando `loadEngineContext` directo (sin fetch HTTP interno).
- [ ] `<QueryClientProvider>` + `<HydrationBoundary state={dehydrate(queryClient)}>` envuelven los client islands. Hidratación sin refetch en first paint.
- [ ] Cada bloque interactivo es un client island independiente: `<DurationPicker>`, `<MonthCalendar>`, `<SlotGrid>`, `<InstructorCards>`, `<BookerForm>`, `<PaymentBlock>`. Resto del árbol = Server Components.
- [ ] `generateMetadata({ searchParams })` produce título state-aware (duración + fecha cuando presentes en URL). JSON-LD `Service` + `Offer` schema en el shell RSC.

**AC — URL state mirror (deep-link + share + bookmark):**
- [ ] Cada selección (duration / date / time / instructor / language) ejecuta `router.replace(?d=...&dt=...&t=...&i=...&l=..., { scroll: false })`. Source of truth = tanstack cache; URL = projection.
- [ ] Refresh / deep-link / share / bookmark restauran exactamente el estado visual y la sección activa (RSC re-lee `searchParams` → re-prefetch → re-hydrate).

**AC — Progressive disclosure + editable inline (CRO + UX):**
- [ ] Sección N se revela cuando la selección de N-1 está completa. Una vez revelada, NUNCA se colapsa.
- [ ] Toda sección pasada permanece full UI + editable in-place (NO summary cards, NO acordeón). Razón CRO: collapse-to-summary añade un click extra para corregir un typo → micro-friction → abandono. Razón UX (impeccable): la estética editorial favorece long-scroll narrativa sobre stacks de acordeones.
- [ ] Cambiar una selección pasada invalida queries downstream (`queryClient.invalidateQueries(['availability'])` + queries dependientes) y limpia selecciones inválidas con `Toast` ("Slot no longer available for new duration, please repick").
- [ ] Botón `Continue` por sección hace smooth-scroll a la siguiente + foco accesible (`scrollIntoView({ behavior: 'smooth' })` + `ref.focus()`).
- [ ] Sticky CTA bar en mobile con la acción de la sección activa (`Continue` / `Pay CHF X`).

**AC — Persistent stepper:**
- [ ] `<BookingStepper>` sticky top, 5 pasos. Estados: pending (dim), active (highlight + dot), completed (check + click-jump). Click en paso pasado = smooth-scroll a esa sección (no navega rutas).
- [ ] Mobile: stepper colapsa a `Step 3 of 5 ←` clickable que abre un mini-menu de jump.
- [ ] Trilingual (`messages/{en,de,es}.json` namespaces `reservar.nav.*` + `reservar.stepper.*`).

**AC — tanstack-query client cache:**
- [ ] Instalar `@tanstack/react-query` (+ `@tanstack/react-query-devtools` solo en dev).
- [ ] Provider montado SOLO en el booking shell (no en `app/[locale]/layout.tsx` raíz) para que home + landing no carguen tanstack en su bundle.
- [ ] Query keys: `['availability','calendar', duration, month]`, `['availability','slots', duration, date]`, `['availability','nearby', duration, date]`, `['instructors', { duration, date, time, language }]`.
- [ ] `staleTime: 5 * 60 * 1000` (5 min), `gcTime: 30 * 60 * 1000` (30 min). Prefetch on hover en `<MonthCalendar>` día (`onMouseEnter` → `queryClient.prefetchQuery(['availability','slots', ...])`).
- [ ] Mutations `createBookingDraft` + `voidActiveDraft` invalidan `['availability']` post-response (tags scope-mínimos cuando posible: `['availability','slots', duration, date]`).

**AC — Server cache 30 min (Next 15 Cache Components):**
- [ ] `/api/availability/calendar/route.ts`, `/slots/route.ts`, `/nearby/route.ts`: quitar `export const dynamic = "force-dynamic"`. Añadir `'use cache'` + `cacheLife({ revalidate: 60, expire: 1800 })` + `cacheTag('availability', \`month:${month}\`, \`date:${date}\`)` (skill: `vercel:next-cache-components`).
- [ ] Mutation Server Actions (`createBookingDraft`, `voidActiveDraft`) y webhook handler (`CONFIRMED` / `CANCELLED_BY_SYSTEM` / `REFUNDED`) llaman `updateTag('availability', \`month:...\`, \`date:...\`)` con scope mínimo.
- [ ] Stale tanstack data tolerada: floor de correctness es F-042 (atomic slot lock en `$transaction`, ya en main). Si draft rechaza con `SLOT_TAKEN`, cliente lanza toast + `invalidateQueries(['availability'])` + repick.

**AC — Dirty-edit guard (PI activo):**
- [ ] Mientras `paymentIntent.status ∈ {requires_payment_method, requires_confirmation, processing}`: secciones 1-4 entran modo "frozen" (`opacity-60 pointer-events-none` + `aria-disabled="true"`). Stepper past-steps visibles pero dimmed (recomendación documentada: mantener stepper visible para preservar orientación espacial en single-page; ocultarlo causa layout shift y desorientación).
- [ ] Cualquier intento de edit en sección pasada (click sección, click stepper, browser back) abre `<Dialog>` "Discard payment to edit booking?". Confirm → Server Action `voidActiveDraft(bookingId)` (cancela PI vía Stripe API SI `status ∈ {requires_payment_method, requires_confirmation}`; rechaza explícitamente si `processing` o `succeeded`).
- [ ] PI `succeeded` → redirect inmediato a `/[locale]/reservar/exito/[id]` (F-046, sin cambios).

**AC — Bundle budget:**
- [ ] tanstack-query bundle delta acotado a `/reservar/*`. Home + landing no afectados.
- [ ] Delta `/reservar` ≤ +25KB gz total (tanstack ≈13KB + islands ≈+12KB). Si excede, lazy-load `<PaymentBlock>` con `next/dynamic({ ssr: false })` y/o code-split por sección.

**AC — i18n + a11y:**
- [ ] Todas las claves nuevas en `messages/{en,de,es}.json` namespaces `reservar.{stepper,nav,sections,dirty,toast}.*`.
- [ ] Focus management on section reveal (`ref.focus()` + `scroll-margin-top` para acomodar sticky stepper).
- [ ] `aria-current="step"` en stepper activo, `aria-selected` en selecciones, `aria-live="polite"` en toasts.

**Tests (Playwright):**
- [ ] 3 locales × happy path Step 1→5 sin navegación de página (network panel: zero full-document loads tras el inicial).
- [ ] URL mirror: cada selección actualiza `?d=...&dt=...&t=...` sin remount; reload restaura estado y sección activa.
- [ ] Editable past: estando en Step 4, cambiar duration en Step 1 → toast slot inválido + smooth-scroll back a Step 2; reseleccionar mantiene avance.
- [ ] Dirty-edit guard: PI en `requires_payment_method` (mocked Stripe) → click Step 1 → Dialog → confirm → PI cancelled + secciones unfrozen + repick funciona.
- [ ] Server cache: dos requests consecutivos a `/api/availability/calendar` con mismos params → segundo HIT del cache (verificar `x-vercel-cache` header en preview deploy). Mutation → `updateTag` → next request MISS.
- [ ] SEO/SSR sin JS: spec dedicada con `javaScriptEnabled: false` — HTML rendered en `/reservar?d=ONE_HOUR&dt=2026-06-12` debe contener H1, todos los headings de las 5 secciones, calendar con días disponibles y JSON-LD `Service`+`Offer`.

**Notas:**
- **Por qué single-page con RSC shell, no SPA puro**: SEO + crawlable HTML + reading-flow editorial. Crawler ve H1/H2/copy + JSON-LD + datos reales server-rendered. Islands hidratan UX interactiva sin sacrificar HTML inicial. tanstack `dehydrate`/`HydrationBoundary` evita refetch en hidratación.
- **Por qué tanstack no es overkill**: 4 queries con prefetch on hover + invalidation atómica post-mutation + dehydrate/hydrate gratuito → más simple que escribir un client cache a mano. ≈13KB gz justifica.
- **Por qué Next 15 Cache Components, no `unstable_cache`**: skill `vercel:next-cache-components` recomienda Cache Components como canonical en Next 15. `cacheTag` + `updateTag` API más limpia para scope tags por mes/día.
- **Stepper visible en Step 5 (decisión final)**: original spec ocultaba en payment para reducir distracción (Stripe best-practice). Único-page model lo invierte — ocultar causa layout shift + desorientación espacial. Mantener visible + dimmed + dirty-guard logra el mismo CRO sin coste UX.
- **F-050 (shadcn adoption pass) sigue después** — aplicará `Dialog`/`Toast`/`Select`/`RadioGroup`/`Tabs` primitives sobre los islands creados aquí.
- Componentes shadcn requeridos durante F-049 (instalar inline si faltan): `Dialog` (dirty guard + exit), `Sonner`/`Toast` (invalidations + slot loss), `Button` variants, `Tabs` opcional para mini-stepper mobile.

### F-050 — shadcn adoption pass + responsive sweep across reservar/login/home

- Sprint: 2 · Estado: review · Prioridad: P0
- Depende de: F-049
- AC:
  - [x] Install missing shadcn primitives via `npx shadcn@latest add`: `radio-group`, `tabs`, `sheet`, `sonner`. (`Select`, `Dialog`, `Checkbox`, `Textarea`, `Form`, `Input`, `Label`, `Button`, `Card` already installed pre-F-050.)
  - [x] Replace raw HTML in reservar islands:
    - `app/[locale]/reservar/duration-picker.tsx`: native `<select>` → shadcn `Select` (touch-friendly trigger h-11 on mobile).
    - `app/[locale]/reservar/time-instructor.tsx`: language pills → ARIA radiogroup pattern (role="radiogroup"/role="radio"/aria-checked) with min-h-11 touch target. Inline doc justifies why shadcn `RadioGroup` primitive is not used (radio dot fights editorial pill aesthetic; ToggleGroup not installed).
    - `app/[locale]/reservar/booker-payment-flow.tsx`: 6× raw `<label>` → shadcn `Label`; attendee-remove `<button>` → shadcn `Button variant="ghost" size="sm"`. Level Select + Checkbox + Input + Textarea already used shadcn.
  - [x] Anchor + instructor cards intentionally kept as structural raw `<button>` (user-confirmed scope: shadcn equivalent adds indirection without value).
  - [x] Migrate `app/[locale]/login/login-form.tsx` custom tablist → shadcn `Tabs`/`TabsList`/`TabsTrigger`. Trigger overrides bump to `h-full min-h-11` so they clear 44px touch target.
  - [x] Audited home (`app/[locale]/page.tsx`), dashboard (F-047), exito (F-046) and footer (F-040): editorial Links with bespoke styling kept as-is — shadcn `Button` variants do not cover this scale; refactor would add new variants without payoff. Decision documented in commit messages.
  - [x] Responsive sweep at 375 / 768 / 1280 / 1920:
    - `app/[locale]/layout.tsx`: wrap children + SiteFooter in `min-h-dvh flex flex-col` with `flex-1` slot — footer pinned to viewport bottom on short pages.
    - `app/[locale]/reservar/booking-header.tsx`: tighter gap + smaller brand on mobile (`gap-3 px-5 text-[17px]` below sm, `gap-5 px-6 text-[20px]` from sm+).
    - `app/[locale]/reservar/booking-stepper.tsx`: mobile summary text → tap-to-jump Sheet (5 steps with status semantics matching desktop). Delivers what F-049 promised but shipped only as placeholder.
  - [x] i18n new keys `reservar.stepper.{mobile_aria, mobile_jump_title}` across `messages/{en,de,es}.json`.
  - [x] Theming overrides documented inline (TabsTrigger height, language pill comment, attendee remove button).
  - [x] `npm run build` clean; Vitest 155/155; lint clean (1 preexisting warning untouched).
  - [x] Bundle delta within F-049 budget envelope (≤ +25KB gz for `/reservar`). Post-F-050 `/reservar` route reports 162 kB / 479 kB first-load JS (numbers + delta vs main captured in PR).
- Tests:
  - `e2e/f-050-visual.spec.ts` (new): 15 specs covering 4 breakpoints × 3 routes + mobile Sheet jump-menu + locale i18n + footer pinning. **15/15 green.**
  - `e2e/f-049-spa.spec.ts`: native `selectOption` replaced with click-trigger + click-item pattern for shadcn Select.
  - Suites F-032 / F-033 / F-040 / F-046 / F-047 / F-049 still green (F-046 has preexisting flake on parallel locale runs, deterministic on rerun — not caused by F-050).
- Notas:
  - **Workflow rule actualizada en `CLAUDE.md` Component conventions** ya estaba pre-F-050 — esta ticket limpia el pasado conforme a esa regla.
  - **LanguageSwitcher** kept as-is — out of nominal F-050 scope per user choice during planning (would require installing DropdownMenu primitive without payoff).
  - **Anchor cells + instructor cards + stepper steps** intentionally raw `<button>` per user choice (structural buttons with editorial styling). Documented in commit messages.
  - **No `Sonner` toasts wired yet** — primitive installed in stage 1 for F-049's slot-loss toast follow-up; F-050 does not add any Sonner usage but the primitive is available.

### F-048 — Reminder cron 24h + post-class T+2h emails

- Sprint: 2 · Estado: backlog · Prioridad: P1
- Depende de: F-045
- AC:
  - [ ] `app/api/cron/booking-emails/route.ts` (Route Handler, Node runtime)
  - [ ] Header check `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron pasa el header automático cuando `crons` configurado en `vercel.ts`)
  - [ ] Vercel cron `0 * * * *` (hourly) registrado en `vercel.ts`
  - [ ] **24h reminder:** query `Booking.status = CONFIRMED AND startDateTime BETWEEN now+23h AND now+24h AND reminderEmailSentAt IS NULL`. Send template `lib/email/booking-reminder.tsx` + `.ics` re-attached + set timestamp
  - [ ] **T+2h post-class:** query `endDateTime BETWEEN now-3h AND now-2h AND postClassEmailSentAt IS NULL AND status = CONFIRMED`. Send template `lib/email/post-class.tsx` con review CTA + tip CTA (degrade graceful si `D-PLACE` Place ID null — link omitido del template) + set timestamp
  - [ ] Schema: campos `reminderEmailSentAt` + `postClassEmailSentAt` ya añadidos en F-045
  - [ ] Templates trilingual (`lib/email/{reminder,post-class}.tsx` consumen `Booking.locale`)
- Tests: Vitest con frozen clock (`vi.useFakeTimers`) — query devuelve filas correctas en bordes ±1min; segunda invocación no re-envía.
- Notas:
  - Vercel Hobby plan: 2 crons max. Sprint 3 + Sprint 4 añadirán más (expiry crédito mensual, admin notifies). Plan upgrade probable antes de soft-launch.
  - Tip CTA degrada cuando D-PLACE null — Sprint 5 reabre el copy.

---

## Sequencing Sprint 2

```
F-039 (prices schema) ─┐
F-040 (T&C + modal) ───┴─ F-041 (Step 4) ─ F-042 (draft+PI) ─ F-043 (Step 5) ─ F-044 (webhook) ─ F-045 (email+ics) ─ F-046 (success) ─┬─ F-049 (single-page SPA refactor) ─ F-050 (shadcn pass)
                                                                                                                                       ├─ F-047 (dashboard)
                                                                                                                                       └─ F-048 (crons)
```

Critical path original (multi-page MVP, ya completado a través de F-046): F-039 → F-040 → F-041 → F-042 → F-043 → F-044 → F-045 → F-046. F-049 + F-050 ahora son **refactor polish** sobre ese flujo end-to-end ya verde, no chrome aditivo previo a F-041. F-047/F-048 en paralelo con F-049/F-050.

**Why F-049/F-050 ride inside Sprint 2 (not deferred):**
- F-049 (single-page architecture rewrite) is a CRO + performance blocker — el flujo multi-page actual hace full document loads entre pasos (TTFB + FCP × 5). Single-page con SSR shell + tanstack hydration elimina los re-renders, mantiene SEO, y permite editable-inline past sections (CRO: micro-friction baja, abandonment baja). Cheaper to refactor antes de Stripe live mode que retrofit con tráfico real.
- F-050 (shadcn adoption) consolida los nuevos client islands de F-049 sobre primitives canónicos (`Dialog`/`Select`/`RadioGroup`/`Textarea`/`Tabs`/`Toast`). Sin esta pasada, F-049 introduciría raw HTML que F-050 luego tendría que reescribir.

---

## Sprints 3-6 — Bullets gruesos (desglose al cerrar el sprint anterior)

### Sprint 3 — Cancelaciones + Créditos (semana 6)

> Política base en ADR-008: ops-cancel → cash refund Stripe; user-cancel `≥48h` → credit; `<48h` → forfeit; no-show → forfeit. Ver F-039b.

- Flujo cancelación user desde dashboard:
  - `≥ 48h` antes del slot → emite `AccountCredit` (`USER_CANCEL`, 1 año).
  - `< 48h` → forfeit. Mismo cambio de status / liberación de slot, sin credit.
  - Copy y CTA en dashboard reflejan la ventana 48h y la opción de contactar al teléfono operativo para excepciones.
- **Dashboard v2 — agrupado + design polish (sucesor de F-047):**
  - Reemplazar la lista plana actual por 3 secciones explícitas: **Upcoming** (`CONFIRMED` con `date >= today`), **Past** (`COMPLETED` o `CONFIRMED` con `date < today`), **Cancelled** (`CANCELLED_BY_USER`, `CANCELLED_BY_OPS`, `REFUNDED`). Cada sección con su heading display, contador y collapse opcional.
  - Eliminar el filtro `VISIBLE_STATUSES` hardcoded — el agrupado vuelve a hacer visibles `CANCELLED_BY_*` + `REFUNDED` con copy contextual (motivo, crédito asociado, fecha de refund).
  - Inline action por row: **Cancel** (si elegible por la ventana 48h) + **Add to calendar** (`.ics` re-download desde F-046 ICS route). El botón Cancel abre el modal del flujo descrito arriba.
  - Crédito visible en su propia card sticky / aside (saldo activo, expiración, link "Apply at checkout" → `/reservar?credit=…`).
  - Visual polish: hero personal con próxima clase destacada (countdown a `startDateTime`, info del instructor, weather widget opcional Sprint 4), separación tipográfica más fuerte (display sizes XL para fechas próximas), estados vacíos por sección, dark-mode pass (todo Sprint 2 ya respeta tokens, falta auditar contraste).
  - Detail page propia `app/[locale]/dashboard/[id]/page.tsx` si las acciones (cancel modal, edit attendees, descarga factura) no caben inline.
  - Personal data: añadir edit de `phone` (Server Action + revalidate). Email queda read-only (Better Auth maneja el flujo de change-email aparte).
- Server action ops-cancel (admin) — Sprint 4 monta la UI pero la **lógica del refund cash** debe quedar lista para uso programático aquí: `stripe.refunds.create({ payment_intent })` + persistencia `Booking.stripeRefundId` + branch para bookings 100% credit (re-emite credit en lugar de cash).
- Sistema de créditos: generación, locking durante PaymentIntent, commit en webhook success.
- UI aplicar créditos en Step 5 (toggle + breakdown).
- Cron mensual de expiración (`0 0 1 * *`).
- Cron nightly de no-show: bookings `CONFIRMED` con `startDateTime + duration < now` que sigan sin estado terminal → marcar `CANCELLED_BY_USER` con `cancelledByUserAt = startDateTime`, sin credit.
- Email cancelación user (variante credit / variante forfeit) + notif a instructor.

### Sprint 4 — Vista instructor + Admin (semanas 7-8)

- Vista instructor: agenda diaria, gestión de `availabilityBlock`, perfil.
- Conectar Google Calendar (OAuth offline access, encriptación ADR-007).
- Inserción/borrado de eventos en Google Calendar.
- Panel admin: CRUD instructores, vista de reservas, modal "Cancel day" (ops batch + preview de impacto), **editor de precios por duración** (escribe `Season.priceCentsByDuration` — schema definido en F-039).
- Email cancelación ops en locale del booker.
- **Decisión pendiente:** tip split policy (afecta `Tip` table flow).

### Sprint 5 — Landing + SEO (semanas 9-10)

- Home editorial completa (sections, instructor teaser, narrative) — la home **minimal** ya existe desde F-032 (Sprint 0.5); aquí se expande.
- Página de instructores + perfiles individuales.
- Página de precios — value-prop por duración: qué incluye cada clase (nivel target, ratio instructor/alumno, equipo incluido/excluido, ubicación de meeting point, idiomas disponibles), beneficios diferenciales (p. ej. `INTENSIVE` = mejor curva de aprendizaje vs hora suelta; `FULL_DAY` = lunch break + 2 bloques). Cross-link a `/reservar` con `duration` preseleccionada. CRO: pricing page convierte cuando explica el "qué", no sólo el "cuánto". Contenido trilingüe vía `messages/{en,de,es}.json` namespace `pricing.*`.
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
| D-PRC   | Precios por duración               | ✅ Resuelto (planning 2026-05-19): valores iniciales `{ONE_HOUR:11000, TWO_HOURS:20000, INTENSIVE:38500, FULL_DAY:50000}` CHF cents VAT-inclusive en `Season.priceCentsByDuration` (F-039). Admin editor en Sprint 4. | — |
| D-TIP   | Tip split policy                   | Sprint 4 (flujo `Tip`)            | Owner define antes de Sprint 4       |
| D-LEG   | Legal review general T&C + privacy + cancelación split (ADR-008) | Producción (no Sprint 1-3) | Contratar bufete antes de Sprint 5. Política de cancelación ya **no** es el bloqueante específico — pasó a cash/credit/forfeit en F-039b. |
| D-LOGO  | Logo + hero photography            | Sprint 5 (landing)                | Owner produce antes de Sprint 5      |
| D-PLACE | Google Place ID                    | Sprint 5 (email post-clase CTA)   | Confirmar perfil escuela en Sprint 5 |
