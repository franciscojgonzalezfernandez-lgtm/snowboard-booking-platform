# WORKFLOW — Snowboard Booking Platform

Workflow operativo para implementar features con subagentes. Léelo al inicio de cada sesión.

**Fuente de verdad del scope:** [`FEATURES.md`](./FEATURES.md). Sin ticket, no se delega.

---

## Loop por feature: Plan → Build → Review → Test

| Fase | Herramienta | Cuándo |
|---|---|---|
| A. Locate | `caveman:cavecrew-investigator` | Solo si el feature toca código existente ("¿dónde vive X?", "¿quién llama a Y?"). Skip en greenfield. |
| B. Plan | Subagente `Plan` (no edita) | Default para features ≥3 archivos o lógica no trivial. Skip en typo/rename/función única. |
| C. Build | `caveman:cavecrew-builder` (1-2 archivos) o main thread directo (multi-archivo) | Nunca delegar edits a `general-purpose` — pierde contexto. |
| D. Review | `caveman:cavecrew-reviewer` (diff) + skill `playwright-skill` (E2E/visual) + skill `impeccable` (UI design) + skill `security-review` (pre-merge `main`) | Obligatorio antes de `done`. |

### Reglas duras
- Sin ticket en `FEATURES.md` → sin subagente. El ticket = scope.
- `Plan` agent **no edita**. Builder **no crea archivos** no listados en el ticket. Reviewer **no propone refactors** fuera de scope.
- Cambios al stack o convenciones (`CLAUDE.md`) son su propio ticket — nunca side-effect de otro feature.

---

## Ritual de git (por ticket — OBLIGATORIO)

Cada ticket de `FEATURES.md` vive en su propia branch contra `main`. Sin excepción, incluidos los tickets de setup.

1. **Empezar limpio — worktree por defecto.** Cada ticket se desarrolla en un worktree dedicado, no haciendo `checkout` sobre el repo principal. Esto evita stashes accidentales y permite tener varios tickets en paralelo sin perder estado.
   ```
   git fetch origin
   git worktree add -b f-XXX-kebab-slug ../booking-platform.f-XXX origin/main
   cd ../booking-platform.f-XXX
   ```
   - Convención de ruta: hermana del repo principal, sufijo `.f-XXX`.
   - Tras merge del PR, limpiar: `git worktree remove ../booking-platform.f-XXX && git branch -d f-XXX-kebab-slug`.
   - Excepción: edits triviales al propio `WORKFLOW.md` / `CLAUDE.md` / `FEATURES.md` (meta-docs sin ticket) pueden ir en el repo principal sobre una branch corta — pero siguen necesitando branch + PR.
2. **Commits progresivos y descriptivos.** Nunca `git add -A` — staging explícito por archivo o carpeta. Cada commit debe poder leerse aislado y dejar claro **qué cambió, por qué y cómo verificarlo**.

   **Subject (línea 1, ≤72 chars):**
   - Formato: `tipo(f-XXX): verbo + objeto concreto + motivación corta`.
   - Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`.
   - Ejemplos válidos:
     - `feat(f-005): add Better Auth email+password to unblock student signup`
     - `fix(f-007): clamp availability search to season window to prevent off-season bookings`
     - `chore(f-002): pin Tailwind v4 + shadcn registry to lock design tokens`
   - Ejemplos prohibidos: `update auth`, `fixes`, `wip`, `f-005 changes`.

   **Body (obligatorio, separado del subject por línea en blanco):**
   ```
   Qué:
   - <bullet por cambio relevante; nombrar archivos/módulos si ayuda a auditar>

   Por qué:
   - <motivación de negocio o técnica; enlazar al ticket/PRD/decisión>

   Cómo verificar:
   - <pasos manuales, comando de test, ruta a abrir, o "N/A: refactor sin cambio observable">

   Refs: F-XXX[, PRD §X.Y][, Architecture §A.B][, ADR-NNN]
   ```
   - El footer `Refs:` siempre lleva al menos el ticket. PRD/Architecture/ADR cuando apliquen.
   - Si el commit es trivial (typo, rename mecánico), el body puede ser una línea — pero el `Refs:` sigue siendo obligatorio.
3. **Push + PR antes de marcar `done`.**
   ```
   git push -u origin f-XXX-kebab-slug
   gh pr create --base main --title "feat(f-XXX): <título>" --body "<summary + test plan + closes F-XXX>"
   ```
4. **Higiene de worktrees y branches.** Tras merge: `git worktree remove ../booking-platform.f-XXX` + `git branch -d f-XXX-kebab-slug`. Nunca reutilizar el worktree ni la branch de un ticket anterior — aunque ya esté mergeada. Verificar con `git worktree list` que no queden huérfanos.

Sin PR abierta, el ticket **no está done**, aunque el código funcione localmente.

---

## Playwright per-feature (Sprint 1 en adelante)

Todo ticket de Sprint ≥1 que toque UI o endpoint público debe:

- Incluir AC explícito: "Playwright test cubre [escenario]".
- Crear `e2e/[ticket-id].spec.ts` que corre verde en CI antes de marcar `done`.
- Si no toca UI/endpoint (lib pura, refactor interno) → Vitest basta; declarar en el ticket.

Fixtures: branch Neon dedicada (default `playwright`) con `prisma/seed.ts` recargado entre suites — decidido en F-022.

---

## Memoria de features y repriorización

**Dos artefactos, roles distintos:**

- `docs/FEATURES.md` (versionado): backlog vivo, tickets con AC binarios. Ver formato en su cabecera.
- Auto-memoria del agente (`~/.claude/projects/.../memory/`): solo lo *no derivable* del repo. Decisiones de negocio, preferencias del owner, blockers externos con fecha. NUNCA duplicar el backlog ahí.

### Formato de ticket (resumen)

```md
## F-XXX — Título
- Sprint: N · Estado: backlog|in-progress|review|done|blocked · Prioridad: P0|P1|P2
- Depende de: F-AAA, F-BBB
- AC:
  - [ ] Criterio binario 1
  - [ ] Playwright cubre escenario X (si aplica)
- Decisiones pendientes: ...
- Notas: PRD §X.Y | Architecture §A.B
```

### Ritual de repriorización

- **Cuándo:** inicio de sesión + fin de sprint.
- **Cómo (main thread, sin subagente):**
  1. Leer `FEATURES.md`.
  2. Marcar `done` los cerrados.
  3. Revisar `blocked` — ¿desbloqueable hoy?
  4. P0 restante vs. capacidad de la sesión.
  5. Cambios de prioridad: commit en el mismo PR del trabajo, no aislado.
- **A auto-memoria:** decisiones de negocio nuevas, preferencias del owner confirmadas, blockers externos con fecha.

---

## Skills activos en este proyecto

- `impeccable` — visual review (marketing + booking + dashboard).
- `playwright-skill` — E2E + visual review loop.

Skills declarados en `CLAUDE.md` pero no auto-activos: `taste`, `ui-ux-pro-max`. Invocar explícitamente si se necesitan (revisar inventario antes de Sprint 5).

---

## Antes de cada PR a `main`

- [ ] Branch es `f-XXX-kebab-slug` cortada desde `main` actualizado — no piggyback sobre branch de ticket previo.
- [ ] PR abierta contra `main` con título `feat(f-XXX): <título>` (o `chore(f-XXX): …`).
- [ ] Tests verdes en CI (lint + typecheck + vitest + playwright smoke).
- [ ] Si toca UI: review con skill `impeccable`.
- [ ] Si toca auth/pagos/webhooks/cron: review con skill `security-review`.
- [ ] Ticket en `FEATURES.md` actualizado a `done` (o `review`).
- [ ] Auto-memoria actualizada si surgieron preferencias/decisiones nuevas.
