import { existsSync } from "node:fs";
import { loadConfig } from "../config.js";
import { buildGoalPlan, checkErrors, pad } from "../goal.js";
import { isActive, readRunState, type RunScope } from "../runState.js";
import type { GoalTarget } from "../goal.js";

/** The shape of a Claude Code `Stop` hook payload that this hook reads. */
interface StopHookInput {
  stop_hook_active?: boolean;
  cwd?: string;
}

export interface StopHookDecision {
  block: boolean;
  reason?: string;
}

/**
 * The deterministic half of specloop's `/goal` integration.
 *
 * A host `/goal` evaluator can only read the transcript. This hook reads the
 * files, so it is the one place where "is the goal met?" is answered by counting
 * checkboxes. It blocks the turn from ending while eligible boxes remain.
 *
 * It is deliberately inert unless `spec/specloop-run-state.md` records an
 * `active` run: a plugin's hooks fire in every session once the plugin is
 * enabled, and a hook that blocked every unrelated session would be a bug.
 */
export function decideStopHook(rootDir: string, rawInput: string): StopHookDecision {
  const input = parseInput(rawInput);

  // Claude Code sets this once it has already been continued by this hook, and
  // overrides the hook after eight consecutive blocks. Bail out so a condition
  // that cannot converge ends the turn instead of spinning.
  if (input.stop_hook_active === true) return { block: false };

  const root = input.cwd && existsSync(input.cwd) ? input.cwd : rootDir;

  let config;
  try {
    config = loadConfig(root);
  } catch {
    return { block: false }; // a broken .specloop.json is `specloop check`'s to report
  }

  const state = readRunState(root, config);
  if (!isActive(state) || state === null || state.scope === null) return { block: false };

  const errors = checkErrors(root, config);
  if (errors.length) {
    return {
      block: true,
      reason:
        `specloop check is failing, so the spec cannot be trusted to say what is done:\n` +
        errors.slice(0, 5).map((e) => `  - ${e}`).join("\n") +
        `\nFix the structure, then run \`specloop check\` and show it exits 0.`,
    };
  }

  const plan = buildGoalPlan(root, config, targetFor(state.scope));
  if (!plan.remaining.length) return { block: false };

  const next = plan.remaining[0];
  const tag = next.task.priority ? ` (${next.task.priority})` : "";
  return {
    block: true,
    reason:
      `A specloop run is active (scope: ${describe(state.scope)}) with ` +
      `${plan.remaining.length} unchecked task(s) left in ${plan.inScope.length} eligible phase(s).\n` +
      `Next box — Phase ${pad(next.phase)}.${next.task.index}${tag}: ${next.task.text}\n` +
      `Do it, verify it, check the box, update Findings and the phase table, then continue. ` +
      `To end the run instead, set \`Run status: idle\` in ${config.specDir}/specloop-run-state.md.`,
  };
}

/** Emit the hook's decision as Claude Code's `Stop` JSON and exit 0. A hook that
 *  reports no decision prints nothing at all. */
export function runStopHook(rootDir: string, rawInput: string): number {
  const decision = decideStopHook(rootDir, rawInput);
  if (decision.block) {
    console.log(JSON.stringify({ decision: "block", reason: decision.reason }));
  }
  return 0;
}

function targetFor(scope: RunScope): GoalTarget {
  if (scope.kind === "loop") return { kind: "loop" };
  if (scope.kind === "phase") return { kind: "phases", phases: [scope.phase] };
  return { kind: "phases", phases: scope.phases };
}

function describe(scope: RunScope): string {
  if (scope.kind === "loop") return "every eligible phase";
  if (scope.kind === "phase") return `phase ${pad(scope.phase)}`;
  return `phases ${scope.phases.map(pad).join(", ")}`;
}

function parseInput(raw: string): StopHookInput {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as StopHookInput) : {};
  } catch {
    return {};
  }
}
