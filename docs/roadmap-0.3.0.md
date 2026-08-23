# specloop 0.3.0 — Scheduling layer (BACKLOG + prio-spec/list-spec + autonomy)

Status: **shipped in 0.3.0**. This is a living document — the coverage table's
*State* column reflects what has landed.

Resolved decisions (were open during planning):
- **BACKLOG lists phases** (not individual tasks) — preserves the phase/task model.
- **Filename `NN` is a pure stable id**; work order comes from BACKLOG position.
- **`upgrade` is repurposed** to project adoption/migration; the 0.2.0 task-priority
  command is now **`prio-task`**.

0.3.0 adds specloop's **Scheduling layer**. The Verification and Memory layers
already exist (they came from dillinger in 0.1.0); 0.3.0 wires them to the new
scheduling layer rather than rebuilding them. See the three-layer model in the
repo `README.md`.

## Design decisions locked

- **Stored order, derived done-state.** Work order lives in a stored, human-owned
  `BACKLOG.md` (the steering surface `prio-spec` edits). Done-state is *derived*
  from each phase's checkboxes and validator-enforced — never a second hand-kept
  truth. This gives dillinger's anti-drift rigor and omarchy's cheap
  reprioritization at once.
- **One autonomy toggle.** The same BACKLOG drives both modes; the only
  difference is whether a human curates/approves between pops.
  - *human-in-loop*: agent proposes the top pick / pauses at each handoff for
    review and any `prio-spec` before continuing.
  - *autonomous*: agent pops the top and runs the full loop unattended until
    `goal-completion-check` returns MET.
- **Two priority levels compose.** `prio-spec` picks the *phase*; `(pN)`/`upgrade`
  picks the *box within it*.

## Open decisions (block implementation)

1. **BACKLOG granularity** — list *phases* (recommended; preserves task
   granularity and the phase/task model) vs. list *individual tasks*.
2. **Order authority** — filename `NN` becomes a *pure stable id* (recommended)
   vs. keep the filename number as a fallback tiebreaker.

## The three constructs it builds on (evaluation)

| Construct | What it is | Role in 0.3.0 |
|---|---|---|
| `spec-summary-status` | Required per-handoff report: phase table (`Phase\|Scope\|Progress\|Status`), component table, `Overall/Evidence/Change state`, counting rules, ✅🟡⬜⛔ semantics, 8-step completion procedure. | Emitted every loop iteration; rows ordered by BACKLOG; table scaffolded by `specloop status`. Its progress column *is* checkbox-derived — aligned with "done-state derived." |
| `goal-completion-check` | Reusable prompt tracing goal → requirements → mapped specs → actual checkboxes; verdict MET / PARTIALLY MET / NOT MET with blockers in dependency order. | Becomes the autonomous loop's **stop condition**; blocker list maps onto BACKLOG order. |
| `agent-session-ledger` | Append-only dated log of what each session did, decided, left running. Never rewritten. | The **resume** construct; paired with BACKLOG as backward-state to BACKLOG's forward-state. Appended per run. |

## Three-layer coverage

| Layer | Construct | 0.3.0 plan step | State |
|---|---|---|---|
| **Scheduling** | `BACKLOG.md` (stored order) | Steps 1–2 (new file; order stored, done-state derived) | ✅ shipped 0.3.0 |
| | phase files / tasks (units) | core model, unchanged | ✅ already in specloop |
| | `prio-spec` / `list-spec` (phase priority) | Step 3 (+ delivery step 10) | ✅ shipped 0.3.0 |
| | `(pN)` / `prio-task` (task priority) | Step 4 (kept, nested under BACKLOG; renamed from `upgrade`) | ✅ shipped 0.2.0, renamed 0.3.0 |
| | *(autonomy toggle)* | Step 5 | 🟡 documented; loop stop-condition wired, no CLI flag yet |
| **Verification** | `spec-summary-status` (per-iteration handoff) | Step 6 (rows reordered by BACKLOG; table scaffolded by `specloop status`) | ✅ status now BACKLOG-ordered |
| | `goal-completion-check` (whole-goal gate) | Step 7 (becomes the autonomous stop condition; blockers in BACKLOG order) | ♻️ exists, elevated in docs |
| **Memory** | `agent-session-ledger` (narrative continuity) | Step 8 (paired with BACKLOG as forward/backward memory; appended per run) | ♻️ exists, wired in |

**Delivered in 0.3.0:** `spec/BACKLOG.md` construct; `specloop list-spec` /
`prio-spec` / `prio-task` CLI; repurposed `specloop upgrade [dir] [--apply]`
(model detection + non-destructive scaffold); validator BACKLOG rules
(`backlog-absent` / `-orphan` / `-duplicate` / `-missing-phase`); BACKLOG-ordered
selection in `status`; Claude commands `/prio-spec` `/list-spec` `/spec-upgrade`
+ matching Codex skills; docs across README/SKILL/AGENTS/methodology/template.

**Deferred:** the explicit autonomy-toggle CLI/flag (Step 5) — the stop-condition
semantics are documented, but a first-class `--autonomous` runner is a later cut.

## Plan steps

**Scheduling (the net-new layer):**
1. `spec/BACKLOG.md` — `## Phases (priority order)`, one line per phase
   `- [ ] NN Title`. List position = work priority (top = next); `NN` = stable id.
   Absorbs the README phase table's ordering role.
2. Order = stored & human-owned (BACKLOG). Done-state = derived (a phase line is
   `[x]` iff all its tasks are checked). `Depends on:` still gates — the loop
   takes the highest BACKLOG phase whose deps are met.
3. `prio-spec <NN> <pos>` — omarchy's algorithm verbatim (unchecked-only, `0`=top,
   signed, single-line move). `list-spec [all|done|undone]` — renders BACKLOG with
   positions + each phase's Goal/Summary.
4. Task-level `(pN)`/`upgrade` stays: prio-spec picks the phase, `(pN)` picks the box.
5. One autonomy toggle (human-in-loop vs autonomous), as above.

**Verification & memory (wire the existing constructs in):**
6. `spec-summary-status` emitted per iteration, rows in BACKLOG order, table
   scaffolded by `specloop status`.
7. `goal-completion-check` becomes the autonomous stop condition; blockers in
   BACKLOG order.
8. `agent-session-ledger` appended per run; paired with BACKLOG as
   forward/backward working memory.

**Enforcement & delivery:**
9. `specloop check` gains BACKLOG rules: every phase appears once, no orphans,
   line done-state matches the phase file, ids resolve, order well-formed.
   (Reuses today's index-check machinery.)
10. Delivered three ways: `specloop prio-spec`/`list-spec` (CLI) + `/prio-spec`/
    `/list-spec` (plugin commands) + Codex skills.
11. Migration: `specloop init` scaffolds BACKLOG; a generator builds `BACKLOG.md`
    from an existing README phase table.
12. Docs updated (AGENTS, spec-loop command, SKILL, README, methodology,
    `_TEMPLATE-phase`) so the loop selection rule reads from BACKLOG.
