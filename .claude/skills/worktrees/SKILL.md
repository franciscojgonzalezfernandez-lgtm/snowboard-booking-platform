---
name: worktrees
description: Worktree lifecycle for this repo — create a per-ticket worktree, seed its env files, verify it boots, and clean it up after merge. Use whenever starting work on a ticket (F-XXX), creating a branch/worktree, or after a PR merges. Triggers on "new worktree", "start ticket", "worktree sin env", "cleanup worktrees", "after merge".
---

# Worktree ritual

Every ticket lives in its own sibling worktree cut from `origin/main`. The primary repo checkout stays on `main` (trivial meta-doc edits excepted).

## Create — always via the helper

```bash
scripts/new-worktree.sh f-XXX-kebab-slug
# → ../booking-platform.f-XXX  (branch f-XXX-kebab-slug off origin/main)
```

**Never use a bare `git worktree add`.** Worktrees only materialise tracked files; the gitignored `.env.local` (Neon `dev` `DATABASE_URL`/`DIRECT_URL`, Stripe keys) would be missing and local dev + Playwright break. The helper fetches, creates the worktree, and copies `.env`/`.env.local` from the primary worktree — today only `.env.local` exists; production credentials live exclusively in Vercel env vars.

If a worktree was created by hand anyway, seed it afterwards:

```bash
cp "$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')/.env.local" .
```

## Verify

- `npm run dev` fail-fasts with instructions if `.env.local`/`DATABASE_URL` is missing (guard in `scripts/dev.mjs`) — a silent boot against nothing is not possible.
- Prisma CLI does **not** auto-load `.env.local` (only `.env`). For CLI commands run: `set -a && source .env.local && set +a && npx prisma migrate status`.

## After merge — clean up immediately

```bash
git worktree remove ../booking-platform.f-XXX
git branch -d f-XXX-kebab-slug   # -D if the PR was squash-merged
```

Audit for leftovers (do this when picking up a session):

```bash
git worktree list   # anything merged should be gone
```

A worktree whose branch is already merged and whose `git status` is clean is safe to remove.
