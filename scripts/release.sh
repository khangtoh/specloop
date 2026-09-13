#!/usr/bin/env bash
#
# One-step release: verify → bump → publish → commit+tag → push.
#
#   bun run release [patch|minor|major]   (default: patch)
#   bun run release minor --dry           (do everything except publish/commit/push)
#
# Safe by construction: it verifies the build BEFORE bumping, bumps package.json
# WITHOUT touching git until the publish succeeds, and only then commits, tags,
# and pushes — so a failed publish never leaves a tagged, unpublished version.

set -euo pipefail

BUMP="${1:-patch}"
DRY=""
[ "${2:-}" = "--dry" ] && DRY=1
[ "${1:-}" = "--dry" ] && { DRY=1; BUMP="patch"; }

case "$BUMP" in
  patch|minor|major) ;;
  *) echo "usage: bun run release [patch|minor|major] [--dry]" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

step() { printf '\033[1m▶ %s\033[0m\n' "$1"; }

# 1. Preconditions ----------------------------------------------------------
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || { echo "✖ release must run on 'main' (currently on '$branch')" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✖ working tree not clean — commit or stash first" >&2; exit 1; }

CUR="$(node -p "require('./package.json').version" 2>/dev/null || bun -e "console.log(require('./package.json').version)")"
step "releasing from $CUR ($BUMP bump${DRY:+, DRY RUN})"

# 2. Verify (never publish a broken build) ----------------------------------
step "bun test";            bun test
step "check template";      bun run bin/specloop.ts check --dir template
step "check self-spec";     bun run bin/specloop.ts check --dir .
step "verify onboarding";   bash scripts/verify-onboarding.sh
if [ -d node_modules ]; then step "typecheck"; bun run typecheck; else echo "  (skipping typecheck — no node_modules)"; fi

# 3. Bump package.json only (no git yet) ------------------------------------
NEW="$(npm version "$BUMP" --no-git-tag-version)"   # prints e.g. v0.3.1
step "bumped $CUR → $NEW"

if [ -n "$DRY" ]; then
  step "DRY RUN — reverting bump, not publishing"
  git checkout -- package.json
  echo "✔ dry run OK. Would publish $NEW and push a 'release: $NEW' commit + tag."
  exit 0
fi

# 4. Publish to npm ---------------------------------------------------------
step "npm publish"
npm publish

# 5. Commit + tag + push (only after a successful publish) ------------------
step "commit + tag + push"
git add package.json
git commit -m "release: $NEW"
git tag "$NEW"
git push --follow-tags origin main

step "done"
echo "✔ published @khangtoh/specloop@${NEW#v} and pushed $NEW"
