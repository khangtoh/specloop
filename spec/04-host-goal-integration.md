# Phase 04 — Host `/goal` integration

Goal: specloop drives the native `/goal` that Claude Code and Codex now ship —
supplying the completion condition from its own checkboxes, binding the agent
trigger's scope grammar to it, and enforcing completion deterministically with a
Stop hook — so a transcript-only evaluator can never call a goal met on
impression.

Depends on: Phase 02 (the run-state record and the `specloop` run contract). No
external dependency; the host `/goal` is read-only from specloop's side.

<!--
  Why this phase exists (the gap being closed):
    Claude Code's /goal is a session-scoped prompt-based Stop hook. Its evaluator
    is a small fast model that sees ONLY the transcript — it runs no commands and
    opens no files. Codex's goal is updated by the working model itself via
    update_goal. Neither can count a checkbox. specloop already owns a
    deterministic completion oracle, so the integration is to feed it in, not to
    compete with it.

  Design decisions locked for this phase (do not re-litigate mid-run):
    - NO `/spec-goal` slash command. Both hosts ship `/goal`; a second one would
      confuse the surface. specloop supplies the condition, never the command.
    - The trigger grammar is `specloop [goal] [loop | NN,NN,...]`. `goal` is an
      optional keyword that asks for the host goal to be set; it never changes
      scope. The CLI's `specloop goal <target>` takes the same grammar so the two
      surfaces cannot drift.
    - The previous `specloop` contract is KEPT as the fallback for hosts without
      `/goal`; `/goal` is preferred, not required. `specloop start`/`run`/`go`
      stay rejected.
    - The Stop hook is INERT unless the run-state record says
      `Run status: active`. Plugin hooks fire in every session, so a hook that
      blocked unrelated work would be a defect, not a feature.
    - `Run scope:` is the one run-state field the tooling reads back. Completion
      is still derived from the checkboxes — the field carries scope, not truth.
    - The hook never skips, disables, or rewrites a checkbox to reach green.
-->

## A. Condition generator (do first)

- [x] (p1) Add `src/goal.ts`: the `GoalTarget` grammar (`top` / `loop` /
      `phases`), `parseGoalTarget`, `blockedPhases` (the index's `⛔` override),
      `buildGoalPlan`, and `renderCondition`.
- [x] (p1) Render a condition that names the commands proving it (`specloop
      status`, `specloop check`) and forbids judging from impression — the
      evaluator reads only the transcript, so printed counts are the evidence.
- [x] (p1) Add `src/commands/goal.ts` and wire `specloop goal [target]` into the
      CLI with `--json` and `--start`.
- [x] Resolve `top` to the highest-priority *eligible* phase (skipping blocked
      and complete ones), not the literal top of `BACKLOG.md`.
- [x] Order an explicit phase list by BACKLOG position, not by the order typed.
- [x] Report a requested phase id that does not exist, and a scope in which every
      phase is blocked, as errors with a non-zero exit.
- [x] Keep the condition inside the host's 4000-character limit: elide a long
      phase list rather than truncating the clauses that define the condition.

## B. Run-state scope field

- [x] (p1) Add `src/runState.ts`: read/parse/write the advisory record, the
      `Run scope:` grammar (`phase NN` | `loop` | `phases NN,NN`), and
      `isActive` (only `active` counts).
- [x] (p1) Add `Run scope:` to `template/spec/specloop-run-state.md` and this
      repo's record, keeping every existing field label exactly once.
- [x] Make `writeRunState` add the field to a record scaffolded before it
      existed, so an older project keeps working without a migration.
- [x] Confirm the record stays OUT of `requiredProcessFiles` and that
      `specloop check` is still green in a project without one.

## C. Stop hook — deterministic completion

- [x] (p1) Add `src/commands/stopHook.ts` + `specloop stop-hook`: read the hook
      payload on stdin, emit `{"decision":"block","reason":...}` or nothing.
- [x] (p1) Honour `stop_hook_active` and exit early, so Claude Code's
      eight-block cap can still end a condition that cannot converge.
- [x] (p1) Stay inert unless the run-state record says `Run status: active` —
      the guard that stops a plugin hook from hijacking unrelated sessions.
- [x] Block on a failing `specloop check` before consulting any checkbox: a spec
      that does not validate cannot be trusted to say what is done.
- [x] Name the next box and the way out (`Run status: idle`) in the block reason.
- [x] Prefer the `cwd` in the hook payload over the process root, and treat a
      malformed payload or broken `.specloop.json` as "no opinion".
- [x] (p1) Ship `plugin/specloop/hooks/hooks.json` + `hooks/specloop-stop.sh`;
      exit 0 silently when the CLI is not on `PATH`.

## D. Trigger grammar and the run contract

- [x] (p1) Rewrite the `specloop` execution-command section in `AGENTS.md` and
      `template/AGENTS.md`: the scope table, the eligibility rule, the
      prefer-`/goal` procedure, and the print-evidence-every-turn rule.
- [x] (p1) Keep the previous contract as the documented fallback for a host with
      no `/goal`, and keep the rejected aliases rejected.
- [x] State the Stop hook's inertness contract and the `Run status: idle` release
      in `AGENTS.md`, since that is the only way a user ends a run cleanly.

## E. Tests

- [x] (p1) `tests/goal.test.ts`: the target grammar (including rejecting
      `start`/`go`/`all`/`1,x`), blocked-phase detection, eligible-top
      resolution, BACKLOG ordering of a phase list, missing ids, task-priority
      ordering, the proving clauses, and the 4000-character elision.
- [x] (p1) `tests/stop-hook.test.ts`: inert when idle and in a non-specloop
      directory, blocks when armed, short-circuits on `stop_hook_active`,
      releases on `idle`, blocks on a failing check, releases when every box is
      checked, honours payload `cwd`, survives a malformed payload, and the
      `Run scope:` round-trip including a pre-field record.
- [x] (p1) Extend `tests/run-contract.test.ts` to guard the new contract: all
      three scopes, the `--start` step, the transcript-only evaluator rule, the
      fallback clause, and the hook's inertness — and assert the shipped
      `template/AGENTS.md` carries the same clauses as this repo's.

## F. Documentation

- [x] (p1) Add a "Host `/goal` integration" section to the root `README.md`:
      why the evaluator's blind spot matters, the four `specloop goal` forms, the
      `claude -p` one-liner, and the Stop hook's arming/release contract.
- [x] Rewrite the README "Autonomous agent runs" section around the scope table
      and the eligibility rule.
- [x] Document the hook and the no-`/spec-goal` decision in
      `plugin/specloop/README.md`, and add the host-`/goal` guidance to the
      `specloop` skill.
- [x] Note `specloop goal` in the architecture table's Verification layer.

## G. Manual host-behaviour checks (not unit-testable)

- [ ] (p1) Manual: install the plugin, arm a run with `specloop goal --start`,
      and confirm the Stop hook blocks the turn and that `Run status: idle`
      releases it. Record the transcript excerpt in Findings.
- [ ] (p1) Manual: set a host `/goal` from `specloop goal loop` output and
      confirm the evaluator returns *Not yet met* while boxes remain and *Met*
      only once `specloop status` prints a complete scope.
- [ ] Manual: confirm the hook stays silent in a session in an unrelated
      repository with the plugin enabled.
- [ ] Manual: confirm the Codex path — `/goal` with the same condition, and
      `update_goal` quoting the checkbox counts.

## Findings / Results

<!--
  Record the test/check output proving each automated task, and the transcript
  excerpts backing every Section G manual task. Manual tasks are closed by
  recorded evidence, never by assertion.
-->

- _2026-10-04_ — Sections A–F implemented. Evidence: `bun test` 88 pass / 0 fail
  across 17 files; `bun run check:spec` clean (template, 1 phase 2/4);
  `bun run check:self` clean; `bun run typecheck` clean after `bun install`
  (the `TS2688` recorded in Phase 02 was a missing-`node_modules` artifact, not a
  source diagnostic).

- _2026-10-04_ — Source research, not assumption: Claude Code's `/goal` is
  documented as a wrapper around a session-scoped prompt-based Stop hook whose
  evaluator "doesn't run commands or read files independently" and judges the
  condition against the transcript; verdicts are *Not yet met* / *Met* /
  *Impossible*; the block cap is eight consecutive blocks and `stop_hook_active`
  is the escape; the condition limit is 4000 characters. Codex exposes
  `get_goal` / `create_goal` / `update_goal` to the working model, with
  pause/resume/clear reserved to the user. Both informed the design decisions
  locked above.

- _2026-10-04_ — Section G is deliberately left open: it needs a real host
  session with the plugin installed, which is not reachable from this
  environment. The phase is 28/32, not complete.
