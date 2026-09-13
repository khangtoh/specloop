#!/usr/bin/env bash
#
# Complete a release whose version bump is already committed but whose publish
# did not go through (e.g. npm rejected the credential). Publishes the current
# package.json version, then tags and pushes — in that order, so a tag never
# points at an unpublished version.
#
#   bash scripts/finish-release.sh              # verify, publish, tag, push
#   bash scripts/finish-release.sh --skip-verify
#
# Auth: needs a granular npm token with "bypass 2FA" and read/write on the
# package. Either put it in ~/.npmrc or pass it for one run:
#   NPM_TOKEN=npm_xxx bash scripts/finish-release.sh

set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_VERIFY=""
[ "${1:-}" = "--skip-verify" ] && SKIP_VERIFY=1

step() { printf '\033[1m▶ %s\033[0m\n' "$1"; }

VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"

# 1. Preconditions ------------------------------------------------------------
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || { echo "✖ must run on 'main' (currently '$branch')" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✖ working tree not clean" >&2; exit 1; }

PUBLISHED="$(npm view "@khangtoh/specloop@$VERSION" version 2>/dev/null || true)"
if [ -n "$PUBLISHED" ]; then
  echo "✔ $VERSION is already on npm — skipping publish, will tag and push only."
else
  # 2. Verify -----------------------------------------------------------------
  if [ -z "$SKIP_VERIFY" ]; then
    step "bun test";            bun test
    step "check template";      bun run bin/specloop.ts check --dir template
    step "check self-spec";     bun run bin/specloop.ts check --dir .
    step "verify onboarding";   bash scripts/verify-onboarding.sh
  fi

  # 3. Publish ----------------------------------------------------------------
  step "npm publish $VERSION"
  if [ -n "${NPM_TOKEN:-}" ]; then
    npm publish --//registry.npmjs.org/:_authToken="$NPM_TOKEN"
  else
    npm publish
  fi
fi

# 4. Tag + push (only once the version is actually on the registry) -----------
step "tag + push"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git tag "$TAG"
git push --follow-tags origin main

printf '\033[32m✔ released @khangtoh/specloop@%s and pushed %s\033[0m\n' "$VERSION" "$TAG"
