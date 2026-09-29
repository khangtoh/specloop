# Phase 06 — Short commands and native skill menu

Goal: short specloop actions work through the CLI and a shared native skill;
submitting `$specloop` in Codex or `/specloop` in Claude displays a response
menu without executing work, and explicit actions retain existing behavior.

Depends on: None.

## Decisions

Canonical CLI names are `init`, `upgrade`, `refresh`, `check`, `preflight`,
`status`, `list`, `prio spec`, `prio task`, `audit`, `help`, and `version`.
Existing flags and arguments survive, as do all old aliases. The agent adds
`loop [phase]`, goal decomposition during init, and execution of the audit.
The shell audit prints its prompt; no shell loop is introduced.

This phase extends Phase 02's exact-only plain-message trigger rule with an
explicit skill `loop` action. Plain `specloop` still runs autonomously in agent
chat and runs preflight in a shell. Menu/help and unknown actions never run
work. Implicit skill use still supports ordinary work without showing a menu.
Claude project installs expose `/specloop`; marketplace installs expose
`/specloop:specloop`. Codex uses `$specloop`. These are response menus after
submission, not custom autocomplete pickers. Existing aliases stay available.

## Implementation

- [x] (p1) Add canonical CLI routing for list, audit and prio spec|task, preserving aliases, arguments and exit behavior; reject missing or invalid priority targets without mutations.
- [x] (p1) Implement the shared skill response menu and explicit action routing with self-contained workflow references, preserving implicit use and run boundaries.
- [x] Update current documentation, templates and legacy agent entry points to advertise short names and reconcile explicit loop semantics.
- [x] Test CLI alias equivalence and priority effects, invalid input, filters, flags and quoted goals.
- [x] (p1) Handle command-level --help and -h before dispatch; verify init help creates no files and mutating-command help preserves existing project bytes.
- [x] Test fresh installs and safe refresh for both runtimes, including packaged references and customized-asset protection.
- [x] Run tests, typecheck, template/self structural checks, packaged onboarding and skill validation.

## Release

- [x] Integrate published 0.6.0 grouped-layout commands into the shared menu and verify the combined feature set.
- [x] Publish 0.7.0, verify its registry package, and push main plus the release tag.

## Runtime acceptance

- [x] Record live Codex evidence that the menu is read-only and explicit actions route correctly.
- [ ] Record live Claude evidence that the menu is read-only and explicit actions route correctly.

## Findings / Results

- _2026-09-30_ — Fixed command-level help falling through to execution (reported
  as `init --help` scaffolding files). Both help flags now return the shared
  usage text before option validation or command dispatch. Regression tests
  cover empty-directory CLI invocations and byte-preserving help for mutation
  commands. This enforces the existing informational-help decision; no decision
  is superseded. Phase 06 is 10/11; Claude live acceptance remains open.

- _2026-09-26_ — Authored from the user's approved plan; reconciliation recorded
  in the existing ledger before implementation. Runtime evidence is separate
  from installation and automated tests. No publishing requested.

- _2026-09-26_ — Implemented short CLI names with compatible legacy aliases,
  the shared native skill menu/action router and four packaged references,
  explicit loop contract, current documentation, and onboarding hints. Full
  suite: 110 pass / 0 fail; typecheck and structural checks pass; packed
  onboarding: 82 pass / 0 fail; skill validator passes. Codex 0.157.1 displayed
  the 13-action menu without command execution and routed list to the CLI;
  SHA-256 project snapshots stayed identical. Evidence:
  [command-menu proof](evidence/06-command-menu.md). Phase 06 is 7/8;
  Claude live acceptance awaits authentication (`loggedIn: false`).

- _2026-09-26_ — Release scope supersedes the earlier no-publishing decision
  under the user’s direct request. Target 0.7.0 includes upstream 0.6.0 and
  keeps Claude live acceptance separate from package release verification.

- _2026-09-26_ — Integrated published 0.6.0 (origin a63dc9d) with the local
  menu and reconciliation features. Menu now has 15 actions including layout
  and group. Added grouped-phase CLI routing coverage and recognized 0.6.0
  asset hashes for safe refresh (customized bytes remain protected). Combined
  verification: 133 tests pass, typecheck/structural checks and both changed
  skill validators pass; packed onboarding 90/90. Phase 06 is 8/10 before
  publication; Claude live acceptance remains open.

- _2026-09-27_ — Published and registry-verified 0.7.0; pushed release commit
  570ef1b and tag v0.7.0. Fresh both-runtime install, actual 0.6.0 upgrade,
  custom-file protection, ledger preservation and grouped canonical command
  checks passed. Every tarball file matches the tag. Evidence:
  [0.7.0 release](evidence/0.7.0-release.md). Phase 06 is 9/10; live Claude
  acceptance is still pending authentication.
