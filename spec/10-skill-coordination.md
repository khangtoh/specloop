# Phase 10 — Skill relationships and coordination

Goal: participating skills declare dependencies, collaborations, handoffs and
conflicts; specloop coordinates them using optional project integration rules
and recorded decisions without expanding the user's work scope.

Depends on: None.

## Decisions

The 2026-10-01 skill-coordination ledger entry extends Phase 07 reconciliation
to skill relationships. Runtime instruction precedence and the existing ledger
remain authoritative. This supersedes only the absence of a shared cross-skill
convention; no historical Phase 07 task or runtime evidence is reclassified.

Declarations live in an optional Skill relationships section. Projects can add
relationships and resolutions in the optional skill-coordination.md under the
configured spec directory. An agent reads these rules; the CLI does not parse
a graph, resolve versions, automatically install skills or assign global ranks.
Missing project rules remain valid for existing projects. Reuse verified
prerequisite artifacts and distinguish a mutual reference from an unsatisfied
circular execution dependency. Menu/read-only behavior and Plan Mode survive.

## Tasks

- [x] Define the shared declaration and coordination workflow, including applicability, artifact readiness, precedence, ownership, ambiguity, cycles and handoff evidence.
- [x] Route applicable work to the shared reference; add optional project rules scaffolding and repository/template instructions while preserving command/run scope.
- [x] Install the reference and optional rules through init, adoption and refresh; preserve custom project rules and third-party assets, including forced init.
- [x] Verify both-runtime installation, configured spec directories, dry-run byte preservation, missing-reference repair, custom-file protection and optional-file compatibility.
- [x] Document usage and manual scenarios; record a scenario walkthrough covering ready/missing prerequisites, conditional collaboration, handoff, resolved/unresolved conflicts, circular references and stale artifacts.
- [x] Run regression, typecheck, both structural checks and packed onboarding verification.

## Findings / Results

- _2026-10-01_ — Authored from the approved convention-first plan; ledger
  reconciliation preceded implementation. Scenario review is distinct from
  live Codex/Claude behavior evidence; no native-runtime success is presumed.


- _2026-10-01_ — Implemented the convention, progressive shared-skill routing,
  optional project rules and adoption handoff; protected custom rules during
  init/upgrade/refresh, including forced init. Verified configured spec paths,
  opt-out, old-project validity, reference repair and custom-file preservation.
  Tests: 149 pass / 0 fail (804 assertions); typecheck, both structural checks
  and whitespace pass; packed onboarding: 94 pass / 0 fail. Changed Claude and
  converted Codex skill frontmatter parsed/validated with Bun; Python validator
  unavailable (missing PyYAML). Manual tabletop scenario review and the separate
  live-run procedure are recorded in [evidence](evidence/10-skill-coordination.md).
  All six implementation/convention tasks are complete. Live model compliance
  remains a manual follow-up; installation and scenario review are not runtime
  acceptance proof. No release/version change or push was performed here.
