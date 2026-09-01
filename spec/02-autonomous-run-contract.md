# Phase 02 — Autonomous `specloop` run contract

Goal: the exact `specloop` message reliably starts or resumes an autonomous run
that spans every eligible phase until the goal's acceptance checkbox is checked
with recorded evidence — backed by a durable resume record, an unambiguous
alias/stop policy, and tests that fail if the contract is edited away.

Depends on: the `specloop` execution-command section in `AGENTS.md` (landed in
0.3.1). No external dependency.

<!--
  Honesty about testability (same split as Phase 01):
    run-state file + scaffolding + config  → filesystem/unit tests
    contract clauses in AGENTS.md/README   → doc-contract tests (assert the
                                             normative clauses are present, so
                                             a future edit can't silently drop
                                             the "don't stop at a phase" rule)
    actual agent continuation/stop behavior → NOT unit-testable; covered by the
                                             manual checklist fixture in E
  Do not claim the agent-behavior tasks are automated. Record the transcript
  evidence in Findings instead.

  Design decisions locked for this phase (do not re-litigate mid-run):
    - `spec/specloop-run-state.md` is OPTIONAL, never added to
      `requiredProcessFiles`. Making it required would fail `specloop check`
      in every project already on specloop. It is scaffolded by `init` and
      offered by `upgrade --apply`.
    - The record is ADVISORY. Completion is always derived from checkboxes.
      A stale or missing run-state file must never change a done-state.
    - `specloop start` / `specloop run` / `specloop go` are NOT run triggers.
      Only the exact, unadorned message `specloop` starts or resumes a run.
-->

## A. Durable run-state record (do first)

- [x] (p1) Add `template/spec/specloop-run-state.md` with a fixed field block:
      run status (`idle` / `active` / `blocked`), stated goal, goal acceptance
      checkbox (file + exact text), current phase, current task, resume point,
      and last-updated date. Include a header comment stating the record is
      advisory and that done-state is always derived from checkboxes.
- [x] (p1) Add `spec/specloop-run-state.md` to this repo, seeded from the
      template and reflecting the run that authors this phase.
- [x] (p1) Scaffold the record in `src/commands/init.ts` so `specloop init`
      writes it alongside the other process files.
- [x] Offer the record in `src/commands/upgrade.ts` `--apply` as a
      non-destructive addition (created when absent, reported "kept" when
      present) — never overwriting an existing file.
- [x] Confirm the record stays OUT of `requiredProcessFiles` in both
      `.specloop.json` and `template/.specloop.json`, and that `specloop check`
      is green in a project that has no run-state file. Record the check output.

## B. Command contract — close the open questions

- [x] (p1) Extend `AGENTS.md`'s `specloop` execution-command section with the
      alias policy: only the exact message `specloop` triggers a run;
      `specloop start`, `specloop run`, and `specloop go` are explicitly NOT
      triggers and should be answered by asking the user to confirm.
- [x] (p1) State the run-state update duty in `AGENTS.md`: write the record
      when a run starts, after each completed task, and when a run pauses,
      blocks, or ends — and that the record is advisory, not evidence.
- [x] Add explicit stop/interrupt semantics to `AGENTS.md`: a direct user
      instruction supersedes the run immediately; a status question gets a
      concise status answer and the run continues; a blocker must name the
      missing decision or external state and leave a resume point.
- [x] Add the anti-premature-stop clause verbatim: never claim completion
      because of elapsed time, token budget, a checked box, or a phase
      boundary — only the terminal conditions end a run.

## C. Doc-contract tests

- [x] (p1) Test (`tests/run-contract.test.ts`): `AGENTS.md` contains the exact
      `specloop` trigger clause, the goal-run vs standard-run split, and the
      three terminal conditions.
- [x] (p1) Test: `AGENTS.md` contains the "do not stop at a task or phase
      boundary" clause and the alias-rejection clause. This test is the guard
      against a future edit quietly deleting the autonomy contract.
- [x] Test: `AGENTS.md` and the root `README.md` agree that `specloop help` is
      informational and does not start a run.
- [x] Test: the run-state template parses — every required field label is
      present exactly once and the advisory disclaimer is included.

## D. Scaffolding tests

- [x] (p1) Test: `specloop init` on a temp dir writes `spec/specloop-run-state.md`
      and the result passes `specloop check`.
- [x] Test: `upgrade --apply` creates the run-state file when absent and leaves
      a sentinel-seeded existing one byte-identical (extend the Phase 01
      protected-file pattern in `tests/upgrade.test.ts`).
- [x] Test: `specloop check` is green on a fixture project that has every other
      process file but no run-state file (proves it stayed optional).

## E. Manual agent-behavior checklist (not unit-testable)

- [x] Manual: send exactly `specloop` in a session with an active goal; confirm
      it selects the goal acceptance checkbox in `spec/README.md`, not a single
      task. Record the transcript excerpt in Findings.
- [x] Manual: drive a phase to 100% and confirm the run immediately begins the
      next eligible BACKLOG phase without waiting for a new `specloop` message.
- [x] Manual: send `specloop help`; confirm it answers with help and starts no
      run.
- [x] Manual: send a stop instruction mid-run; confirm work halts and the
      run-state record holds a usable resume point.

## F. Documentation

- [x] Expand the root `README.md` autonomous-command paragraph into its own
      subsection: the exact command, what it authorizes, the terminal
      conditions, how to stop it, the rejected aliases, and the explicit note
      that this is an agent-session command — `specloop` in a shell is the CLI.
- [x] Note the run-state record in the `specloop check` / process-file
      documentation as an optional, advisory file.

## Findings / Results

<!--
  Record: the check/test output proving each automated task, and the transcript
  excerpts backing every Section E manual task. Manual tasks are closed by
  recorded evidence, never by assertion.
-->

- _2026-09-01_ — Manual E2 evidence: after the final Phase 02 manual checkbox was closed in this resumed goal run, the agent immediately selected the next eligible BACKLOG phase, Phase 03, without waiting for another `specloop` message.

- _2026-09-01_ — Manual E4 evidence: during the active goal run, user sent “stop the specloop run now”; work halted immediately and the advisory record below preserves the resume point.

- _2026-09-01_ — Manual E3 evidence: user sent `specloop help`; the response was informational only and no run work or state change occurred.

- _2026-09-01_ — Manual E1 evidence: user stated the goal “specloop’s commands are covered by an automated verification suite,” which maps to `spec/README.md`’s acceptance checkbox, then sent exactly `specloop`; this goal run selected that acceptance path.

- _2026-08-31_ — Implemented Sections A–D and F: advisory run-state template and self-hosted record; `init` scaffolding; non-destructive `upgrade --apply`; contract/scaffold tests; and user documentation. Evidence: `bun test` 53 pass / 0 fail and `bun run check:self` clean. `bun run typecheck` is blocked by the local environment missing the Bun type definition (`TS2688`), not by a source diagnostic.

- _2026-08-31_ — Phase authored. Prior state: the `specloop` execution-command
  contract existed in `AGENTS.md:47` and a one-paragraph summary in
  `README.md:116`; no run-state record, no alias policy, and no tests guarding
  the contract. Baseline green: `specloop check --dir .` clean (1 phase, 28/28),
  `bun test` 46 pass / 0 fail.
