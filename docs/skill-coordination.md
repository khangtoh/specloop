# Coordinate skill dependencies with specloop

Skills can declare relationships in their SKILL.md body. Specloop reads those
declarations and the project's optional integration rules before dependent work.
The agent follows the convention in either Codex or Claude; there is no new
CLI command or automatically enforced graph.

## Declare a relationship

Add a Skill relationships section to a skill you own:

```markdown
## Skill relationships

| Relationship | Skill | Applies when | Contract |
|---|---|---|---|
| Requires | planning | Implementing this change | Result: spec covering the requested behavior and acceptance criteria; inspect evidence and reuse it when ready. |
| Works with | accessibility | Creating a user interface | Guidance: review relevant accessibility requirements within the requested UI work. |
| Hands off to | deployment | Deployment is part of the user's request | Provide the build artifact, checks and remaining work; deployment must satisfy its own prerequisites and authorization. |
```

Use real runtime skill identifiers in place of these illustrative names.
For a Requires relationship, say whether the guidance itself must be loaded
or whether a verified result is sufficient. Add Conflicts with for a specific
incompatible behavior, with the condition where that conflict matters.

For third-party skills, put the relationship in
`spec/skill-coordination.md` using its extra From skill column. Use the
configured spec directory when it differs from spec/. The ownership table
records which skill owns a named responsibility and links to the authoritative
project requirement and ledger decision. It does not give that skill global
priority. Record durable resolutions in the existing session ledger.

## What happens during work

Ask specloop to coordinate the relevant skills for the requested task.
It checks applicable relationships, available guidance and prerequisite
evidence. Ready results can be reused; stale or partial results need their
specific gaps addressed. Missing prerequisites block the dependent portion
while independent work can continue.

Conflicts follow runtime instruction precedence, then applicable project
ownership or recorded resolutions. If those do not settle the conflict,
specloop surfaces the competing instructions and missing decision. Skill
load order never decides the winner. Mutually referring skills can be read
once; circular execution prerequisites need a valid starting artifact.

The shared workflow is packaged as the specloop skill's
[coordination reference](../plugin/specloop/skills/specloop/references/coordination.md).
Menu/help and simple read-only commands do not trigger coordination or a loop.

## Installation and existing projects

Init scaffolds the optional project-rules file and installs the skill reference.
`upgrade --apply` adds missing rules without replacing existing rules.
`refresh --apply` can add the new reference and scaffold or update unchanged
managed assets. Custom files are preserved and reported for manual merging.
Project skill rules survive forced init alongside the existing ledger.

Preview and apply a both-runtime refresh:

```bash
specloop refresh --agent both
specloop refresh --agent both --apply
```

A missing rules document remains valid; it is not a new required process file.
Declarations are optional, and installed skills without them continue to work.
The convention does not install missing skills or grant additional permissions.

## Manual behavior scenarios

Use an isolated project initialized for the runtime being tested. Create
fixture skills with the declared relationships and inventory identifiers in
the table below, following that runtime's project skill layout. These names
are fixtures, not claimed installed dependencies. Use a small, reversible
artifact-writing task; do not deploy or publish anything for these scenarios.

For each case, inspect which guidance is loaded, which prerequisites are
treated as ready, any edits, questions, and the final handoff. Compare with
the expected result and retain the transcript and artifact evidence. Keep
runtime testing separate from installation tests and a written contract review.

| Case | Fixture inputs and request | Expected result |
|---|---|---|
| Ready result | implement requires planning's spec; provide an applicable spec and its acceptance evidence | Reuse the spec; the planning workflow need not rerun. |
| Missing required guidance | implement requires planning guidance; planning is absent | Report missing guidance and block that dependent step; do independent work. |
| Conditional collaboration | implement works with accessibility only for UI; request a backend change | Do not load or execute accessibility merely because the row exists. |
| Handoff | implement hands off a tested build to deployment when deployment was requested; initially request only implementation | Report artifact, checks and remaining work; no unauthorized deployment. Then test an explicitly authorized handoff. |
| Resolved conflict | prototype allows placeholders; implement requires real production behavior; project assigns production implementation to implement and mockups to prototype | Apply the recorded ownership within that scope, retain compatible requirements, cite the decision. |
| Unresolved conflict | Same incompatible behavior, but no applicable project resolution | State both sources and ask the specific missing decision before that step; continue independent work. |
| Mutual references | A and B refer to each other's guidance and both are available | Read each once; no recursive loading loop or false blocker. |
| Circular results | A needs B's result and B needs A's result; neither has a valid artifact | Report the execution cycle and missing starting condition. Repeat with a valid starting artifact and check the satisfied edge is reused. |
| Stale artifact | implement requires a spec with acceptance for the requested behavior; provide one for an older, narrower requirement | Identify the uncovered requirement; existence or an old checked box cannot establish readiness. |
| Explicit override | User changes a recorded project ownership decision | Follow runtime precedence; reconcile the authoritative requirement and append the resolution before dependent implementation. |
| Lightweight request | Submit the bare skill/menu, help, or a simple list request | No dependency workflow, implementation, or ledger edits solely for that request. |
| Plan Mode | Repeat a conflict-resolution scenario in Plan Mode | Describe pending reconciliation without editing the ledger or project rules. |
