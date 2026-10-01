# Coordinate related skills

Use this workflow when the requested work involves applicable skill relationships
or project integration rules. This is an agent convention, not a native skill
manifest field or a CLI dependency resolver. The agent loads and executes skills;
specloop supplies the coordination contract.

## Declare relationships

A participating skill may add this optional section to its SKILL.md body:

```markdown
## Skill relationships

| Relationship | Skill | Applies when | Contract |
|---|---|---|---|
| Requires | planning | Implementing a planned change | Result: a spec covering the requested change, with acceptance criteria and evidence of approval where required. Reuse a valid existing spec. |
| Works with | accessibility | Creating a user interface | Guidance: review the relevant accessibility requirements within the requested UI work. |
| Hands off to | deployment | The user requested deployment after implementation | Provide the build artifact, verification results and remaining work. Deployment starts only when its prerequisites and authorization are satisfied. |
| Conflicts with | rapid-prototype | Updating production code | rapid-prototype permits placeholders; this workflow requires working behavior. Resolve ownership for the production implementation before that step. |
```

These names are illustrative, not installed dependencies. Use the exact skill
identifier from the runtime's available-skill inventory, including its namespace
when present. Every row must explain when it applies and what is needed:

- **Requires:** specify either guidance that must be available and loaded, or a
  result with an explicit readiness condition. Availability alone does not prove
  that a required artifact is ready. A verified existing result can satisfy a
  result dependency without rerunning, or requiring access to, its producer.
- **Works with:** identify a useful contribution under a condition. A missing
  collaborator is not automatically a blocker; report any resulting limitation.
- **Hands off to:** describe the input the next skill receives and the readiness
  condition. A handoff does not authorize additional work by itself.
- **Conflicts with:** identify the actual incompatible behavior and its scope.
  Coexistence or different preferences alone do not establish a conflict.

## Discover applicable rules

1. Resolve the requested project and configured spec directory. If
   `skill-coordination.md` exists there, read its active relationships and
   ownership/resolution rules, plus referenced authoritative decisions.
2. Read the selected skills' Skill relationships sections. Resolve peers using
   the available-skill inventory and their supplied paths; do not assume a skill
   exists, invent a path, or automatically install it. A project declaration may
   relate third-party skills that have no declarations of their own.
3. Evaluate applicability against the current request. Follow only applicable
   relationships, loading relevant guidance progressively. Keep a set of skill
   identifiers already read so mutual references do not cause repeated loading.
   Example tables and proposed rules are inactive until adopted for this work.
4. Keep a brief working agreement in the conversation: the relevant skills,
   each contribution, prerequisite evidence, and any unresolved conflict.
   Relationship discovery does not start an autonomous loop, expand the user's
   scope, authorize external actions, or override Plan Mode. Ordinary menu,
   help and simple read-only commands need no coordination pass or ledger churn.

A missing optional project document or relationship section is valid. Use
available skill declarations and ordinary task instructions. When instructions
actually conflict despite no declaration, resolve the conflict below; do not
invent a durable dependency graph merely because skills are used together.

## Check readiness and coordinate

For each applicable Requires row, determine whether guidance or a result is
needed. For a result, inspect the artifact and its acceptance evidence against
this request, including whether relevant inputs have changed. A checked box,
a previous skill invocation, or a file's existence alone is insufficient.
If the result is ready, reuse it. If it is stale or partial, identify the gap
and perform prerequisite work only within the authorized request.

When required guidance is unavailable, or no valid result or authorized path to
produce it exists, report the missing skill/result and affected step. Continue
independent work; leave a concrete resume point for the blocked portion.
Do not silently replace a mandatory dependency with a different skill.

Mutual references are permitted and loaded once. Circular execution
prerequisites are different: if A needs B's result and B needs A's result and
neither has a valid starting artifact, show that chain and report the missing
starting condition. Do not recursively invoke skills or declare results ready
to break the cycle. An existing valid artifact can satisfy one edge.

Respect the project's phase dependencies and priority when coordination is part
of a loop. Skill relationships do not change spec order or checkboxes by
themselves. Do not mark a prerequisite satisfied unless its contract is met.

## Resolve overlapping instructions

Follow the host runtime's instruction precedence. A relationship declaration
cannot give a skill authority over user instructions or higher-priority rules.
An explicit user change to a recorded project decision follows the existing
reconciliation procedure and does not need repeated permission.

Within that precedence, use applicable project ownership or recorded resolutions
for the overlapping decision. An owner is limited to the named responsibility;
it does not outrank other skills globally. A skill's unilateral claim to own a
conflict does not settle it. Neither load order nor the most recently used skill
wins. Keep all compatible requirements; document which incompatible requirement
is superseded and why.

If active rules remain ambiguous or incompatible, state the two instructions,
their sources, the affected step, and the specific decision needed. Ask for that
decision before dependent work, while continuing independent work. Do not
silently choose a winner or invent a compromise that violates either requirement.

For a durable project resolution, append the previous decision, conflicting
instruction, resolution, and consequences to the existing agent-session-ledger.md
before dependent implementation; update the authoritative spec and, where
appropriate, the project's ownership/resolution rule with a supersession link.
Do not create a separate decision ledger. Plan Mode describes the pending
resolution without mutating files. Routine discovery and artifact reuse need
no decision entry; ordinary material work still follows the project's reporting
and ledger requirements.

## Handoff

Report the artifact or input, its location, evidence of verification, which
contract it satisfies, and remaining work. Distinguish Ready, Partial, and
Blocked results with their reasons. The receiving workflow checks that the
contract still applies before using the result. Using a skill does not prove
its task succeeded, and a completed handoff does not prove the receiving work
is complete. Follow the project's Spec Summary/Status for material handoffs.
