# Phase 01 — Verify the `upgrade` command

Goal: an automated test suite (plus one manual agent check) that proves
`specloop upgrade` correctly detects existing spec models and adopts them into
specloop **non-destructively and idempotently** — so a user can point it at any
project without fear of losing spec content.

Depends on: specloop 0.3.0 shipped (`upgrade` repurposed to adoption/migration,
BACKLOG + validator rules landed).

<!--
  Verifies three surfaces with very different testability:
    detect()      — pure/deterministic → unit tests
    --apply       — filesystem writes → integration tests on temp dirs
    /spec-upgrade — agent judgment → one manual check (task H)
  Safety (Section D) is the property that matters most; do it first.
  New tests live in tests/upgrade.test.ts unless noted.
-->

## D. Safety — non-destructive & idempotent (do first)

- [x] (p1) Test: `upgrade --apply` never overwrites an existing `AGENTS.md`,
      process file, `BACKLOG.md`, or `.specloop.json` (seed them with sentinel
      content; assert unchanged + "kept" reported).
- [x] (p1) Test: existing `spec/NN-*.md` files are byte-identical before/after
      `--apply` (hash every phase file pre/post).
- [x] (p1) Test: idempotency — a second `upgrade --apply` reports "nothing to
      adopt" and writes nothing (before/after snapshot identical).
- [x] Test: on a git-init'd fixture, `git status --porcelain` after `--apply`
      shows only additions (`??`), zero modifications (` M`) to tracked files.

## A. Detection correctness (unit)

- [x] Test: project with the 3 process files → `detect().model === "specloop"`.
- [x] Test: Goal/Depends + `- [ ]` tasks, no process files → `"dillinger-like"`.
- [x] Test: `## Summary/Problem/Scope` (+/- BACKLOG), no Goal/Depends →
      `"omarchy-like"`.
- [x] Test: numbered specs with none of those signals → `"ad-hoc"`.
- [x] Test: no `spec/`, `docs/specs/`, `specs/` dir → `"none"`, exit 0.
- [x] Test: spec-dir resolution reports the correct dir for each of `spec/`,
      `docs/specs/`, `specs/`.
- [x] Test: every structural flag (`numbered`, `hasTasks`, `hasGoalDepends`,
      `hasPrdSections`, `hasBacklog`, `hasProcessFiles`, `hasAgents`) matches a
      hand-built fixture.

## B. Dry-run behavior (integration)

- [x] Test: the printed plan lists exactly the missing pieces — no more, no fewer.
- [x] Test: a complete specloop layout reports "nothing to adopt" (empty plan).
- [x] Test: the PRD re-authoring note appears only for omarchy-like / PRD inputs.
- [x] (p1) Test: a plain `upgrade` (no `--apply`) writes nothing — dir snapshot
      byte-identical before/after.

## C. `--apply` correctness (integration)

- [ ] Test: missing process files are created with content equal to the template.
- [ ] Test: generated `BACKLOG.md` lists all numbered specs in numeric order,
      titles cleaned (no `01 01 Foo` duplication; `2FA setup` not over-stripped).
- [ ] Test: `.specloop.json` is written with the detected `specDir` (e.g.
      `docs/specs`, not a hard-coded `spec`).
- [ ] Test: `AGENTS.md` is added when absent.
- [ ] Test: post-apply `specloop check` is clean for dillinger-like input and
      reports the expected re-authoring gaps (e.g. `missing-goal`) for PRD/ad-hoc
      input — i.e. the gaps are correct, not a defect.

## E. Edge cases (integration)

- [ ] Test: empty spec dir (exists, no numbered files) → `"none"`, no crash.
- [ ] Test: mixed models (some dillinger-like, some PRD) classify by the priority
      rule; BACKLOG still lists every phase.
- [ ] Test: a spec dir that already has `BACKLOG.md` is not regenerated (kept).
- [ ] Test: odd H1s (`# 2FA setup`, `# Phase 3: Foo`, `# 03 — Bar`) → `phaseTitle`
      output is correct with no over-stripping.

## F. Real-repo end-to-end (integration, on copies)

- [ ] Test: copy a dillinger-style spec fixture → `--apply` → BACKLOG lists all
      phases in order → `check` clean. (Use a checked-in fixture, not a path
      outside the repo, so CI is hermetic.)
- [ ] Test: copy an omarchy-style fixture → `--apply` → process files + BACKLOG
      added → `check` reports PRD gaps (expected) → original fixture files
      untouched.

## G. Semantic step `/spec-upgrade` (manual / agent)

- [ ] Manual: on an omarchy-style copy, run `/spec-upgrade`; confirm the agent
      adds `Goal:`/`Depends on:` + `- [ ]` tasks from Acceptance Criteria for 2
      specs and `specloop check` gets greener. Record the before/after in Findings.

## H. Regression

- [ ] Test: full `bun test` stays green; `init`/`check`/`status`/`list-spec`/
      `prio-spec`/`prio-task` behavior unchanged.

## Findings / Results

- _2026-08-23_ — Phase written. Verification is currently ad-hoc (manual smoke
  tests during 0.3.0 build only); this phase makes it a durable, CI-gating suite.
  Task counts and models to date: `upgrade` dry-run + `--apply` smoke-tested by
  hand against dillinger-aws (`specloop`) and omarchy (`omarchy-like`) during the
  0.3.0 session; no automated `upgrade` tests existed yet.
- _2026-08-23_ — Added `tests/upgrade.test.ts`: sentinels for all protected
  adoption files remain byte-identical after `upgrade --apply`, and each is reported kept.
- _2026-08-23_ — Added `tests/upgrade-phases.test.ts`: SHA-256 snapshots prove every
  pre-existing numbered phase file is byte-identical across `upgrade --apply`.
- _2026-08-23_ — Added `tests/upgrade-idempotency.test.ts`: a full file-tree SHA-256
  snapshot remains identical after the second `upgrade --apply`, which reports nothing to adopt.
- _2026-08-23_ — Added `tests/upgrade-git.test.ts`: a committed fixture reports only
  untracked additions after adoption; its tracked phase remains untouched.
