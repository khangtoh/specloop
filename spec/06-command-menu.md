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
- [x] Test fresh installs and safe refresh for both runtimes, including packaged references and customized-asset protection.
- [x] Run tests, typecheck, template/self structural checks, packaged onboarding and skill validation.

## Runtime acceptance

- [x] Record live Codex evidence that the menu is read-only and explicit actions route correctly.
- [ ] Record live Claude evidence that the menu is read-only and explicit actions route correctly.

## Findings / Results

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
