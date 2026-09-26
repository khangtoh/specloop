---
description: Run the specloop loop — pick the next unchecked spec box, do it, verify, check it, hand off, commit, repeat.
argument-hint: "[phase number to focus on, or blank for next available]"
---

Compatibility alias for `/specloop loop [phase]` (Codex: `$specloop loop`).
Read `../skills/specloop/references/loop.md` relative to this command file and
follow it with `$ARGUMENTS` as the optional phase focus. This explicit alias
starts a run; it is not the bare skill menu.

## Decision reconciliation — every session

Before any work, including direct user requests outside `/spec-loop`, and after
resumption or compaction, read `spec/agent-session-ledger.md` and the relevant
authoritative specs. Compare incoming instructions with applicable decisions.
Follow instruction precedence: a clear user override of a project decision
needs no repeated permission; clarify genuinely ambiguous conflicts.

Before dependent implementation, append a dated entry to the existing ledger:

- **Previous decision:** what was decided and its source.
- **Conflicting instruction:** what changed and its source.
- **Resolution:** what survives, what is superseded, and why.
- **Scope and consequences:** affected requirements, tasks, and remaining work.

Then update the authoritative spec and add a supersession reference. Never
rewrite ledger history or undo completed historical checkboxes. Do not create
a separate decision ledger. Append a session entry for ordinary material work
or a meaningful resume point; read-only questions need no ledger churn.
In Plan Mode, review and describe pending reconciliation without mutating
project files; record the resolution when implementation is authorized.
Hooks remind and check file changes; semantic reconciliation remains the
agent's responsibility even when hooks are unavailable or a check passes.
