---
description: Scaffold the specloop spec/ structure into this repo and seed the first real phases from a stated goal.
argument-hint: "<one-sentence project goal>"
---

Set up specloop in this repository.

1. If `specloop` is available on PATH, run `specloop init`. Otherwise copy the
   plugin's `template/spec/` directory, `template/AGENTS.md`, and
   `template/.specloop.json` into the repo root (never overwrite an existing
   `AGENTS.md` — merge the specloop section into it instead).
2. Open `spec/README.md` and set the top `Goal:` line from `$ARGUMENTS` (ask
   the user for the goal if it's empty). Fill in the `Status` acceptance
   checkbox and the `Non-goals` section.
3. Decompose the goal into ordered phases. For each phase, copy
   `spec/_TEMPLATE-phase.md` to `spec/NN-title.md`, write its `Goal:` and
   `Depends on:` lines, and list its atomic tasks as `- [ ]` checkboxes — each
   completable and verifiable in one short sitting.
4. Replace the example phase (`spec/01-example-phase.md`) with your real
   Phase 01, and update the phase table in `spec/README.md` so every phase file
   has a row with the correct `checked/total` and status emoji.
5. Run `specloop check` and fix anything it reports until it exits clean.
6. Hand off with the `Spec Summary/Status` section from
   `spec/spec-summary-status.md`.

Do not start implementing tasks in this command — this only establishes the
spec. Use `/specloop loop` (Claude) or `$specloop loop` (Codex) to execute it.

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
