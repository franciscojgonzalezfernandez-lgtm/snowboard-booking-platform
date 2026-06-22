#!/usr/bin/env bash
#
# restore-claude-setup.sh — one-shot restore of Javi's Claude Code setup after a reformat.
#
# WHY THIS FILE EXISTS: when this machine was reformatted there was NO manifest of
# which skills/plugins were installed or where they came from, so nothing could be
# auto-restored. This script IS that manifest, and it is runnable. Re-run it on any
# fresh machine after installing the `claude` CLI + Node.js.
#
# Idempotent: safe to re-run. Backs up existing ~/.claude/{settings.json,CLAUDE.md} to *.bak.
#
# Usage:   bash scripts/restore-claude-setup.sh
#
# ─────────────────────────────────────────────────────────────────────────────
# MANIFEST  (skill/plugin → source → mechanism)
#
#   PLUGINS (claude plugin marketplace add + install)
#     caveman               JuliusBrussee/caveman                 token-saver + cavecrew-{investigator,builder,reviewer}
#     playwright-skill      lackeyjb/playwright-skill             on-the-fly browser automation
#     ui-ux-pro-max         nextlevelbuilder/ui-ux-pro-max-skill  design intelligence
#     playwright (MCP)      anthropics/claude-plugins-official    Microsoft Playwright MCP (drive browser, gen tests)
#
#   GLOBAL SKILLS (npx skills add … -g)
#     prisma-database-setup / prisma-client-api / prisma-postgres   prisma/skills (official)
#     vercel-react-best-practices                                   vercel-labs/agent-skills (official)
#     design-taste-frontend / high-end-visual-design /
#       imagegen-frontend-web / imagegen-frontend-mobile            Leonxlnx/taste-skill
#     huashu-design                                                 alchaincyf/huashu-design
#     nextjs-app-router-patterns                                    mileson/agent-skills
#     next-intl-add-language / playwright-generate-test             github/awesome-copilot
#     impeccable                                                    pbakaus/impeccable  (own installer: npx impeccable install)
#
#   SUBSTITUTES (the original exact-name skill had no findable source; closest popular match used)
#     mastering-typescript   SpillwaveSolutions/mastering-typescript-skill   (was: typescript-advanced-types)
#     playwright-core        testdino-hq/playwright-skill/core               (was: playwright-testing)
#     webapp-testing         anthropics/skills                               (was: testing-strategy)
#
#   PROJECT SKILLS — NOT installed here; they live in THIS repo under .agents/skills/
#   (symlinked into .claude/skills/ + .kiro/skills/) and travel with a git clone:
#     stripe-best-practices, stripe-projects, upgrade-stripe, booking-platform-perf, shadcn
#
#   CONFIG: ~/.claude/CLAUDE.md (always English) + ~/.claude/settings.json
#           (model=opus, effort=xhigh, theme=dark, caveman default mode=full)
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail
log(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

command -v claude >/dev/null || { echo "Install the Claude Code CLI first."; exit 1; }
command -v node   >/dev/null || { echo "Install Node.js first."; exit 1; }

# 1) GLOBAL CONFIG ────────────────────────────────────────────────────────────
log "global ~/.claude/CLAUDE.md (always English)"
mkdir -p ~/.claude
[ -f ~/.claude/CLAUDE.md ] && cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak
cat > ~/.claude/CLAUDE.md <<'EOF'
# Global user instructions (Javi)

## Language
- **Always respond in English**, regardless of the language I write in. I often write prompts in Spanish, but I want all of your responses, summaries, commit messages, and PR descriptions in English.
EOF

log "global ~/.claude/settings.json (plugins/marketplaces get added below)"
[ -f ~/.claude/settings.json ] && cp ~/.claude/settings.json ~/.claude/settings.json.bak
cat > ~/.claude/settings.json <<'EOF'
{
  "model": "opus",
  "env": {
    "CAVEMAN_DEFAULT_MODE": "full"
  },
  "effortLevel": "xhigh",
  "skipDangerousModePermissionPrompt": true,
  "theme": "dark"
}
EOF

# 2) PLUGINS ───────────────────────────────────────────────────────────────────
log "plugins (marketplaces + install)"
claude plugin marketplace add JuliusBrussee/caveman            || true
claude plugin marketplace add lackeyjb/playwright-skill        || true
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill || true
claude plugin install caveman@caveman                          || true
claude plugin install playwright-skill@playwright-skill        || true
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill        || true
claude plugin install playwright@claude-plugins-official       || true

# 3) GLOBAL SKILLS ─────────────────────────────────────────────────────────────
log "global skills (npx skills add)"
add(){ npx -y skills add "$1" -g -y --skill "$2" || true; }   # repo  skill
add prisma/skills           prisma-database-setup
add prisma/skills           prisma-client-api
add prisma/skills           prisma-postgres
add vercel-labs/agent-skills vercel-react-best-practices
add Leonxlnx/taste-skill    design-taste-frontend
add Leonxlnx/taste-skill    high-end-visual-design
add Leonxlnx/taste-skill    imagegen-frontend-web
add Leonxlnx/taste-skill    imagegen-frontend-mobile
add alchaincyf/huashu-design huashu-design
add mileson/agent-skills    nextjs-app-router-patterns
add github/awesome-copilot  next-intl-add-language
add github/awesome-copilot  playwright-generate-test
# substitutes
add SpillwaveSolutions/mastering-typescript-skill '*'
npx -y skills add testdino-hq/playwright-skill/core -g -y --skill '*' || true
add anthropics/skills       webapp-testing

# 4) IMPECCABLE (own installer, installs into ~/.claude globally) ───────────────
log "impeccable"
npx -y impeccable install || true

# 5) PROJECT TOOLING (run from inside the repo) ────────────────────────────────
log "project Playwright browsers"
( cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" && npx playwright install chromium ) || true

cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
DONE. Next:
  • RESTART Claude Code so plugins/skills load. caveman auto-activates every
    session (SessionStart hook, mode "full"); say "stop caveman" to pause it,
    or /caveman lite|ultra|wenyan to change level.
  • Run  /impeccable init  inside the repo to seed design context.
  • Project skills (stripe-*, booking-platform-perf, shadcn) are already present
    via the git clone — nothing to install.
  • 3 skills are SUBSTITUTES (mastering-typescript, playwright-core,
    webapp-testing); swap if you find the exact originals.
────────────────────────────────────────────────────────────────────────────
EOF
