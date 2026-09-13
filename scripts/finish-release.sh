#!/usr/bin/env bash
#
# Complete a release whose version bump is already committed but whose publish
# did not go through (e.g. npm rejected the credential). Publishes the current
# package.json version, then tags and pushes — in that order, so a tag never
# points at an unpublished version.
#
#   bash scripts/finish-release.sh              # verify, publish, tag, push
#   bash scripts/finish-release.sh --skip-verify
#   bash scripts/finish-release.sh --otp 123456 # publish with a 2FA code
#
# Auth: npm requires two-factor authentication for direct publishing. Enable it
# at https://www.npmjs.com/settings/<user>/tfa and pass a fresh code with --otp.
# A one-time code expires in ~30s, so --otp implies --skip-verify; run the gates
# separately (bun run verify:onboarding) before reaching for the code.
# NPM_TOKEN=npm_xxx still works where a token is permitted to publish.

set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_VERIFY=""
OTP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-verify) SKIP_VERIFY=1; shift ;;
    --otp) OTP="${2:-}"; [ -n "$OTP" ] || { echo "✖ --otp needs a code" >&2; exit 1; }; shift 2 ;;
    --otp=*) OTP="${1#--otp=}"; shift ;;
    *) echo "✖ unknown argument: $1" >&2; exit 1 ;;
  esac
done

# A one-time code expires in about 30 seconds — the gates would outlive it.
if [ -n "$OTP" ] && [ -z "$SKIP_VERIFY" ]; then
  SKIP_VERIFY=1
  echo "note: --otp given, skipping the verify gates so the code does not expire mid-run."
fi

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
  PUBLISH_ARGS=()
  [ -n "$OTP" ] && PUBLISH_ARGS+=(--otp "$OTP")
  if [ -n "${NPM_TOKEN:-}" ]; then
    npm publish "${PUBLISH_ARGS[@]}" --//registry.npmjs.org/:_authToken="$NPM_TOKEN"
  else
    npm publish "${PUBLISH_ARGS[@]}"
  fi
fi

# 4. Tag + push (only once the version is actually on the registry) -----------
step "tag + push"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git tag "$TAG"
git push --follow-tags origin main

printf '\033[32m✔ released @khangtoh/specloop@%s and pushed %s\033[0m\n' "$VERSION" "$TAG"
