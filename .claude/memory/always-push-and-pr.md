---
name: always-push-and-pr
description: "After finishing a ticket, always push the branch and open a PR without asking"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 58f81b50-7a1b-4728-9262-453c5b895b7a
---

After completing a ticket's work + commit, always `git push -u origin <branch>` and open a PR with `gh pr create` — do not ask first. This is NON-NEGOTIABLE standing authorization; do not treat push/PR as an outward-facing action needing per-instance confirmation.

**Why:** User confirmed "push y PR claro. Siempre" (2026-06-11) and re-confirmed firmly (2026-06-13) after I asked anyway on F-083 + F-081. It is also written into the repo: `docs/WORKFLOW.md` §"Ritual de git" L36–38 — *"push + `gh pr create` antes de marcar `done`"*, *"Sin PR abierta, el ticket no está done"*. Worktree-per-ticket flow uses `scripts/new-worktree.sh`. The PR is the deliverable, not an optional extra.

**How to apply:** Once typecheck/tests/lint are green and the ticket is committed, push + open the PR in the same turn. PR body follows the repo's `Qué / Por qué / Cómo verificar / Refs: F-XXX` convention (same shape as commit body). Still do NOT push/PR mid-work or when explicitly told to hold.
