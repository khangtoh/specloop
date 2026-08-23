# Spec Summary/Status Reporting Standard

This file defines the mandatory status-reporting format for every agent that
works from this repository's specs. It is a process definition, not a phase,
and has no implementation checkboxes of its own.

The repository-root `AGENTS.md` (and `CLAUDE.md`, if present) make this
standard mandatory for their respective agent runtimes; `README.md` and
`goal-completion-check.md` make it part of the shared spec workflow.

## Mandatory completion requirement

Whenever an agent completes a task that is mapped to a spec, changes a spec
checkbox, changes a requirement/decision, or closes a working session after
making implementation progress, its final handoff **must contain a section
named `Spec Summary/Status`**.

That section must:

1. derive status from the actual checked and unchecked boxes in the current
   working tree;
2. use the phase table defined below;
3. include the component/deliverable table when the task affects a visible
   component, service, workflow, or other named deliverable;
4. state the overall verdict and any blockers or verification caveats;
5. distinguish functional implementation from visual, live-deployment, or
   other acceptance status; and
6. identify whether the reported changes are uncommitted, committed locally,
   or pushed.

An agent must not report a task or phase as complete merely because code was
written. Relevant checkboxes, required Findings/Results evidence, and
verification must support the claim.

## Source-of-truth rules

- Count `- [x]` as checked and `- [ ]` as unchecked in the relevant phase.
- Show progress as `checked/total`, where `total = checked + unchecked`.
- Aggregate all phase-owned files for a multi-file phase (a phase that is a
  directory of files rather than a single `NN-*.md`).
- Use the working tree being handed off, including intentional uncommitted
  spec changes.
- A phase with unchecked tasks is not simply `Complete`. Use a qualified
  status such as `Operational; verification pending` when its main outcome is
  live but its checklist remains open.
- `Blocked` requires a named dependency or external decision. Ordinary
  unfinished work is `Partial` or `Not started`.
- A completed historical phase remains complete when a later phase supersedes
  one of its decisions; name the replacement phase in the status note.
- When a requirement has a dated supersession/extraction notice, the latest
  decision controls. Do not report historical and replacement requirements as
  simultaneously active.
- Never infer a count or status from commit messages, prose summaries, or a
  previous report when the current checkboxes can be read directly.

## Required phase table

Use this exact column structure and one row per relevant phase. When the user
asks for repository-wide status, include every numbered phase.
For spec-process-only work that maps to no numbered phase, the table is still
required: use `Process (unphased)` in the Phase column, `N/A` for Progress,
and state explicitly that no numbered phase checkbox changed. Do not invent a
phase number or count process-document headings as implementation tasks.

| Phase | Scope | Progress | Status |
|---|---|---:|---|
| `[NN](relative-link-to-spec)` | Short purpose of the phase | `checked/total` | Emoji indicator + `Complete`, `Partial`, `Not started`, or a concise qualified status |

### Status emoji indicators

Every Status cell **must begin with exactly one** of these indicators so
completed phases are visually distinguishable at a glance (GitHub-flavored
markdown has no color support, so emojis are the highlight mechanism):

| Emoji | Meaning |
|---|---|
| ✅ | Complete — every checkbox checked and acceptance language satisfied |
| 🟡 | Partial — real progress made, unchecked tasks remain |
| ⬜ | Not started — no checkboxes checked |
| ⛔ | Blocked — a named dependency or external decision prevents progress |

The emoji is a highlight, not a substitute for evidence-bearing text: the
written status after it is still required and still controls. ✅ may only be
used when the phase would qualify as `Complete` under the source-of-truth
rules above; qualified statuses such as `Operational; verification pending`
take 🟡 even when the main outcome is live.

Status language should be evidence-bearing. Prefer:

- `✅ Complete`
- `✅ Complete; later decision superseded by Phase NN`
- `🟡 Operational; two deployment-proof tasks remain`
- `🟡 Clarification complete; implementation pending`
- `⬜ Not started`
- `⛔ Blocked by Phase NN acceptance`

Avoid vague labels such as `Mostly done`, `Looks good`, or `In progress`
without naming what is complete and what remains.

## Required component/deliverable table

If the task affects named components or deliverables, follow the phase table
with a component-status table:

| Component or deliverable | Implementation status | Verification or remaining work |
|---|---|---|
| Named service, workflow, API, document, or artifact | What exists now | Tests, deployment proof, decision, or follow-up still required |

Component rows must not collapse distinct states. For example, a migrated
component can be `Functionally complete` while its visual or acceptance pass
is `Pending`; reporting only `Complete` would hide a material open
requirement.

## Required closing lines

End the `Spec Summary/Status` section with:

- **Overall:** one sentence stating the goal-level verdict and the most
  important remaining dependency, if any.
- **Evidence:** commands, tests, screenshots, deployment run, or document-only
  validation used for the report.
- **Change state:** `uncommitted`, `committed locally`, or `pushed`, including
  the commit SHA or branch when available.

## Agent completion procedure

Before an agent says a task is complete, it must perform these steps in order:

1. Re-read the mapped requirement and the exact task checkbox.
2. Verify the work in proportion to risk.
3. Check only tasks whose acceptance language is actually satisfied.
4. Add or update the phase's dated Findings/Results entry when the phase
   requires one.
5. Recount checked and unchecked tasks for every affected phase.
6. Update `spec/README.md` when a phase-level status or dependency changed.
7. Append `spec/agent-session-ledger.md` when the session changed a decision,
   completed material work, or left an important resume point.
8. Produce the mandatory `Spec Summary/Status` section using the tables above.

If the agent cannot complete one of these steps, it must report the task as
partial or blocked and name the missing evidence. It must not omit the status
section because the task is incomplete; the table is also the required
handoff format for partial progress.

## Copyable completion template

```markdown
## Spec Summary/Status

| Phase | Scope | Progress | Status |
|---|---|---:|---|
| [NN](spec/NN-name.md) | Phase purpose | X/Y | ✅/🟡/⬜/⛔ Complete/Partial/Not started/Blocked; concise evidence or caveat |

| Component or deliverable | Implementation status | Verification or remaining work |
|---|---|---|
| Name | Current implemented state | Remaining acceptance work or `Complete` |

**Overall:** Goal-level verdict and most important remaining dependency.

**Evidence:** Tests, checks, screenshots, deployment run, or documentation validation.

**Change state:** Uncommitted / committed locally at `SHA` / pushed to `branch`.
```
