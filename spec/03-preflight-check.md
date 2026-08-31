# Phase 03 — `specloop preflight` workspace checks

Goal: the CLI validates the workspace before it selects any work — bare
`specloop` and `specloop preflight` run repo-root, Git, runtime, spec-state and
artifact checks, print one report table, and exit nonzero with an actionable
message when a check blocks — so missing Git setup or a missing clone source is
found before an agent run claims evidence it cannot produce.

Depends on: Phase 02 (`spec/specloop-run-state.md` — the record the spec-state
check reads; it must be treated as optional there and here).

<!--
  Decisions locked for this phase (approved by the user before authoring):
    - Bare `specloop` (no args) RUNS PREFLIGHT. This replaces today's
      print-help-and-exit-0 behavior and is a BREAKING CHANGE → ship as 0.4.0.
    - `specloop preflight` is the explicit form; both share one code path.
    - `specloop help`, `--help`, `-h` stay informational and run NO checks.
    - Preflight NEVER repairs. It prints the exact repair command (`git init`,
      `bun install`) and lets the user run it. No implicit `git init`.
  Three result levels, and they must stay distinct:
    pass    — continue
    warning — print, continue, exit 0
    blocked — print the failing command and cause, exit nonzero
  A check that cannot run (e.g. no git binary) is `blocked`, never `pass`.
-->

## A. CLI wiring (do first)

- [ ] (p1) Add `src/commands/preflight.ts` exporting `runPreflight(rootDir,
      opts)` returning a structured result (per-check status, message, repair
      command) plus the process exit code.
- [ ] (p1) Route `preflight` in `src/cli.ts` and change the no-argument branch
      from printing `HELP` to calling `runPreflight`.
- [ ] (p1) Keep `help`, `--help`, `-h`, `version`, `--version`, `-v` on their
      current paths, running zero checks.
- [ ] Support `--dir <path>` and `--json` on preflight, matching the
      `check`/`status` flag conventions.
- [ ] Add `preflight` to the `HELP` text, and note there that bare `specloop`
      runs it.

## B. The five checks

- [ ] (p1) **Repository root:** verify `AGENTS.md`, `spec/README.md`,
      `spec/BACKLOG.md` and the package manifest exist, and run the existing
      validator; a `specloop check` error is a blocked preflight.
- [ ] (p1) **Git:** run `git rev-parse --is-inside-work-tree`; report the
      branch, working-tree cleanliness, `user.name`/`user.email`, and whether
      an `origin` remote exists. Not a repo → blocked, with `git init` printed
      as the repair, not executed.
- [ ] (p1) **Git, clean-clone goals:** when the goal acceptance path needs
      clean-clone proof, a missing `origin` remote is blocked, not a warning —
      the run cannot produce that evidence.
- [ ] **Runtime:** verify the Bun version against `engines.bun`, verify
      dependencies are installed, and run the documented typecheck/test
      commands. Distinguish a cache/environment failure from a project failure
      in the reported cause.
- [ ] **Spec state:** parse the backlog, phase index, ledger and (optional) run
      state; recount checkboxes from the files and report the goal acceptance
      path plus the phases still between here and it.
- [ ] **Artifacts:** verify the spec and output locations are writable and
      report their tracked/ignored policy against `.gitignore`.

## C. Report and exit behavior

- [ ] (p1) Render the report as one markdown table — `Check | Result | Action`
      — with a concrete command or named decision in every non-pass Action
      cell. An empty Action on a failure is a bug.
- [ ] (p1) Exit 0 when every check passes or only warns; exit nonzero on the
      first blocked check, naming the exact failing command and its cause.
- [ ] Emit the same data under `--json` (stable keys: check id, status,
      message, action), so an agent can consume it without parsing the table.
- [ ] Define and document what a healthy preflight does next: bare `specloop`
      continues into the existing flow (print status + the next box); an
      explicit `specloop preflight` reports and stops.

## D. Tests

- [ ] (p1) Test: a fully healthy fixture passes all checks and exits 0.
- [ ] (p1) Test: a fixture that is not a Git repo is blocked, exits nonzero,
      and the output contains `git init` — and the fixture is still not a repo
      afterward (proves preflight never repairs).
- [ ] (p1) Test: `specloop help` and `--help` run no checks — assert on a
      fixture broken enough that any check would block, and confirm exit 0 and
      help output.
- [ ] Test: bare `specloop` in a broken fixture exits nonzero (guards the
      breaking change against a regression back to help-on-no-args).
- [ ] Test: missing `origin` is a warning for an ordinary goal and blocked for
      a clean-clone goal.
- [ ] Test: a fixture with no `spec/specloop-run-state.md` still passes the
      spec-state check (the record stays optional).
- [ ] Test: `--json` output parses and carries one entry per check with the
      documented keys.
- [ ] Test: the spec-state check's recounted checkbox totals match the
      validator's counts on the same fixture.

## E. Documentation and release

- [ ] Document `specloop preflight` in the root `README.md`, including the
      changed bare-`specloop` behavior and the three result levels.
- [ ] Write the 0.4.0 release note calling out the breaking change: bare
      `specloop` no longer prints help; use `specloop help`.
- [ ] Update `AGENTS.md` to describe only the resulting user-facing contract —
      the check list itself lives in the CLI and its help, not in the
      repository instructions.

## Findings / Results

<!--
  Record the exact commands and their output for each blocked/pass fixture.
  The breaking change needs before/after evidence of both bare `specloop` and
  `specloop help` on the same fixture.
-->

- _2026-08-31_ — Phase authored from `specloop-tasks/bootstrap-preflight-check.md`.
  Prior state: no preflight code anywhere in `src/`; bare `specloop` printed
  `HELP` and exited 0 (`src/cli.ts` no-argument branch). Bare-`specloop`-runs-
  preflight plus a `preflight` subcommand was chosen over keeping help on the
  no-arg path, so the plan's "before it prints/selects work" requirement is
  actually enforced.
