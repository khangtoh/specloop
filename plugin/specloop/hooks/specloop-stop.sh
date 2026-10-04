#!/bin/sh
# specloop Stop hook — the deterministic half of the /goal integration.
#
# A host /goal evaluator can only read the transcript; this hook reads the spec
# files, so "is it done?" is answered by counting checkboxes. It blocks the turn
# from ending while an active specloop run still has eligible unchecked boxes.
#
# It is inert unless spec/specloop-run-state.md records `Run status: active`.
# A plugin's hooks fire in every session once the plugin is enabled, so staying
# silent by default is the point — arm it with `specloop goal --start`.
set -u

INPUT=$(cat)

# No CLI, no opinion. Install it with `bun add -g @khangtoh/specloop`.
command -v specloop >/dev/null 2>&1 || exit 0

printf '%s' "$INPUT" | specloop stop-hook 2>/dev/null || exit 0
