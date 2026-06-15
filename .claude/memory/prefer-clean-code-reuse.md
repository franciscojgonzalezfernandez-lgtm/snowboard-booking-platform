---
name: prefer-clean-code-reuse
description: Default to extracting clean shared helpers / DRY whenever logic would otherwise be duplicated
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bc737ea3-6cd9-42e9-8d2a-5cc4c50f9ebe
---

When the same logic, constant set, or sequence would appear in more than one place, extract it into a single clean, well-named shared helper instead of duplicating — proactively, not only when asked.

**Why:** User explicitly endorsed this after the `revalidateAfterNoShow` extraction in PR #130 (2026-06-13), where two `markNoShow` wrappers had drifted (instructor omitted two `revalidatePath` paths). Wants this DRY discipline applied as the default going forward. Duplication drifts and hides bugs; a shared surface keeps callers consistent.

**How to apply:**
- Spot duplication (copied path lists, repeated guard sequences, parallel mappers, similar prisma selects) and lift it into `lib/` (pure cores) or a shared component, named for intent (`revalidateAfterNoShow`, `AVAILABILITY_ERROR_COPY`).
- Keep it *clean*, not clever: a small focused helper with a doc comment beats a god-util. Don't over-abstract a single use site or force unrelated cases through one path.
- Pass behavior via props/deps (e.g. the `NoShowButton` takes its `action` as a prop) so one component serves multiple surfaces without coupling to one route tree.
- Matches the existing codebase pattern: pure DI cores in `lib/` + thin `"use server"` wrappers. Reuse the core; don't re-implement.
