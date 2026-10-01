# Project skill coordination

Optional integration rules for this project. This file is not a numbered phase
and is not required by specloop check. Missing files and empty tables are valid.
Specloop's skill loads its coordination reference when relationships apply;
these project rules supplement skill declarations without editing third-party
skills. The CLI does not parse or enforce these relationships.

## Relationships

Use exact identifiers from the runtime's available skills. Add active rules
only for this project's work. In a skill's own Skill relationships section,
omit the From skill column because the declaring skill is the source.

| From skill | Relationship | Skill | Applies when | Contract |
|---|---|---|---|---|

Relationships: Requires, Works with, Hands off to, Conflicts with. For Requires,
state whether guidance must be loaded or an existing verified result suffices.
Specify the result's readiness condition; name the incompatible behavior for a
conflict. A declaration alone never authorizes additional work.

## Ownership and resolutions

| Decision or responsibility | Owner / resolution | Applies when | Authoritative source |
|---|---|---|---|

Ownership applies to a named responsibility, not a global skill ranking.
Follow runtime instruction precedence. Explicit user changes supersede project
rules through the existing decision-reconciliation procedure. Ambiguous conflicts
need the specific missing decision before dependent work; other work can continue.

Record durable resolutions in the existing agent-session-ledger.md and update
these rules and relevant specs with their sources. Do not keep a second ledger
here. Proposed rules and examples are inactive until adopted.

## Example declarations (inactive)

```markdown
| From skill | Relationship | Skill | Applies when | Contract |
|---|---|---|---|---|
| implement | Requires | planning | Implementing an approved change | Result: spec with acceptance criteria covering this change; inspect its evidence and reuse it when ready. |
| implement | Conflicts with | prototype | Updating production behavior | Prototype permits placeholder responses; implementation requires working behavior. Use the recorded ownership rule below. |

| Decision or responsibility | Owner / resolution | Applies when | Authoritative source |
|---|---|---|---|
| Production behavior | implement owns implementation; prototype guides mockups only | Production code is requested | Link to the project's adopted requirement and dated ledger decision |
```

These are illustrative names, not dependencies or active project rules.
