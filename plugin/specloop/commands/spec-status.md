---
description: Report specloop phase status read straight from the spec checkboxes, in the mandatory handoff format.
argument-hint: "[phase number, or blank for all]"
---

Report the current spec status for this repository.

1. Run `specloop status` (and `specloop check`) to read live checkbox counts
   and surface any structural drift.
2. For each phase (or the one named in `$ARGUMENTS`), open the phase file and
   confirm the counts by reading the actual `- [x]` / `- [ ]` boxes — do not
   trust a prior report or commit message.
3. Produce the `Spec Summary/Status` section defined in
   `spec/spec-summary-status.md`: the `Phase | Scope | Progress | Status` table,
   the component/deliverable table when relevant, and the `Overall` /
   `Evidence` / `Change state` closing lines.
4. Name the next unchecked box (respecting phase order and `Depends on:`) so the
   next session can resume without re-deriving where it left off.

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
