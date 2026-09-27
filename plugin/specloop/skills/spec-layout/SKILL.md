---
name: spec-layout
description: Recommend flat vs. grouped (folder of sub-specs) layout for a specloop project's phases, and move a phase into a folder. Use when the user asks about spec layout, splitting a big phase, grouping sub-specs, or runs spec-layout.
argument-hint: "[NN]"
---

# spec-layout

Help the user pick the right layout for their phases. A phase is either a flat
file (`spec/NN-slug.md`, the default) or a folder (`spec/NN-slug/README.md` root
with `Goal:`/`Depends on:`, plus `NNa-*.md`, `NNb-*.md` sub-specs). Both count
the same; a folder's progress is the sum of its files and its number never
changes, so `BACKLOG.md` is untouched.

1. Run `specloop layout`. Summarize its advice in plain language: which phases
   it would group (and into which sub-specs), which small groups it would
   flatten, and that everything else should stay as is. Grouping suits a big
   unfinished phase with independent sections — especially when several agents
   will work on it in parallel. Don't push a change the user has no need for.
2. If the user names a phase `NN` (or the user picks one), run
   `specloop group NN` (dry run) and show the plan: the new folder, each
   sub-spec with its task counts, the links that will be rewritten, and any
   files that still mention the old path.
3. Only after the user confirms, run `specloop group NN --apply` (add
   `--no-split` if they want the folder without splitting). Then update the
   files the command listed as still mentioning the old path, run
   `specloop check`, and fix the index row if it reports a mismatch.
4. Flattening a group is manual: concatenate the sub-specs' task sections back
   into `spec/NN-slug.md` under their headings, delete the folder, fix links,
   and run `specloop check`.

If the `specloop` CLI isn't available, apply the same rules by reading the
phase files directly: suggest grouping an unfinished flat phase with more than
40 tasks, or more than 25 tasks across three or more `##` sections of at least
three tasks each.

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
