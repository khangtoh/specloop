import { loadConfig } from "../config.js";
import { buildGoalPlan, parseGoalTarget, pad, title } from "../goal.js";
import { formatRunScope, writeRunState } from "../runState.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const YEL = "\x1b[33m";
const RST = "\x1b[0m";

/**
 * Print a completion condition for a host `/goal` (Claude Code or Codex),
 * derived from the spec's own checkboxes rather than from prose.
 *
 *   specloop goal            → the top-priority eligible phase
 *   specloop goal loop       → every eligible phase, blocked ones skipped
 *   specloop goal 1,2,3      → exactly those phases
 */
export function runGoal(
  rootDir: string,
  target: string | undefined,
  opts: { json?: boolean; start?: boolean } = {},
): number {
  const parsed = parseGoalTarget(target);
  if ("error" in parsed) {
    console.error(parsed.error);
    return 1;
  }

  const config = loadConfig(rootDir);
  const plan = buildGoalPlan(rootDir, config, parsed);

  if (plan.missing.length) {
    console.error(
      `No such phase: ${plan.missing.map(pad).join(", ")}. Run 'specloop list-spec' to see the phase ids.`,
    );
    return 1;
  }
  if (!plan.inScope.length) {
    console.error(
      plan.blocked.length
        ? `Every phase in scope is marked ⛔ blocked (${plan.blocked.map(pad).join(", ")}). Nothing to work.`
        : `No phases found in ${config.specDir}/. Run 'specloop init' or add a phase file.`,
    );
    return 1;
  }

  if (opts.start) {
    const wrote = writeRunState(rootDir, config, {
      status: "active",
      scope: plan.scope,
      statedGoal: plan.condition.split("\n")[0],
      currentPhase: `Phase ${pad(plan.inScope[0].number)} — ${title(plan.inScope[0])}`,
    });
    if (!wrote) {
      console.error(
        `${YEL}▲${RST} No ${config.specDir}/specloop-run-state.md to update — the Stop hook stays inert without it.`,
      );
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          scope: formatRunScope(plan.scope),
          phases: plan.inScope.map((p) => ({
            number: p.number,
            file: p.file,
            title: title(p),
            checked: p.checked,
            total: p.total,
          })),
          blocked: plan.blocked,
          remaining: plan.remaining.length,
          nextTask: plan.remaining[0]
            ? {
                phase: plan.remaining[0].phase,
                index: plan.remaining[0].task.index,
                priority: plan.remaining[0].task.priority,
                text: plan.remaining[0].task.text,
              }
            : null,
          condition: plan.condition,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(plan.condition);
  console.error(
    `\n${DIM}── ${plan.remaining.length} unchecked task(s) in scope ${formatRunScope(plan.scope)}.` +
      ` Set it with ${RST}${BOLD}/goal${RST}${DIM} in Claude Code or Codex.${RST}`,
  );
  return 0;
}
