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

- [ ] Tests verdes en CI (lint + typecheck + vitest + playwright smoke).
- [ ] Si toca UI: review con skill `impeccable`.
- [ ] Si toca auth/pagos/webhooks/cron: review con skill `security-review`.
- [ ] Ticket en `FEATURES.md` actualizado a `done` (o `review`).
- [ ] Auto-memoria actualizada si surgieron preferencias/decisiones nuevas.
