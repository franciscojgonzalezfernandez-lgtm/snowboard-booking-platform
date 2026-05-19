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

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-030, F-031, F-039b
- AC:
  - [ ] `app/[locale]/terms/page.tsx` + `app/[locale]/privacy/page.tsx` (server components, static rendering)
  - [ ] Contenido **T&C real** cubre 6 secciones obligatorias (owner drafts EN, Claude traduce DE/ES, owner revisa antes de merge):
    1. Service description — school identity, lesson types, jurisdiction (Flumserberg, SG canton)
    2. Booking & payment — CHF inclusive VAT, payment methods (Card/TWINT/Apple Pay/Google Pay), when charged (at booking, before lesson)
    3. Cancellation policy (ADR-008, refinada en F-039b) — copy explícita: (a) si la escuela cancela (clima en montaña, cierre de pistas, instructor sin reemplazo) → **cash refund** al método de pago original vía Stripe (5-10 días hábiles); (b) si el cliente cancela `≥ 48h` antes del slot → **credit** válido 1 año; (c) `< 48h` o no-show → **forfeit** (sin credit, sin cash). Mencionar el teléfono operativo para excepciones a discreción.
    4. Liability disclaimer — snowboard inherent risk, weather force majeure (sólo aplica al cierre del **operador** — cancelación lado-cliente no es force majeure, cae bajo la regla de las 48h), no-show forfeiture
    5. Data processing — link a `/privacy`
    6. Governing law — Swiss federal law, jurisdicción Sarganserland / SG canton
  - [ ] Contenido **Privacy real** cubre: data collected (name/email/phone/payment), processors (Stripe/Resend/Sentry/Vercel/Neon/Google), retention (until account deletion), user rights (access/erasure/rectification per nLPD CH + GDPR para residentes EU), DPO contact
  - [ ] Trilingual via `messages/{en,de,es}.json` namespaces `terms.*` + `privacy.*` (NOT raw MDX en MVP — JSON keys facilitan traducción + reuso en email footer Sprint 5)
  - [ ] `app/components/TermsModal.tsx` (client, shadcn `Dialog`): renderiza contenido del locale activo, scrollable, ESC + click-outside cierran, max-height 80vh
  - [ ] Modal display-only: SIN checkbox dentro. Aceptación vive en Step 4 (F-041)
  - [ ] Footer global en `app/[locale]/layout.tsx` añade links `/terms` + `/privacy` por locale
  - [ ] SEO básico: `<title>` + `<meta description>` traducidos. Hreflang + structured data quedan para Sprint 5
- Tests: Playwright 3 locales — `/terms` y `/privacy` rinden 200, headings traducidos, footer links presentes en `/`, `/en`, `/de`, `/es`. Modal integration test en F-041.
- Notas:
  - **D-LEG sigue blocking prod launch.** Owner contrata bufete CH antes de soft-launch; copy actual cuenta como draft de buena fe documentando ya la política cash-on-ops / credit-≥48h / forfeit-<48h refinada en F-039b.
  - **No GDPR cookie banner aquí.** Site no usa cookies de tracking (Vercel Analytics es cookieless). Solo Better Auth session cookie = strictly necessary → no banner requerido. Re-evaluar si Sprint 5 añade GA4 o similar.

### F-041 — UI Step 4 (booker + attendees + level + notes + T&C) + auth gating

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-027, F-038, F-040, F-049, F-050
- AC:
  - [ ] `app/[locale]/reservar/step-4/page.tsx` (server) + `step4-form.tsx` (client, RHF + Zod)
  - [ ] **Auth gating:** si `!session`, page renderiza CTA "Sign in to continue" → `/[locale]/login?next=/[locale]/reservar/step-4&<all-params>`. Form no se renderiza para anónimos
  - [ ] **Better Auth wiring:** `signIn.magicLink({ callbackURL })` y `signIn.email/social` respetan el `next=` param. Verificar; parchear si falla
  - [ ] **Booker block:** name (default `session.user.name`, editable) + email (readonly = `session.user.email`) + phone (required, E.164, default prefix `+41`)
  - [ ] **Attendees array 1-4** vía `useFieldArray` (PRD §6.4): name + age (number 4-99) + `Level` enum select (`BEGINNER`/`INTERMEDIATE`/`ADVANCED`/`EXPERT`). Min 1, max 4
  - [ ] **Notes** textarea opcional, máx 500 chars con contador
  - [ ] **T&C checkbox** required. Label HTML: `"I agree to the [Terms and Conditions] and [Privacy Policy]"`. Cada link es un `<button type="button">` que abre el `TermsModal` (no `<a target=_blank>`, no nav)
  - [ ] Submit avanza a `step-5?...&attendees=<base64-json>&bookerPhone=<phone>&notes=<encoded>` — URL state preserve; persistencia real ocurre en F-042
  - [ ] Trilingual labels (`messages/{en,de,es}.json` namespace `reservar.step4.*`)
  - [ ] Loading + error states obligatorios, traducidos
- Tests: Playwright 3 locales × (anónimo → redirect login con next= correcto, autenticado → form, validation min/max attendees, T&C uncheck → submit disabled, click T&C link → modal abre, back-nav preserva data, happy → step-5 con full URL state).
- Notas:
  - Phone no se persiste al `User` model en MVP. Sprint 3+ podría añadir toggle "save phone to profile".
  - Email immutable evita confusión (booking ligado a `session.user.id`); cambiar email = logout + relogin.

### F-042 — Booking draft + PaymentIntent server action

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-018, F-039, F-041
- AC:
  - [ ] Server action `createBookingDraft(input)` en `app/[locale]/reservar/actions.ts`
  - [ ] Zod schema valida full input: `date`, `time`, `duration`, `instructorId` (concreto, no `ANYONE` — Step 3 lo resolvió), `language: Locale`, `attendees: [{name, age, level}]` (1-4), `bookerPhone`, `notes?` (≤500), `acceptedTerms: true`
  - [ ] Rechaza 401 si `!session` (defensa server-side, mismo header check que routes)
  - [ ] Prisma `$transaction`:
    1. Re-check slot via `loadEngineContext` + `computeSlotsForDate` (engine puro) — rechaza con error `SLOT_TAKEN` si ya no disponible
    2. `getPriceCents(activeSeason, duration)` (F-039)
    3. `prisma.booking.create({ status: 'PENDING_PAYMENT', bookerId: session.user.id, instructorId, date, startDateTime, endDateTime, duration, language, notes, totalPriceCents, locale })` + `prisma.attendee.createMany` (1-4 rows; primer attendee `isBooker: true` si su name matches booker name)
    4. Stripe `paymentIntents.create({ amount: totalPriceCents, currency: 'chf', metadata: { bookingId }, automatic_payment_methods: { enabled: true, allow_redirects: 'always' } })` — habilita Card + TWINT + Apple Pay + Google Pay automáticamente vía AMP
    5. Persist `booking.stripePaymentIntentId`
  - [ ] Returns `{ bookingId, clientSecret }`
  - [ ] **Idempotency:** si existe booking `PENDING_PAYMENT` con `(bookerId, instructorId, date, startDateTime)` y `createdAt > now - 15min`, reuse PaymentIntent (no crear nuevo) — evita duplicate intents si user refresca Step 5
- Tests: Vitest con Prisma mock + Stripe mock. Casos: happy, slot taken race, 401 anonymous, idempotent reuse dentro de 15min, attendees min/max bounds, `priceCents` matches season config, AMP enabled flag.
- Notas:
  - `automatic_payment_methods.allow_redirects: 'always'` necesario porque TWINT redirige al banco. Wallets aparecen free.
  - PI sin TTL explícito; sweep de PENDING expirados llega en Sprint 3 (cron mensual + cleanup de credits-locked).

### F-043 — UI Step 5 (Stripe Payment Element + order summary)

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-042
- AC:
  - [ ] `app/[locale]/reservar/step-5/page.tsx` (server) lee URL params, llama `createBookingDraft`, pasa `{ bookingId, clientSecret, summary }` a client
  - [ ] `step5-payment.tsx` (client) usa `@stripe/react-stripe-js` `<Elements stripe={stripePromise} options={{ clientSecret, appearance }}>` + `<PaymentElement>`
  - [ ] **Order summary** (left column en desktop, top en mobile): duration label + date (formato CH) + time + instructor name + attendees count + total CHF (`formatChf` F-039) + nota "VAT included"
  - [ ] Submit → `stripe.confirmPayment({ confirmParams: { return_url: \`${origin}/${locale}/reservar/exito/${bookingId}\` } })`. Loading state durante confirm
  - [ ] Error states: declined, 3DS failed, TWINT timeout — todos traducidos
  - [ ] Wallets aparecen automático cuando browser soporta + PE los expone
  - [ ] `tsc --noEmit` clean; bundle <60KB extra en route (Stripe.js lazy-loaded vía `loadStripe`)
- Tests: Playwright con Stripe test card `4242 4242 4242 4242` (3DS-bypass) + TWINT test redirect. Verifica `Booking.status` → `CONFIRMED` post-webhook. 3 locales smoke (summary labels + currency format).
- Notas:
  - Step 5 NO re-fetcha precio — usa el `totalPriceCents` ya persistido en `Booking` por F-042 (single source of truth).
  - Visual review con skill `impeccable` obligatorio antes de marcar done (Payment Element default styling no match brand — appearance API customiza).

### F-044 — Webhook business logic (per-event handlers)

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-018, F-042
- AC:
  - [ ] Extiende `lib/stripe/handle-webhook.ts` con switch por `event.type`:
    - `payment_intent.succeeded` → `Booking.status = CONFIRMED`, set `paidAt`, dispatch send confirmation email (F-045)
    - `payment_intent.payment_failed` → `Booking.status = PAYMENT_FAILED`, set `failureReason` (from `last_payment_error.message`)
    - `payment_intent.canceled` → `Booking.status = CANCELLED_BY_SYSTEM`
    - `charge.refunded` → `Booking.refundedAt` + `refundAmountCents`, Sentry breadcrumb
    - `charge.dispute.created` → Sentry alert (no status change auto; owner decide manual)
  - [ ] Idempotencia heredada: `WebhookEvent` dedupe table de F-018 sigue siendo el gate único
  - [ ] Todos los handlers en single `$transaction` con upsert del `WebhookEvent.processedAt`
  - [ ] Email dispatch: post-transaction `await sendBookingConfirmedEmail(bookingId)`. Si falla, log a Sentry pero NO rollback (booking ya confirmado, email reenviable manual desde admin Sprint 4)
- Tests: extiende `lib/stripe/handle-webhook.test.ts` (5 → ≥10 specs): un spec por event type, happy + duplicate, plus negative case "booking not found logged + 200 OK to prevent Stripe retries".
- Notas:
  - Verificar que `BookingStatus` enum tiene `CONFIRMED`, `CANCELLED_BY_USER`, `CANCELLED_BY_SYSTEM`, `PAYMENT_FAILED`, `REFUNDED`. Si falta alguno, mini-migration aquí.
  - Schema: añadir `Booking.refundedAt DateTime?` + `refundAmountCents Int?` + `failureReason String?` si no existen (mini-migration en este ticket).

### F-045 — Confirmation email + `.ics` attachment

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-017, F-044
- AC:
  - [ ] `lib/email/booking-confirmed.tsx` — React Email template trilingual (recibe `locale` del `Booking.locale`)
  - [ ] Contenido: greeting + summary (date/time/duration/instructor/attendees count) + total CHF (`formatChf`) + add-to-calendar (.ics adjunto) + cancellation policy short link + contact
  - [ ] `lib/ics/build-event.ts` usa pkg `ics`; campos: `uid = booking.icsUid`, `title`, `start` (UTC), `duration` (minutos), `location: 'Flumserberg, CH'`, `description`, `organizer: 'booking@rideflumserberg.ch'`, `attendees: [bookerEmail]`
  - [ ] Send via Resend desde `booking@rideflumserberg.ch` (dominio verificado F-017) con `.ics` adjunto MIME `text/calendar; method=REQUEST`
  - [ ] **Idempotencia:** skip si `booking.confirmationEmailSentAt` set; al éxito, `prisma.booking.update({ confirmationEmailSentAt: new Date() })`
  - [ ] Schema: añadir `Booking.confirmationEmailSentAt DateTime?` + `reminderEmailSentAt DateTime?` + `postClassEmailSentAt DateTime?` (mini-migration empaquetada con F-048 también; lo más práctico es shipear las 3 columnas aquí y F-048 sólo las consume)
- Tests: Vitest — template renderiza 3 locales sin errores, `.ics` output passes RFC 5545 validator (`ics` pkg's `createEvent` retorna no error), idempotency spec (segundo call no resend).
- Notas:
  - Schema field `Booking.icsUid` ya existe (F-020).
  - Resend free tier: 3k emails/mes, 100/día. MVP holgado; vigilar si Sprint 4 admin notifies suben volumen.

### F-046 — Success page `/[locale]/reservar/exito/[id]`

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-043, F-045
- AC:
  - [ ] Server component fetcha `Booking` by id; rechaza con 403 si `booking.bookerId !== session.user.id`
  - [ ] Render: confirmation hero ("Your lesson is booked, {name}") + full summary (date/time/duration/instructor/attendees/total) + "Add to calendar" link a `/api/booking/[id]/ics` (re-genera server-side) + CTA "Go to dashboard" → `/[locale]/dashboard`
  - [ ] **Pending state:** si `booking.status === 'PENDING_PAYMENT'` (TWINT async), render banner "Confirming your payment..." + `<meta http-equiv="refresh" content="3">` durante 30s, después fallback "Refresh manually if not confirmed"
  - [ ] Trilingual via `messages/{en,de,es}.json` namespace `success.*`
- Tests: Playwright 3 locales × (happy CONFIRMED, pending state, 403 cross-user, anonymous → redirect login).
- Notas:
  - Nuevo route handler `app/api/booking/[id]/ics/route.ts` re-genera el `.ics` on demand (auth-gated). Permite re-descarga sin re-disparar email.

### F-047 — Student dashboard (basic)

- Sprint: 2 · Estado: backlog · Prioridad: P1
- Depende de: F-005, F-044
- AC:
  - [ ] `app/[locale]/dashboard/page.tsx` server-rendered, lista `Booking[]` de `session.user.id` ordenados desc por `date`
  - [ ] Cada row: date · time · duration · instructor · status badge · total CHF · link "View details" (placeholder noop en MVP; Sprint 3 lo conecta con vista detalle + cancelar)
  - [ ] Empty state con CTA "Book your first lesson" → `/[locale]/reservar`
  - [ ] Personal data block (read-only): name, email, phone si existe. Phone update deferred a Sprint 3+
- Tests: Playwright 3 locales × (empty + with-bookings + anonymous → redirect login).

### F-049 — Booking flow navigation: back stepper + minimal header (CRO fix)

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-025, F-026, F-027, F-040
- AC:
  - [ ] `app/[locale]/reservar/layout.tsx` nuevo — wraps steps 1-5 con header minimal (logo → `/[locale]`, language switcher, exit link "Back to site")
  - [ ] **Persistent stepper** `app/[locale]/reservar/components/booking-stepper.tsx` (server): muestra 5 pasos con estado actual + completados. Pasos completados son clickables y preservan URL params relevantes (duration/date/time/instructor/language). Pasos futuros disabled
  - [ ] **Step 5 (payment) excepción:** layout reduce header a sólo logo + exit. NO stepper visible (CRO: minimizar distracciones en checkout, alinea con Stripe best practices). Exit + logo click → `Dialog` "Discard payment?" antes de salir (proteger PaymentIntent draft activo)
  - [ ] Forward navigation sigue siendo botón "Continue" único; back vía stepper click, browser back, o exit
  - [ ] Mobile: stepper colapsa a "Step 3 of 5 ←" linkeable
  - [ ] Trilingual (`messages/{en,de,es}.json` namespace `reservar.nav.*`)
- Tests: Playwright 3 locales × (stepper click step-3 → step-2 preserves date; logo click pre-checkout → home; logo click en Step 5 → Dialog → confirm sale; mobile stepper colapsado renderiza; back-button preserva URL state).
- Notas:
  - **CRO racional:** dead-end multi-step flows tienen abandonment ↑40-60% vs flows con back. Mantener URL state también beneficia retargeting + bookmark recovery + share-link.
  - Componentes shadcn requeridos: `Dialog` (Step 5 discard) + `Button` variant. Si Tabs es la abstracción correcta para el stepper, instalar; sino composición manual con Button + dot indicators. Decidir con skill `vercel:shadcn`.
  - F-040 antes que F-049 (Dialog primitive reuse).

### F-050 — shadcn adoption pass: replace raw HTML primitives across reservar/login/home

- Sprint: 2 · Estado: backlog · Prioridad: P0
- Depende de: F-049
- AC:
  - [ ] Install missing shadcn primitives via `npx shadcn@latest add`: `Select`, `Dialog`, `Checkbox`, `RadioGroup`, `Textarea`, `Tabs`, `Sheet`, `Toast`
  - [ ] Replace raw HTML:
    - `app/[locale]/reservar/step1-filters-form.tsx`: `<select>` → `Select`
    - `app/[locale]/reservar/step-2/step2-calendar.tsx`: raw `<button>` calendar cells → `Button` variants + theming overrides
    - `app/[locale]/reservar/step-3/step3-selection.tsx`: raw `<button>` anchor/instructor cards + language pills → `Button` variants + composition
  - [ ] Auditar `app/[locale]/login/login-form.tsx` → `Input`/`Label`/`Tabs` shadcn primitives donde aplique
  - [ ] Auditar home (`app/[locale]/page.tsx`): CTAs y nav usan `Button` con variants definidos por design tokens (F-030)
  - [ ] Theming overrides en `components/ui/<comp>.tsx` cuando el default no match editorial — documentar cada override inline
  - [ ] `npm run build` clean; visual regression manual vs screenshots `docs/screenshots/{step1,step2,step3}.png` — sólo refactor estructural, sin breaking visual changes
  - [ ] Bundle delta ≤ +5KB gz por route (shadcn primitives son tree-shakable)
- Tests: suites E2E existentes (F-025/26/27/33/34) siguen verdes. Si rompen por selector, ajustar `data-testid` (preferred over class selectors).
- Notas:
  - **Foundation para F-041** (Step 4) — booker form usa heavily `Form` + `Input` + `Select` + `Textarea` + `Checkbox`. Sin esta pasada, F-041 introduce más raw HTML.
  - Ship después de F-049 para que el nuevo layout/stepper use shadcn primitives desde día 1.
  - **Workflow rule actualizada en `CLAUDE.md` Component conventions** dentro de este sprint planning — F-050 limpia el pasado, la regla evita reincidencia.

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
F-040 (T&C + modal) ───┴─ F-049 (back nav + header) ─ F-050 (shadcn adoption) ─ F-041 (Step 4) ─ F-042 (draft+PI) ─ F-043 (Step 5) ─ F-044 (webhook) ─ F-045 (email+ics) ─┬─ F-046 (success)
                                                                                                                                                                          ├─ F-047 (dashboard)
                                                                                                                                                                          └─ F-048 (crons)
```

Critical path: F-039 → F-040 → F-049 → F-050 → F-041 → F-042 → F-043 → F-044 → F-045 (≈9 PRs serial). F-046/F-047/F-048 parallel después de F-045.

**Why F-049/F-050 ride inside Sprint 2 (not deferred):**
- F-049 (back nav + header) is a CRO blocker — dead-end flows abandonment ↑40-60%. Cheaper to fix once now than retrofit after Stripe live mode.
- F-050 (shadcn adoption) is a precondition for F-041's Step 4 form quality. Booker + attendees + T&C checkbox needs `Form`/`Select`/`Checkbox`/`Textarea` primitives; without F-050, F-041 would either bloat the audit later or ship more raw HTML.

---

## Sprints 3-6 — Bullets gruesos (desglose al cerrar el sprint anterior)

### Sprint 3 — Cancelaciones + Créditos (semana 6)

> Política base en ADR-008: ops-cancel → cash refund Stripe; user-cancel `≥48h` → credit; `<48h` → forfeit; no-show → forfeit. Ver F-039b.

- Flujo cancelación user desde dashboard:
  - `≥ 48h` antes del slot → emite `AccountCredit` (`USER_CANCEL`, 1 año).
  - `< 48h` → forfeit. Mismo cambio de status / liberación de slot, sin credit.
  - Copy y CTA en dashboard reflejan la ventana 48h y la opción de contactar al teléfono operativo para excepciones.
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
