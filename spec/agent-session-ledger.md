# Agent Session Ledger

Next task: Phase 01 git-status safety test.

A running record of what an agent session actually did on this repo —
decisions made, state changed, automation left running — so the next
session (human or agent) can resume without re-deriving context or
re-litigating settled calls. Append a new dated entry per session; never
rewrite history in an earlier entry (if something changes, add a note,
don't edit the old record).

This is a log, not a spec. Requirements and task checklists live in
`spec/*.md`; this file is "what happened and why," cross-referencing
those files rather than duplicating their content.

Read this first when resuming after a break; append a new entry when
closing one out.

---

## Session: YYYY-MM-DD (branch `<branch>`)

### Scope of this session

<What this session set out to do, and against what starting state.>

### What got done, in order

1. <Action, with the phase/task it maps to and how it was verified.>
2. <Decision made and why; link the spec section that records it.>

### State left running / open

<Anything still deploying, any blocker handed to the next session, the
next unchecked box to pick up.>

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's first p1 non-overwrite safety test.

### What got done, in order

1. Added the protected-file sentinel test and the `upgrade --apply` kept-file report.
2. Verified the focused test and `specloop check --dir .`.

### State left running / open

Next task: Phase 01 p1 phase-file byte-identity test.

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's second p1 phase-file byte-identity safety test.

### What got done, in order

1. Added SHA-256 pre/post verification for multiple numbered phase files, including CRLF content.
2. Verified the focused test and `specloop check --dir .`.

### State left running / open

Next task: Phase 01 p1 idempotency test.

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's third p1 idempotency test.

### What got done, in order

1. Added a recursive file-tree SHA-256 snapshot around the second `upgrade --apply`.
2. Verified it reports nothing to adopt and preserves the snapshot.

### State left running / open

Next task: Phase 01 git-status safety test.

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Define `specloop` autonomous execution scope.

### What got done, in order

1. Added goal-run and standard-run semantics to repository and template instructions.
2. Documented the same behavior in the public README.


### State left running / open


---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's git-status adoption safety test.

### What got done, in order

1. Added a committed git fixture and verified adoption produces only untracked additions.
2. Ran the focused test and structural validation.

### State left running / open

Next task: Phase 01 git-status safety test.


---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Autonomously complete Phase 01, the upgrade verification suite.

### What got done, in order

1. Completed safety, detection, dry-run, apply, edge-case, and hermetic fixture coverage for `upgrade`.
2. Performed the two-PRD semantic re-authoring check and ran the full regression command.
3. Reconciled Phase 01 to 28/28 and validated the self-hosted spec structure.

### State left running / open

Phase 01 is complete. The repository-wide command-coverage goal remains open for future phases.


---

## Session: 2026-08-23 (branch `main`) — completion audit

### Scope of this session

Independently verify that Phase 01's 28 checked boxes reflect real,
passing implementation (not inference), then two follow-ups: fix a cosmetic
test nit and record the audit.

### What got done, in order

1. Ran goal-completion-check against Phase 01: `bun test` 46 pass / 0 fail /
   0 skipped; `specloop check --dir .` clean (28/28, index consistent).
2. Spot-read the highest-risk tests (D safety, A detection, B dry-run, C
   apply-validation) and confirmed substantive assertions, not tautologies.
   Verdict recorded in the phase Findings: **MET, no over-claim**.
3. Fixed import order in `tests/upgrade-git.test.ts` (cosmetic; behavior
   unchanged, suite still 46/46).

### State left running / open

Phase 01 verified complete. The repo-wide command-coverage goal in
`spec/README.md` stays open — next phases would verify the other commands
(`init`, `check`, `status`, `list-spec`, `prio-spec`, `prio-task`).


---

## Session: 2026-08-31 (branch `main`) — plan intake: Phases 02 and 03

### Scope of this session

Turn the two plans in `specloop-tasks/` (authored outside this repo) into
specloop phases. Authoring only — no implementation code was written.

### What got done, in order

1. Audited both plans against the repo. `autonomous-specloop-command.md` was
   ~40% landed already (the execution-command contract in `AGENTS.md`, the
   summary in `README.md`); `bootstrap-preflight-check.md` was 0% landed —
   no preflight code exists in `src/`.
2. Surfaced a conflict between the plans and had the user resolve it: the
   autonomy plan calls bare `specloop` an agent-session command, while the
   preflight plan requires the **CLI** to run checks before it prints or
   selects work. Today the no-argument CLI branch prints `HELP` and exits 0.
   **Decision: both** — bare `specloop` runs preflight *and* `specloop
   preflight` exists as the explicit form; `specloop help` stays
   informational. This is a breaking change, so Phase 03 ships as 0.4.0.
3. Authored `spec/02-autonomous-run-contract.md` (22 tasks) and
   `spec/03-preflight-check.md` (26 tasks); registered both in the index
   table and `BACKLOG.md`.
4. Locked two decisions inside Phase 02 rather than leaving them open:
   `spec/specloop-run-state.md` stays **optional** (adding it to
   `requiredProcessFiles` would fail `specloop check` in every existing
   specloop project), and `specloop start`/`run`/`go` are **rejected** as run
   triggers — only the exact message `specloop` starts a run.
5. Ordered 03 after 02 because the preflight spec-state check reads the
   run-state record Phase 02 creates.

### State left running / open

`specloop check --dir .` green: 3 phases, 28/76. Next box is Phase 02.1
(`template/spec/specloop-run-state.md`). No implementation started; both
phases are 0% by design. Sections E of Phase 02 are manual agent-behavior
checks and must be closed with recorded transcript evidence, not assertion.

- _2026-08-31_ — Phase 02 Sections A–D and F completed: added advisory run-state record support to templates, init, and upgrade; documented the autonomous contract; and added tests. Verification: `bun test` 53 pass / 0 fail; `bun run check:self` clean. Resume point: record manual behavior evidence in Section E, then complete Phase 02. Typecheck is environment-blocked by missing `@types/bun` (`TS2688`).

- _2026-09-01_ — Phase 02 Manual E1 completed: user stated the acceptance-mapped goal, then sent exactly `specloop`; the run selected the goal acceptance path. Resume point: remaining manual E2–E4 evidence.

- _2026-09-01_ — Phase 02 Manual E3 completed: `specloop help` returned informational help only and started no run. Resume point: E4 direct stop, then E2 phase-to-phase continuation.

- _2026-09-01_ — User directly stopped the active goal run. Phase 02 Manual E4 completed and the advisory record now leaves the resume point: validate phase-to-phase continuation (E2), then proceed to Phase 03.

- _2026-09-01_ — Phase 02 completed 22/22. Manual E2 was observed in the resumed goal run: closing the final Phase 02 checkbox immediately advanced selection to eligible BACKLOG Phase 03, without another trigger message. Phase 03 is now active.

- _2026-09-01_ — Phase 03 Section A completed (5/26): `preflight` is wired with bare-command behavior, flags, help text, and structured output. Live JSON preflight passed in this repository. Resume: Section B check semantics/tests.

- _2026-09-01_ — Phase 03 initial report/no-Git fixture checks completed (7/26). Resume: complete remaining repository/Git/runtime/spec-state/artifact semantics and broader test matrix.

- _2026-09-01_ — Phase 03 repository/Git checks completed (9/26); live preflight reports validation, branch, dirty state, identity, and origin. Resume: runtime/spec-state/artifact semantics.

- _2026-09-01_ — Phase 03 blocked during runtime verification: `bun install --force` repeatedly reports cache-copy `ENOENT` for Bun declaration packages, so typecheck cannot resolve Bun/test types. Resume after repairing the Bun package cache, then rerun typecheck/full suite.

- _2026-09-01_ — User exited the autonomous run. Run state set to idle; resume only after repairing Bun’s failed installation of `@types/bun` and `typescript`.

- _2026-09-01_ — Resumed run retried `bun install`; it still failed with `ENOENT` while copying `typescript`. Run blocked again pending external Bun cache/filesystem repair.

- _2026-09-03_ — Resumed goal run retried `bun run typecheck`; it still cannot find the `bun` and `node` type libraries. External dependency-installation blocker persists.

- _2026-09-03_ — Phase 03 Git clean-clone-goal task completed (10/26). Missing `origin` is warning-only for ordinary goals and blocks when the active goal/run record requires clean-clone proof; freshly initialized repositories are handled. Evidence: `bun test tests/preflight.test.ts` (2 pass / 0 fail). Resume point: Phase 03 Runtime p2 task — rerun documented typecheck/test commands and distinguish cache/environment failure from project failure.

- _2026-09-03_ — Phase 03 blocked-exit task completed (11/26). Human preflight output names the first blocked check, its cause, and repair; focused test suite passed 3/3. Resume point: remaining Phase 03 p1 fixture coverage, beginning with a fully healthy fixture.

- _2026-09-03_ — Phase 03 healthy-fixture p1 completed (12/26). A complete fixture passed all five preflight checks and exited 0; focused suite passed 4/4. Resume point: test that help paths run no checks on a deliberately broken fixture.

- _2026-09-03_ — Phase 03 help-path p1 completed (13/26). `help` and `--help` stayed informational on a broken fixture; focused suite passed 5/5. Resume point: test bare `specloop` on that broken fixture exits nonzero.

- _2026-09-03_ — Phase 03 bare-command test completed (14/26). Broken fixture invokes preflight and returns nonzero; focused suite passed 6/6. Resume point: implement the Runtime check’s Bun-engine, dependency, typecheck, and test validation with environment/project-failure distinction.

- _2026-09-03_ — Phase 03 runtime task remains blocked by a reproducible external Bun cache error (`bun install`: ENOENT copying `typescript`); typecheck lacks Bun/Node declaration packages while the full test suite passes 59/59. Structural validation remains clean (64/76). Resume point: repair Bun cache, run `bun install` and `bun run typecheck`, then implement the runtime preflight check.

- _2026-09-03_ — User-directed 0.4.0 release: published `@khangtoh/specloop@0.4.0` to npm, committed `7c1755a` (`release: v0.4.0`), and pushed `main` plus lightweight tag `v0.4.0`. The autonomous Phase 03 run is paused by this direct release instruction; user directed that the previous Bun-install issue be skipped.

- _2026-09-13_ — Phase 04 authored and completed 21/23 under a direct user instruction (onboarding for new and migrated repos, then an npm release). `specloop init` and `specloop upgrade --apply` now install the `specloop` skill and the seven `/spec-*` commands into the target repo's `.claude/`, controlled by `--skills copy|link|none`. Decision recorded in the phase: copy into the repo rather than write to Claude Code's global plugin registry, because a committed `.claude/` onboards every clone and the registry is that tool's internal state. Escaped defect found and fixed: `upgrade --apply` never wrote `spec/README.md`, so every adopted repo failed the `specloop check` that `upgrade` recommends — Phase 01 had marked `upgrade` 28/28 without ever running the validator over an adopted tree. Evidence: `bun test` 72 pass / 0 fail, `bun run typecheck` exit 0, `specloop check --dir .` valid (4 phases, 85/99), and `bash scripts/verify-onboarding.sh` 62 passed / 0 failed over the packed tarball in two throwaway git repos. The Bun cache blocker from Phase 03 has cleared (`bun install` succeeded); Phase 03's own boxes were deliberately left untouched. Resume point: the two open Phase 04 boxes — the Codex project-local skill path (`--agent` flag, deferred as unverified) and confirming the published npm tarball onboards a fresh repo.

- _2026-09-13_ — 0.5.0 release attempted and blocked by npm two-factor authentication (`E403` on publish). Nothing was tagged or pushed and the registry still serves 0.4.0; the 0.5.0 bump in `package.json` is committed. Diagnosis corrected after investigation: account 2FA is *disabled*, so no OTP exists and `--otp` cannot work; the single granular token in `~/.npmrc` lacks the "bypass 2FA" capability npm requires for publishing, and this fresh clone has no repo-local `.npmrc` (gitignored) — 0.4.0 was likely published with a different token. Resume: mint a granular token with bypass-2FA and read/write on the package, then `NPM_TOKEN=npm_xxx bash scripts/finish-release.sh`, which publishes, tags `v0.5.0`, and pushes without re-bumping. Do not re-run `bun run release minor` (it would bump to 0.6.0).

- _2026-09-13_ — Phase 04 released: `@khangtoh/specloop@0.5.0` published, tag `v0.5.0` pushed with `main` at `af52d8c`. The publish blocker was stale auth, not npm policy — `npm login` refreshed the session token and the next attempt succeeded; the placeholder `--otp 000000` on that run was accepted and therefore did not authorize anything. Two earlier diagnoses in this session were wrong (first prescribing an OTP with 2FA disabled, then concluding no credential could work); the record in the phase Findings is corrected. Verified from the registry in a throwaway repo: `bun add -d @khangtoh/specloop` → 0.5.0, `bunx specloop init` → 4 skills + 7 commands byte-identical to the published package, `bunx specloop check` valid. Phase 04 now 22/23. Resume point: the sole open box is the Codex project-local skill path (`--agent claude|codex|both`), deferred as unverified. Recommend enabling npm account 2FA before the next release.


## Session: 2026-09-16 — automatic decision reconciliation intake

**Previous decision:** Phase 04 and the 2026-09-13 ledger deferred Codex paths;
existing assets were protected unless explicitly forced.

**Conflicting instruction:** The user's implementation plan now requires Codex
onboarding, automatic reconciliation, and safe dry-run/apply refresh.

**Resolution:** Implement Phase 05 now under the direct request. Claude remains
the compatibility default; add `.agents/skills` and `.codex/hooks.json` for Codex.
Refresh may replace only byte-recognized shipped assets or unchanged managed
assets. Custom assets require manual merging. This extends the prior protection;
no historical checklist completion or ledger entry is undone. No publishing.

**Scope and consequences:** Phase 04's remaining Codex task and Phase 05's new
instruction/hook/refresh tasks are in scope. Live runtime acceptance requires
observed runtime evidence, separately from simulated hook payload tests.


## Session: 2026-09-17 — reconciliation implementation handoff

Implemented Phase 05's contract, shared runner, both-runtime onboarding and
safe refresh. Phase 04's deferred Codex path is now implemented and verified;
its earlier deferral is superseded by the 2026-09-16 intake resolution above.
The default remains Claude, custom assets require manual merging, historical
ledger bytes survive refresh and forced init, and no publishing was attempted.

Verification: 101 tests pass; typecheck and template/self structural validators
pass; packed onboarding has 73 passing assertions. Added regression coverage
for committed changes, resume/compact baselines, concurrent sessions, retry
bounds, Plan Mode, legacy/customized assets, hook merges and paths with spaces.
The final runner fix consolidates context plus an error into one JSON response.

Resume point: Phase 05 is 11/14. Claude authentication is unavailable per auth
inspection; Codex's live probe loaded the installed skill but received no visible
hook context. Review runtime trust/activation, then execute the remaining live
hook and realistic behavior scenarios documented in docs/decision-reconciliation.md.
Evidence: spec/evidence/05-runtime-probe.md. Installed configuration and synthetic
payload tests are explicitly not evidence that hooks are active. No unrelated
user hooks were enabled via a broad trust bypass.

## Session: 2026-09-26 — short commands and skill menu intake

**Previous decision:** Phase 02 reserves the plain `specloop` message for
autonomous execution; Phases 04–05 ship hyphenated commands and safely managed
Claude/Codex skills. Bare shell `specloop` runs preflight under Phase 03.

**Conflicting instruction:** The user approved short action names, grouped
`prio spec|task` with existing arguments, and a response menu when submitting
`$specloop` in Codex or `/specloop` in Claude, then authorized implementation.

**Resolution:** Phase 06 adds explicit skill menu and action routing, including
`loop`, while retaining plain-message execution, shell preflight, and all old
command aliases. The exact-only rule applies to plain-message run triggers;
explicit skill `loop` is also authorized. Historical checkboxes remain intact.

**Scope and consequences:** CLI routing, skill references, documentation,
templates, onboarding/refresh verification, and live menu/action evidence.
Custom asset protections and ledger history survive. No release or publishing.


## Session: 2026-09-26 — command-menu implementation handoff

Implemented Phase 06 to 7/8. Canonical CLI names now include `list`, `audit`,
and `prio spec|task`; all previous aliases remain. The shared skill displays
its menu on explicit bare invocation, routes actions with self-contained
references, and distinguishes plain-message execution from explicit skill
loop. Templates, current docs and CLI onboarding hints advertise the interface.

Verification: 110 tests pass, typecheck and both structural validators pass,
82 packed onboarding assertions pass, and skill validation passes. Native
Codex 0.157.1 menu/list probes passed with no fixture-file changes; evidence
is in `spec/evidence/06-command-menu.md`. Claude auth inspection reports
`loggedIn: false`; its live acceptance box remains open. No publishing.

Resume point: authenticate Claude and record the `/specloop` response menu
and `/specloop list undone --json` routing in an isolated project, then close
Phase 06's last checkbox. Existing Phase 03 and 05 acceptance gaps are unchanged.

## Session: 2026-09-26 — 0.7.0 release reconciliation

**Previous decision:** Phase 06 implementation was local-only with no release;
local Phase 05 described decision reconciliation, while the fetched published
branch independently used Phase 05 for grouped layouts and released 0.6.0.

**Conflicting instruction:** The user now requests shipping a new version.
Registry and origin inspection show 0.6.0 already published, with upstream
layout/group commands absent from the local command-menu branch.

**Resolution:** Publishing is now authorized. Merge origin/main without
removing either feature set, preserve upstream's published Phase 05 identity,
and renumber the local reconciliation phase to 07. Historical ledger references
to local Phase 05 mean that reconciliation phase; its checklist remains intact.
Phase 06's menu gains the upstream layout/group actions. Release 0.7.0 after
combined verification, then verify the registry package and push main/tag.

**Scope and consequences:** Resolve integration conflicts, retain the append-only
ledger history from both branches, update current phase references and index,
and align bundled plugin manifest versions to the release. Claude live menu
acceptance and the reconciliation runtime gaps remain open; publication does
not imply those checks passed.


## Imported upstream release history (preserved verbatim)

- _2026-09-26_ — User-directed Phase 05 (grouped phase layout), opened while adopting specloop in dillinger-aws, whose Phase 11 is a folder and whose Phase 15 was miscounted by the naive fence toggle. Implemented 19/20: grouped discovery + aggregate counts, CommonMark fence tracker, `specloop layout`, `specloop group <NN> [--apply] [--no-split]`, group-aware status/list-spec/prio-task/upgrade, docs, `/spec-layout` command + Codex skill. Evidence: `bun test` 80/0, self/template checks valid, `tsc` clean with curl-fetched type packages; dillinger-aws validates 20 phases 259/454. Phase 05 moved to top of BACKLOG by user direction; Phase 03 remains paused at 14/26. Resume point: 0.6.0 release box.

- _2026-09-26_ — User-directed 0.6.0 release ("push and merge, promote and bundle new version"): the first `bun run release minor` hit `E403` because the local clone was 5 commits behind origin (upstream Phase 04 had shipped 0.5.0 on 2026-09-13). Renumbered this work to Phase 05, rebased onto `origin/main`, re-verified, then released `@khangtoh/specloop@0.6.0` (`5d8fc79`, tag `v0.6.0`). Also fixed `scripts/release.sh`, which never pushed its lightweight tags (`v0.5.0` is still missing on origin), and a SIGPIPE flake in `scripts/verify-onboarding.sh`. Registry-installed 0.6.0 verified against dillinger-aws. Phase 05 complete 20/20. Resume point: Phase 04's open Codex `--agent` box, then Phase 03 (14/26).


## Session: 2026-09-26 — release integration verified

Merged origin/main at a63dc9d, retaining grouped-layout Phase 05 (20/20),
renumbering reconciliation to Phase 07 (11/14), and preserving both branches'
ledger history. Phase 06 is 8/10: the 15-action menu includes layout/group and
canonical priority commands work on grouped phases. Refresh recognizes exact
shipped 0.5.0 and 0.6.0 assets; modified copies still need a manual merge.
Verification: 133 tests, typecheck, both structural checks, changed skill
validation, and 90 packaged onboarding assertions pass. Next: bump all package
and plugin release manifests to 0.7.0, publish, verify registry installation,
and push main plus v0.7.0. Runtime acceptance gaps stay open.

## Session: 2026-09-27 — automated release workflow intake

**Previous decision:** Release scripts verify, bump only the npm manifest,
publish from the working tree, and push; recovery and provenance checks are
partly manual. The current 0.7.0 release was explicitly authorized separately.

**Conflicting instruction:** The user invoked subagents to document publishing
and releasing so the workflow is fully automated.

**Resolution:** Implement Phase 08 with a shared release driver behind the
existing normal/recovery commands. Automate registry/upstream preconditions,
verification, synchronized manifests, exact-tarball publishing and verification,
evidence recording, commit, tag and push. Keep dry-run nonpublishing and make
partial-release recovery explicit. Authentication remains an external prerequisite.

**Scope and consequences:** One delegated agent owns scripts/tests; another
owns README/runbook documentation. The primary agent owns specs/ledger and
finishes the already-published 0.7.0 verification/tag/push. Automation changes
will be a subsequent source commit; never republish or move the 0.7.0 tag.
Historical acceptance gaps remain open, and release automation must not
check unrelated spec tasks based on publication alone.


## Session: 2026-09-27 — 0.7.0 shipped

Published @khangtoh/specloop@0.7.0, verified registry integrity and fresh
installation plus an actual 0.6.0-to-0.7.0 refresh, and pushed release commit
570ef1b with v0.7.0 explicitly. All 61 published files match the tagged source.
Evidence: spec/evidence/0.7.0-release.md. Combined tests 133/133; packaged
onboarding 90/90; typecheck and structural/skill validators pass. Phase 06
is 9/10 with Claude live acceptance open; Phase 07 remains 11/14.

The separately requested Phase 08 automation/runbook work continues on main
in a subsequent source commit. Do not republish 0.7.0 or move its release tag.


## Session: 2026-09-27 — release automation and runbook verified

Completed Phase 08 (7/7) with delegated implementation, documentation and
independent failure-path review. The shared release driver automates required
checks, synchronized versions, exact-artifact onboarding/publication, registry
integrity, append-only evidence, commit, tag and explicit main/tag push.
Recovery retains the version/artifact and refuses unrelated edits, foreign
tags and stale unpublished versions. Dry-run restores its manifest edits.

Evidence: 145 tests pass (691 assertions), including 12 hermetic release tests
(80 assertions); typecheck, template/self structural checks, Node/shell syntax
and whitespace checks pass. Supplied-tarball onboarding passes 90 assertions
against the published 0.7.0 package. See docs/releasing.md for release commands,
authentication prerequisites and recovery before/after saved state.

The automation is a source update after 0.7.0. No second npm version was
published and v0.7.0 remains at 570ef1b. Existing live acceptance gaps remain
open. Next: commit this verified workflow and run its real nonpublishing dry
run from a clean checkout before pushing the source update.


## Session: 2026-09-27 — real release rehearsal passed

From clean automation commit 639d87b, `bun run release patch --dry` passed
registry/upstream/authentication reads, mandatory gates and 90 onboarding
assertions using the generated prospective 0.7.1 artifact. Afterward the
checkout was clean, all three manifests were 0.7.0, HEAD and v0.7.0 were
unchanged, and no recovery state existed. Nothing was published, committed,
tagged or pushed by the rehearsal. This entry records final rehearsal proof;
the source workflow/runbook is ready to push. Phase 08 remains 7/7.


## Session: 2026-09-27 — inline argument hints for specloop skills

User request: show impeccable-style hints when a specloop skill is invoked in
the agent CLI. Reconciled against Phase 06's "response menus, not custom
autocomplete pickers" decision. `argument-hint` is Claude Code's inline hint
text, not a picker, so the decision stands, with a dated amendment in the
phase. All five skills now declare `argument-hint`; the `/spec-*` commands
already did. The source keeps the Claude form. Codex copies written by
init/upgrade/refresh (copy mode) move the hint under `metadata:` so they pass
the Agent Skills validator. 0.7.0 skill digests were added to
legacy-assets.json so existing installs refresh cleanly.

Evidence: spec/evidence/06-argument-hints.md. Tests 148/148, typecheck,
template/self structural checks, packed onboarding 90/90. Claude Code 2.1.283
rendered all five hints inline. Phase 06 is 11/12 with live Claude menu
acceptance still open. Source change only: no version bump, publish or tag.
