#!/usr/bin/env bash
# Resume the current version; never bump again or overwrite an existing release.
set -euo pipefail
exec node "$(dirname "$0")/release.mjs" finish "$@"
