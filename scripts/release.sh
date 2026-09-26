#!/usr/bin/env bash
# Verify, bump synchronized manifests, publish one verified artifact, record and push.
set -euo pipefail
exec node "$(dirname "$0")/release.mjs" release "$@"
