import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { parsePhaseFile, priorityRank, PRIORITY_RE, type Priority } from "../validator/parse.js";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const RANK_TO_PRIORITY: Record<number, Priority> = { 0: "p1", 1: "p2", 2: "p3" };
const CHECKBOX_LINE = /^(\s*-\s\[[ xX]\]\s?)(.*)$/;

/**
 * Raise (or set) the priority of a task within a phase.
 *   specloop prio-task <NN.T> [--to p1|p2|p3]
 * NN = phase number, T = 1-based task position within that phase.
 * With --to, sets the priority explicitly; otherwise bumps it up one level
 * (untagged/medium -> p1, p3 -> p2, p2 -> p1). Phase-level priority is
 * `prio-spec`; this orders tasks *within* a phase.
 */
export function runPrioTask(rootDir: string, ref: string, to?: string): number {
  if (!ref) {
    console.error(`Usage: specloop prio-task <NN.T> [--to p1|p2|p3]\n  e.g. specloop prio-task 07.3`);
    return 1;
  }
  const m = ref.match(/^(\d{1,})[.:](\d{1,})$/);
  if (!m) {
    console.error(`Invalid task ref '${ref}'. Use <phase>.<task>, e.g. 07.3`);
    return 1;
  }
  const phaseNum = parseInt(m[1], 10);
  const taskIdx = parseInt(m[2], 10);

  if (to !== undefined && !/^p[1-3]$/.test(to)) {
    console.error(`Invalid --to '${to}'. Use p1 (high), p2 (medium), or p3 (low).`);
    return 1;
  }

  const config = loadConfig(rootDir);
  const specDir = join(rootDir, config.specDir);
  const phaseRe = new RegExp(config.phasePattern);
  const file = existsSync(specDir)
    ? readdirSync(specDir).find(
        (f) => phaseRe.test(f) && parsePhaseFile(join(specDir, f), f).number === phaseNum,
      )
    : undefined;
  if (!file) {
    console.error(`No phase file found for phase ${phaseNum} in ${config.specDir}/.`);
    return 1;
  }

  const path = join(specDir, file);
  const phase = parsePhaseFile(path, file);
  const task = phase.tasks.find((t) => t.index === taskIdx);
  if (!task) {
    console.error(`Phase ${phaseNum} has no task ${taskIdx} (it has ${phase.tasks.length}).`);
    return 1;
  }

  const current = task.priority;
  let next: Priority;
  if (to !== undefined) {
    next = to as Priority;
  } else {
    const newRank = priorityRank(current) - 1;
    if (newRank < 0) {
      console.log(`${YEL}▲${RST} Phase ${phaseNum}.${taskIdx} is already p1 (highest). No change.`);
      return 0;
    }
    next = RANK_TO_PRIORITY[newRank];
  }

  if (next === current) {
    console.log(`${YEL}▲${RST} Phase ${phaseNum}.${taskIdx} is already ${next}. No change.`);
    return 0;
  }

  // Rewrite exactly the task's line, replacing/inserting the priority tag.
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const li = task.line - 1;
  const cm = lines[li].match(CHECKBOX_LINE);
  if (!cm) {
    console.error(`Internal: line ${task.line} of ${file} is not a checkbox as expected.`);
    return 1;
  }
  const bare = cm[2].replace(PRIORITY_RE, "");
  lines[li] = `${cm[1]}(${next}) ${bare}`;
  writeFileSync(path, lines.join("\n"));

  const from = current ?? "untagged";
  console.log(
    `${GRN}✔${RST} Phase ${phaseNum}.${taskIdx}: ${from} ${DIM}→${RST} ${next}\n  ${DIM}${file}:${task.line}${RST}  ${task.text}`,
  );
  return 0;
}
