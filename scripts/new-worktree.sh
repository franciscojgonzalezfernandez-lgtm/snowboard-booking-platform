#!/usr/bin/env bash
# Create a sibling worktree off origin/main and seed it with the gitignored
# env files (.env, .env.local) from the primary worktree.
#
# Why this exists: `.env` and `.env.local` are gitignored, so `git worktree
# add` never materialises them in a new worktree (worktrees only check out
# tracked files). Without them the new worktree has no DB credentials and
# local dev / Playwright break. `.env.local` carries the Neon `dev` DATABASE_URL
# that keeps local work off production — see CLAUDE.md and the Neon branching
# notes.
#
# Usage:
#   scripts/new-worktree.sh <branch-slug> [dest-path]
# Examples:
#   scripts/new-worktree.sh f-070-instructor-agenda
#     -> ../booking-platform.f-070  (path derived from the f-NNN prefix)
#   scripts/new-worktree.sh chore/tidy-docs ../booking-platform.tidy
set -euo pipefail

branch="${1:?usage: new-worktree.sh <branch-slug> [dest-path]}"
dest="${2:-}"

if [ -z "$dest" ]; then
  # Derive ../booking-platform.f-NNN from an f-NNN-* slug; fall back to a
  # sanitised slug for non-ticket branches (e.g. chore/foo -> chore-foo).
  if [[ "$branch" =~ ^(f-[0-9]+) ]]; then
    suffix="${BASH_REMATCH[1]}"
  else
    suffix="${branch//\//-}"
  fi
  dest="../booking-platform.${suffix}"
fi

if [ -e "$dest" ]; then
  echo "error: destination already exists: $dest" >&2
  exit 1
fi

# Resolve the primary worktree (first entry of `git worktree list`).
primary="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

git fetch origin
git worktree add -b "$branch" "$dest" origin/main

copied=0
for f in .env .env.local; do
  if [ -f "$primary/$f" ]; then
    cp "$primary/$f" "$dest/$f"
    echo "copied $f -> $dest/$f"
    copied=$((copied + 1))
  fi
done

if [ "$copied" -eq 0 ]; then
  echo "warning: no .env/.env.local found in primary worktree ($primary)" >&2
fi

echo "worktree ready: $dest (branch $branch)"
