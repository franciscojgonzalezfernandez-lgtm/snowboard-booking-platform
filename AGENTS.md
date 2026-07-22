# AGENTS.md — Snowboard Booking Platform

> Read by Codex and other non-Claude agents at the start of a session.

**All project context, conventions, and constraints live in [`CLAUDE.md`](CLAUDE.md) — read that file now and follow it exactly.** It is the single source of truth for: stack (strict, no substitutions), active skills, design direction (brand "Ride Flumserberg", Archivo Black display type — no serif), routing (`localePrefix: "always"`, translated marketing slugs, `reservar/` outside route groups), naming, git ritual (worktree per ticket, `Qué/Por qué/Cómo verificar/Refs` commit bodies), money handling, auth, database rules, testing, performance budgets, and the security checklist.

Supporting docs, in reading order when scope is unclear:

- [`docs/PRD.md`](docs/PRD.md) — product/business
- [`docs/Architecture.md`](docs/Architecture.md) — data model, integrations, ADRs
- [`docs/FEATURES.md`](docs/FEATURES.md) — living backlog, source of truth for ticket scope
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — subagent workflow + Playwright rules

Where CLAUDE.md says "Claude", read it as "the agent". No conventions are defined here — this file was previously a near-duplicate of CLAUDE.md and drifted badly (stale serif typography, EN-no-prefix URLs, `(booking)` route group); it is now a pointer so that can't happen again.

---

**Last updated:** 2026-07-22
