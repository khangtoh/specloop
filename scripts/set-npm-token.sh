#!/usr/bin/env bash
#
# Store an npm publish token as the NPM_TOKEN Actions secret that the release
# workflow uses. Needs the GitHub CLI (gh), logged in with admin access to the
# repository, and npm to check the token first.
#
#   bash scripts/set-npm-token.sh                    # prompts; input is hidden
#   op read op://vault/npm/token | bash scripts/set-npm-token.sh   # or any pipe
#
# Options:
#   --repo owner/name   target repository (default: khangtoh/specloop)
#   --skip-verify       store without checking the token against npm
#
# The token never appears in arguments, the process list, files or output: it
# goes to npm through an environment placeholder in a temporary config, and to
# gh on standard input.

set -euo pipefail

REPO="khangtoh/specloop"
VERIFY=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo) [ "$#" -ge 2 ] || { echo "--repo needs owner/name" >&2; exit 2; }; REPO="$2"; shift 2 ;;
    --skip-verify) VERIFY=0; shift ;;
    -h|--help) sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null 2>&1 || { echo "gh is not installed: https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in. Run: gh auth login" >&2; exit 1; }
gh repo view "$REPO" --json name >/dev/null 2>&1 || { echo "gh cannot see $REPO. Check the name and your access." >&2; exit 1; }

if [ -t 0 ]; then
  printf 'npm token for %s (input hidden): ' "$REPO" >&2
  IFS= read -rs NPM_TOKEN
  echo >&2
else
  IFS= read -r NPM_TOKEN || true
fi
NPM_TOKEN="${NPM_TOKEN//[[:space:]]/}"
[ -n "$NPM_TOKEN" ] || { echo "No token given; nothing changed." >&2; exit 1; }
export NPM_TOKEN

if [ "$VERIFY" -eq 1 ]; then
  command -v npm >/dev/null 2>&1 || { echo "npm is not installed; rerun with --skip-verify to store without checking." >&2; exit 1; }
  config="$(mktemp -d)"
  trap 'rm -rf "$config"' EXIT
  printf '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n' > "$config/.npmrc"
  chmod 600 "$config/.npmrc"
  if ! user="$(NPM_CONFIG_USERCONFIG="$config/.npmrc" npm whoami --registry https://registry.npmjs.org 2>/dev/null)"; then
    echo "npm rejected the token (npm whoami failed); nothing changed. Check it was copied whole and has not expired." >&2
    exit 1
  fi
  echo "npm accepts the token for user: $user"
fi

printf '%s' "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo "$REPO"
unset NPM_TOKEN

if gh secret list --repo "$REPO" | grep -q '^NPM_TOKEN[[:space:]]'; then
  echo "NPM_TOKEN is set on $REPO. The next VERSION change on main can publish."
else
  echo "gh reported success, but NPM_TOKEN is not listed on $REPO. Check with: gh secret list --repo $REPO" >&2
  exit 1
fi
