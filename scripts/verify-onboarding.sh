#!/usr/bin/env bash
#
# End-to-end onboarding proof. Packs the tarball npm would publish, installs it
# into throwaway repositories, and asserts that a new project gets a working
# spec/ layout, node_modules, and the .claude/ agent assets — for both entry
# points: `init` (new repo) and `upgrade --apply` (migrating an existing one).
#
#   bash scripts/verify-onboarding.sh
#
# Exits nonzero on the first failed assertion. Leaves nothing behind.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

BOLD=$'\033[1m'; GRN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; RST=$'\033[0m'

PASS=0
FAIL=0
WORK="$(mktemp -d "${TMPDIR:-/tmp}/specloop-verify-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

step()  { printf '\n%s▶ %s%s\n' "$BOLD" "$1" "$RST"; }
ok()    { PASS=$((PASS + 1)); printf '  %s✔%s %s\n' "$GRN" "$RST" "$1"; }
bad()   { FAIL=$((FAIL + 1)); printf '  %s✖%s %s\n' "$RED" "$RST" "$1"; }

assert_file()    { [ -f "$1" ] && ok "${2:-$1}" || bad "${2:-$1} — missing file"; }
assert_dir()     { [ -d "$1" ] && ok "${2:-$1}" || bad "${2:-$1} — missing directory"; }
assert_absent()  { [ ! -e "$1" ] && ok "${2:-$1} absent" || bad "${2:-$1} — should not exist"; }
assert_same()    { cmp -s "$1" "$2" && ok "$3" || bad "$3 — content differs"; }

SKILLS=(list-spec prio-spec spec-upgrade specloop)
COMMANDS=(goal-check.md list-spec.md prio-spec.md spec-init.md spec-loop.md spec-status.md spec-upgrade.md)

# 1. Pack exactly what npm publish would upload -------------------------------
step "pack the publishable tarball"
TARBALL="$WORK/$(cd "$WORK" && npm pack "$ROOT" --silent)"
[ -f "$TARBALL" ] || { echo "npm pack produced no tarball" >&2; exit 1; }
printf '  %s%s%s\n' "$DIM" "$(basename "$TARBALL")" "$RST"

# The packaging risk this whole feature depends on: plugin/ must ship.
for s in "${SKILLS[@]}"; do
  tar -tzf "$TARBALL" | grep -qx "package/plugin/specloop/skills/$s/SKILL.md" \
    && ok "tarball ships skills/$s/SKILL.md" || bad "tarball is missing skills/$s/SKILL.md"
done
for c in "${COMMANDS[@]}"; do
  tar -tzf "$TARBALL" | grep -qx "package/plugin/specloop/commands/$c" \
    && ok "tarball ships commands/$c" || bad "tarball is missing commands/$c"
done

# 2. Scenario A: a brand-new repository ---------------------------------------
step "scenario A — new repo: bun add + bunx specloop init"
NEW="$WORK/new-repo"
mkdir -p "$NEW"
(
  cd "$NEW"
  git init --quiet
  git config user.email "verify@example.com"
  git config user.name "specloop verify"
  echo '{ "name": "new-repo", "private": true }' > package.json
  bun add -d "$TARBALL" --silent >/dev/null 2>&1
  bunx specloop init
) > "$WORK/init.log" 2>&1 || { echo "init failed:"; cat "$WORK/init.log"; exit 1; }
sed 's/^/  | /' "$WORK/init.log" | tail -25

step "scenario A — node_modules install"
assert_dir  "$NEW/node_modules/@khangtoh/specloop"       "package installed into node_modules"
assert_file "$NEW/node_modules/.bin/specloop"            "specloop binary linked into .bin"
assert_dir  "$NEW/node_modules/@khangtoh/specloop/plugin/specloop/skills" "installed package carries the skills"

step "scenario A — spec scaffold"
for f in README.md BACKLOG.md spec-summary-status.md goal-completion-check.md agent-session-ledger.md; do
  assert_file "$NEW/spec/$f" "spec/$f"
done
assert_file "$NEW/.specloop.json" ".specloop.json"
assert_file "$NEW/AGENTS.md"      "AGENTS.md"

step "scenario A — .claude/ agent assets"
PKG="$NEW/node_modules/@khangtoh/specloop/plugin/specloop"
for s in "${SKILLS[@]}"; do
  assert_file "$NEW/.claude/skills/$s/SKILL.md" ".claude/skills/$s/SKILL.md"
  assert_same "$NEW/.claude/skills/$s/SKILL.md" "$PKG/skills/$s/SKILL.md" ".claude/skills/$s/SKILL.md matches the package"
done
for c in "${COMMANDS[@]}"; do
  assert_file "$NEW/.claude/commands/$c" ".claude/commands/$c"
  assert_same "$NEW/.claude/commands/$c" "$PKG/commands/$c" ".claude/commands/$c matches the package"
done
grep -rq "CLAUDE_PLUGIN_ROOT" "$NEW/.claude" \
  && bad "installed assets reference CLAUDE_PLUGIN_ROOT (would break outside a plugin)" \
  || ok "installed assets are self-contained (no CLAUDE_PLUGIN_ROOT)"

step "scenario A — the structure validates"
if (cd "$NEW" && bunx specloop check) > "$WORK/check.log" 2>&1; then
  ok "specloop check exits 0"
else
  bad "specloop check failed"; sed 's/^/  | /' "$WORK/check.log"
fi
(cd "$NEW" && bunx specloop preflight) > "$WORK/preflight.log" 2>&1 \
  && printf '  %s(preflight exits 0)%s\n' "$DIM" "$RST" \
  || printf '  %s(preflight exits nonzero — informational, see log)%s\n' "$DIM" "$RST"

step "scenario A — re-running init is non-destructive"
echo "# edited by the project" > "$NEW/.claude/skills/specloop/SKILL.md"
(cd "$NEW" && bunx specloop init --force) >> "$WORK/init.log" 2>&1 || true
grep -q "edited by the project" "$NEW/.claude/skills/specloop/SKILL.md" \
  && bad "--force did not restore the edited skill" \
  || ok "--force restores an edited skill"

# 3. Scenario B: migrating an existing repository -----------------------------
step "scenario B — migrate: an existing ad-hoc spec repo, upgrade --apply"
OLD="$WORK/old-repo"
mkdir -p "$OLD/spec"
cat > "$OLD/spec/01-legacy.md" <<'PHASE'
# Phase 01 — Legacy work

Goal: prove an existing numbered spec is adopted without loss.

Depends on: None.

- [x] an already-finished task
- [ ] a task still open
PHASE
(
  cd "$OLD"
  git init --quiet
  git config user.email "verify@example.com"
  git config user.name "specloop verify"
  echo '{ "name": "old-repo", "private": true }' > package.json
  bun add -d "$TARBALL" --silent >/dev/null 2>&1
  bunx specloop upgrade --apply
) > "$WORK/upgrade.log" 2>&1 || { echo "upgrade failed:"; cat "$WORK/upgrade.log"; exit 1; }
sed 's/^/  | /' "$WORK/upgrade.log" | tail -20

grep -q "a task still open" "$OLD/spec/01-legacy.md" && ok "the pre-existing phase file is preserved" \
  || bad "upgrade damaged the pre-existing phase file"
for s in "${SKILLS[@]}"; do assert_file "$OLD/.claude/skills/$s/SKILL.md" "migrated .claude/skills/$s"; done
for c in "${COMMANDS[@]}"; do assert_file "$OLD/.claude/commands/$c" "migrated .claude/commands/$c"; done
assert_file "$OLD/spec/BACKLOG.md" "generated spec/BACKLOG.md"
if (cd "$OLD" && bunx specloop check) > "$WORK/check-old.log" 2>&1; then
  ok "migrated repo passes specloop check"
else
  bad "migrated repo fails specloop check"; sed 's/^/  | /' "$WORK/check-old.log"
fi

# 4. Scenario C: opting out ----------------------------------------------------
step "scenario C — --skills none opts out cleanly"
OPT="$WORK/opt-out"
mkdir -p "$OPT"
(cd "$OPT" && bun add -d "$TARBALL" --silent >/dev/null 2>&1; bunx specloop init --skills none) > "$WORK/optout.log" 2>&1
assert_file   "$OPT/spec/README.md" "spec/ still scaffolded"
assert_absent "$OPT/.claude"        ".claude/"

# 5. Verdict -------------------------------------------------------------------
printf '\n%s%d passed, %d failed%s\n' "$BOLD" "$PASS" "$FAIL" "$RST"
[ "$FAIL" -eq 0 ] || exit 1
printf '%s✔ onboarding verified end to end%s\n' "$GRN" "$RST"
