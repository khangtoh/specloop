import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SpecloopConfig } from "./config.js";
import { loadOrdered } from "./backlog.js";
import { check } from "./validator/index.js";
import {
  parseIndex,
  phaseComplete,
  phaseTitle,
  priorityRank,
  type PhaseFile,
  type Task,
} from "./validator/parse.js";
import type { RunScope } from "./runState.js";

/** The condition is handed to a host `/goal`, which caps it at 4000 characters. */
export const CONDITION_LIMIT = 4000;

/** What the user asked for, before it is resolved against the real phase set.
 *  `top` is the no-argument form: the highest-priority eligible phase. */
export type GoalTarget =
  | { kind: "top" }
  | { kind: "loop" }
  | { kind: "phases"; phases: number[] };

export interface GoalPlan {
  target: GoalTarget;
  scope: RunScope;
  inScope: PhaseFile[]; // eligible, in work order
  blocked: number[]; // in-scope phases skipped because the index marks them ⛔
  missing: number[]; // phase ids asked for that do not exist
  remaining: { phase: number; file: string; task: Task }[];
  condition: string;
}

/**
 * Parse the `specloop goal` argument. The same grammar is what the `specloop`
 * agent trigger accepts, so the two surfaces can never drift:
 *   (nothing) → the top eligible phase    `loop` → every eligible phase
 *   `1,2,3`   → exactly those phases
 */
export function parseGoalTarget(raw: string | undefined): GoalTarget | { error: string } {
  const v = (raw ?? "").trim();
  if (v === "") return { kind: "top" };
  if (/^loop$/i.test(v)) return { kind: "loop" };
  if (/^\d[\d\s,]*$/.test(v)) {
    const phases = [...new Set(v.split(/[\s,]+/).filter(Boolean).map((n) => parseInt(n, 10)))];
    if (phases.length) return { kind: "phases", phases };
  }
  return {
    error:
      `Unrecognized goal target '${v}'. Use 'specloop goal' for the top eligible phase, ` +
      `'specloop goal loop' for every eligible phase, or 'specloop goal 1,2,3' for a phase list.`,
  };
}

/** Phase ids the index marks `⛔ blocked` — a human override the loop skips. */
export function blockedPhases(rootDir: string, config: SpecloopConfig): number[] {
  const indexPath = join(rootDir, config.specDir, config.indexFile);
  if (!existsSync(indexPath)) return [];
  return parseIndex(indexPath)
    .filter((r) => r.emoji === "⛔" && r.number !== null)
    .map((r) => r.number!);
}

/** Resolve a target against the real spec set and render its `/goal` condition. */
export function buildGoalPlan(
  rootDir: string,
  config: SpecloopConfig,
  target: GoalTarget,
): GoalPlan {
  const { ordered } = loadOrdered(rootDir, config);
  const blockedAll = blockedPhases(rootDir, config);
  const isBlocked = (p: PhaseFile) => blockedAll.includes(p.number);

  let candidates: PhaseFile[];
  let missing: number[] = [];
  if (target.kind === "phases") {
    const byNumber = new Map(ordered.map((p) => [p.number, p]));
    missing = target.phases.filter((n) => !byNumber.has(n));
    // Keep work order, not the order the user typed them in.
    candidates = ordered.filter((p) => target.phases.includes(p.number));
  } else if (target.kind === "loop") {
    candidates = ordered;
  } else {
    const top = ordered.find((p) => !isBlocked(p) && !phaseComplete(p)) ?? ordered[0];
    candidates = top ? [top] : [];
  }

  const blocked = candidates.filter(isBlocked).map((p) => p.number);
  const inScope = candidates.filter((p) => !isBlocked(p));
  const scope: RunScope =
    target.kind === "loop"
      ? { kind: "loop" }
      : target.kind === "top"
        ? inScope[0]
          ? { kind: "phase", phase: inScope[0].number }
          : { kind: "loop" }
        : { kind: "phases", phases: candidates.map((p) => p.number) };

  const remaining = inScope.flatMap((p) =>
    p.tasks
      .filter((t) => !t.checked)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.index - b.index)
      .map((task) => ({ phase: p.number, file: p.file, task })),
  );

  return {
    target,
    scope,
    inScope,
    blocked,
    missing,
    remaining,
    condition: renderCondition(config, { target, scope, inScope, blocked, remaining }),
  };
}

type ConditionInput = Pick<GoalPlan, "target" | "scope" | "inScope" | "blocked" | "remaining">;

/**
 * Render a condition a host `/goal` evaluator can actually judge.
 *
 * Claude Code's evaluator reads only what the working agent surfaced in the
 * transcript — it runs no commands and reads no files — so the condition has to
 * name the commands whose printed output proves it. That printed, counted
 * evidence is the whole point: it is what stops a transcript-only evaluator
 * from calling a goal met on impression.
 */
export function renderCondition(config: SpecloopConfig, plan: ConditionInput): string {
  const spec = config.specDir;
  const lines: string[] = [];

  if (plan.target.kind === "loop") {
    lines.push(
      `Every eligible phase in ${spec}/ is complete: no eligible phase has an unchecked \`- [ ]\` task left, and \`specloop check\` exits 0.`,
    );
  } else if (plan.inScope.length === 1) {
    const p = plan.inScope[0];
    lines.push(
      `Phase ${pad(p.number)} (${title(p)}) is complete: every \`- [ ]\` task in ${spec}/${p.file} is checked, and \`specloop check\` exits 0.`,
    );
  } else {
    lines.push(
      `Phases ${plan.inScope.map((p) => pad(p.number)).join(", ")} are each complete: no unchecked \`- [ ]\` task remains in any of them, and \`specloop check\` exits 0.`,
    );
  }

  lines.push("");
  lines.push("Prove it, do not assert it. Every turn, run and show the output of:");
  lines.push("  1. `specloop status` — the per-phase checked/total counts and the next box.");
  lines.push("  2. `specloop check` — must exit 0.");
  lines.push(
    "Judge progress only from those printed counts. A feature that works when tried by hand is not a checked box, and a summary of work done is not evidence.",
  );

  if (plan.inScope.length) {
    lines.push("");
    lines.push(
      `In scope, in \`${spec}/BACKLOG.md\` work order: ${idList(plan.inScope.map((p) => p.number))}.`,
    );
  }
  if (plan.blocked.length) {
    lines.push(
      `Skipped as \`⛔ blocked\` in ${spec}/${config.indexFile}: ${idList(plan.blocked)} — a skipped phase does not hold the condition open.`,
    );
  }
  lines.push(
    "Also skip any phase whose `Depends on:` line is not yet satisfied, and come back to it once it is.",
  );

  lines.push("");
  lines.push(
    "Met when `specloop status` shows no unchecked task left in an in-scope eligible phase and `specloop check` exits 0.",
  );
  if (plan.target.kind === "loop") {
    lines.push(
      `Then, if ${spec}/${config.indexFile}'s acceptance checkbox is now satisfied, check it and record the live evidence next to it.`,
    );
  }
  lines.push(
    `Not met while any in-scope eligible phase still has an unchecked \`- [ ]\` task. Do not stop at a task or phase boundary.`,
  );

  return clamp(lines.join("\n"));
}

/** Phase ids, elided past a point so a long backlog cannot crowd out the
 *  clauses that actually define the condition. */
function idList(numbers: number[], max = 40): string {
  if (numbers.length <= max) return numbers.map(pad).join(", ");
  const shown = numbers.slice(0, max).map(pad).join(", ");
  return `${shown} … and ${numbers.length - max} more (see \`specloop list-spec\`)`;
}

/** Last-resort guard on the host's 4000-character limit. */
function clamp(text: string): string {
  if (text.length <= CONDITION_LIMIT) return text;
  const marker = "\n…condition truncated to fit the host's 4000-character limit.";
  return text.slice(0, CONDITION_LIMIT - marker.length).trimEnd() + marker;
}

/** Structural errors from `specloop check`, for the Stop hook's first gate. */
export function checkErrors(rootDir: string, config: SpecloopConfig): string[] {
  return check(rootDir, config)
    .issues.filter((i) => i.severity === "error")
    .map((i) => `${i.file}${i.line ? `:${i.line}` : ""} ${i.rule}: ${i.message}`);
}

/** The phase's human title, with a redundant "Phase NN —" prefix stripped. */
export function title(p: PhaseFile): string {
  return phaseTitle(p.title, p.number, p.file);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
