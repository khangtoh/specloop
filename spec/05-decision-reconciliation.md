# Phase 05 — Automatic decision reconciliation

Goal: every specloop session reconciles instructions with recorded decisions;
Claude and Codex hooks prompt review and detect missing ledger updates safely.

Depends on: None.

## Instructions

- [x] (p1) Share the reconciliation contract across repository instructions, skills, commands and shipped process templates, covering direct work, resumption, precedence and append-only conflict records.
- [x] (p1) Record supersession before implementation, update authoritative specs, and preserve historical completed checkboxes.

## Hook behavior

- [x] (p1) Implement shared SessionStart and UserPromptSubmit context with per-project, per-runtime, per-session baselines outside tracked files.
- [x] (p1) Compare contents at Stop including changes committed during the turn; require a nonempty append preserving the original ledger bytes.
- [x] (p1) Bound correction to one retry; surface unresolved requirements; skip Plan Mode mutations and read-only churn; ignore non-specloop repos.
- [x] Test session isolation, resumption/compaction, committed changes, additions/deletions, valid appends, missing updates and retry guards.

## Installation

- [x] (p1) Add --agent claude|codex|both to init and upgrade, retaining Claude default and installing native runtime configuration.
- [x] (p1) Provide refresh dry-run/apply with recognizable ownership, customized-asset/manual-merge reporting, unrelated-hook preservation and immutable ledger history.
- [x] Test new/repeated installs, both runtimes, customized assets, unrelated hooks, paths with spaces and non-specloop repositories.
- [x] Document trust/restart requirements, installed versus active status, detection limitations and runtime acceptance procedure.

## Verification

- [x] Run full tests, typecheck, both structural validators and packaged onboarding checks.
- [ ] Collect live Claude runtime evidence for context injection and Stop correction, including retry guard and Plan Mode.
- [ ] Collect live Codex runtime evidence for context injection and Stop correction, including retry guard and Plan Mode.
- [ ] Verify realistic agent behavior for explicit override, partial supersession, ambiguity, resumption and ordinary work with recorded runtime transcripts.

## Findings / Results

- _2026-09-16_ — Authored under the direct implementation request. Phase 04's
  Codex deferral is superseded by this phase; its copy/link and customization
  protections survive. Official runtime hook contracts inspected. No acceptance
  claimed from installing configuration or synthetic payload tests alone.

- _2026-09-17_ — Implementation and automated verification complete (11/14):
  shared contract, content-based hook runner, Claude/Codex onboarding, safe
  hash-based refresh, custom/unrelated asset protection and immutable ledger
  history. `bun test`: 101 pass / 0 fail; typecheck passed; both validators
  passed; packed onboarding: 73 pass / 0 fail (rerun after final runner fix).
  Synthetic payload coverage is not live runtime acceptance.
- _2026-09-17_ — Live Codex 0.154.0 read-only probe loaded the installed
  `.agents/skills/specloop/SKILL.md` and read the ledger, but explicitly reported
  no visible SessionStart/UserPromptSubmit hook context. Claude 2.1.236
  authentication inspection reported `loggedIn: false`. See
  [runtime probe evidence](evidence/05-runtime-probe.md). The last three boxes
  remain open pending authenticated/trusted runtime activation and the complete
  behavior matrix in `docs/decision-reconciliation.md`. No broad hook trust
  bypass was used; unrelated user-level hooks are outside this acceptance task.
