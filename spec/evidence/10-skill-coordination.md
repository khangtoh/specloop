# Phase 10 — Skill coordination evidence

Date: 2026-10-01.

## Implementation and automated verification

The shared skill routes applicable relationships to its packaged coordination
reference. Skill declarations and optional project tables describe applicability
and contracts without adding unsupported native manifest fields. Adoption
hands off to specloop only when execution was requested.

Init, adoption and safe refresh install the optional rules scaffold and reference;
project rules survive forced init. Tests exercise both runtime layouts,
configured spec directories, missing guidance restoration, dry-run byte identity,
custom rules/references, ledger preservation, opt-out and old projects without
the optional document.

- bun run test: 149 pass, 0 fail, 804 assertions.
- bun run typecheck: passed.
- bun run check:spec and check:self: passed (recounted after completion).
- bash scripts/verify-onboarding.sh: 94 pass, 0 fail against the source tarball,
  including both-runtime reference fidelity and custom-rule preservation.
- git diff --check: passed.
- Parsed the two changed skills' Claude and converted Codex frontmatter with
  Bun.YAML.parse; names, descriptions and runtime-specific allowed fields passed.
  The skill-creator Python validator was unavailable because PyYAML is missing;
  it is not claimed to have run.

The first full test run exposed the expected new optional adoption-plan entry;
its assertion was updated and the complete suite passed. The initial packed
check could not pack inside the sandbox; the permitted rerun passed.

## Manual scenario walkthrough

This is a tabletop application of the written convention to the following
fixture inputs, reviewed by the implementing agent. No fresh Claude or Codex
session was executed. These outcomes establish the intended contract and review
coverage, not observed native-runtime compliance.

| Scenario and concrete input | Walkthrough result and reason |
|---|---|
| implement requires a planning result; the current spec covers the requested endpoint and includes acceptance evidence | Ready: use that artifact without rerunning planning. Artifact evidence satisfies the result contract even if the producer skill is unavailable. |
| implement requires planning guidance; the inventory has no planning skill | Block the guidance-dependent step and name planning as missing. Independent inspection may continue; do not claim guidance was loaded. |
| implement works with accessibility for UI work; the request changes a backend parser | Condition false: skip that collaboration. The mere declaration does not activate another skill. |
| implement hands off to deployment; a tested build exists, but the request is implementation only | Report build location, test evidence and remaining deployment work. The relationship cannot authorize deployment. With deployment explicitly requested, the receiver checks its readiness and authorization before work. |
| prototype permits placeholders; implement requires production behavior; an adopted project rule assigns production implementation to implement and mockups to prototype | Apply the recorded rule within production scope, preserving prototype's compatible mockup guidance. The owner does not gain global instruction priority. |
| Same incompatible production requirements, no applicable owner or recorded resolution | Surface the two sources and ask which behavior governs production. Dependent edits wait; independent work may continue. Load order cannot settle the conflict. |
| A's guidance references B; B's guidance references A; both are available | Read A and B once using the visited identifiers; mutual references are not inherently an execution blocker. |
| A needs B's completed output; B needs A's completed output; neither artifact exists | Report A → B → A and the missing starting artifact. Neither output can be declared ready. When one valid artifact is supplied, reuse it to satisfy that edge. |
| implement requires acceptance for an endpoint plus validation; supplied spec covers only the endpoint | Partial: identify missing validation coverage. An old completed checkbox or file existence is insufficient readiness evidence. |
| User explicitly changes an adopted ownership rule | Follow runtime precedence; append the supersession to the existing ledger and update the authoritative rule before dependent implementation. No repeated permission is required for the clear override. |
| User submits menu/help/simple list while unrelated dependency rows exist | Return the requested lightweight result; no loop or coordination-only ledger entry. |
| A conflict is analyzed in Plan Mode | Explain the pending resolution and affected work without editing the ledger, rules or specs. |

## Live manual follow-up

The user/maintainer can run the isolated scenarios in
[the manual runbook](../../docs/skill-coordination.md#manual-behavior-scenarios)
and retain transcripts plus artifacts. Neither the written walkthrough nor
installation tests certify that a live model follows every coordination rule.
No existing runtime-acceptance checkbox was changed by this work.
