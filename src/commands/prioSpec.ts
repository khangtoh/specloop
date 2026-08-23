import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "../config.js";
import { loadOrdered, backlogPath } from "../backlog.js";
import { parseBacklog, phaseComplete } from "../validator/parse.js";
import { runListSpec } from "./listSpec.js";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const ENTRY = /^\s*-\s+(?:\[[ xX]\]\s+)?(\d{2,})\b/;

/**
 * Reprioritize one incomplete phase in spec/BACKLOG.md.
 *   specloop prio-spec <NN> <pos>
 *   pos == 0  → move to the top of the incomplete list
 *   pos > 0   → up N positions among incomplete phases
 *   pos < 0   → down N positions among incomplete phases
 * Complete phases (all tasks checked) stay anchored; only order changes, and
 * no phase file is touched.
 */
export function runPrioSpec(rootDir: string, nnArg?: string, posArg?: string): number {
  if (!nnArg || posArg === undefined) {
    console.error("Usage: specloop prio-spec <NN> <pos>   e.g. specloop prio-spec 22 0");
    return 1;
  }
  const nn = parseInt(nnArg, 10);
  const pos = parseInt(posArg, 10);
  if (Number.isNaN(nn) || Number.isNaN(pos)) {
    console.error("Both <NN> (phase id) and <pos> (signed integer) must be numbers.");
    return 1;
  }

  const config = loadConfig(rootDir);
  const bp = backlogPath(rootDir, config);
  if (!existsSync(bp)) {
    console.error(`No ${config.specDir}/BACKLOG.md found. Run 'specloop init' to scaffold it.`);
    return 1;
  }

  const { phases } = loadOrdered(rootDir, config);
  const completeByNumber = new Map(phases.map((p) => [p.number, phaseComplete(p)]));

  const lines = readFileSync(bp, "utf8").split(/\r?\n/);
  // Slots = file line indices that hold a backlog entry, in order.
  const entries = parseBacklog(bp);
  if (entries.length === 0) {
    console.error(`${config.specDir}/BACKLOG.md has no entries under '## Phases (priority order)'.`);
    return 1;
  }
  const slots = entries.map((e) => e.line - 1);
  const L = entries.map((e, k) => ({
    number: e.number,
    raw: lines[slots[k]],
    complete: completeByNumber.get(e.number) ?? false,
  }));

  const target = L.find((e) => e.number === nn);
  if (!target) {
    console.error(`Phase ${nn} is not listed in BACKLOG.md.`);
    return 1;
  }
  if (target.complete) {
    console.log(
      `${YEL}▲${RST} Phase ${nn} is complete; reprioritization applies only to incomplete phases. No change.`,
    );
    return 0;
  }

  const U = L.filter((e) => !e.complete);
  const i = U.indexOf(target);
  let j: number;
  if (pos === 0) j = 0;
  else if (pos > 0) j = Math.max(0, i - pos);
  else j = Math.min(U.length - 1, i - pos); // pos<0 → i + |pos|
  if (j === i) {
    console.log(`${YEL}▲${RST} Phase ${nn} is already at incomplete position ${i}. No change.`);
    return 0;
  }

  // Remove target, reinsert so it lands at incomplete slot j.
  const without = L.filter((e) => e !== target);
  const U2 = without.filter((e) => !e.complete);
  let insertAt: number;
  if (j === 0) {
    insertAt = U2.length > 0 ? without.indexOf(U2[0]) : without.length;
  } else {
    const anchor = U2[Math.min(j - 1, U2.length - 1)];
    insertAt = without.indexOf(anchor) + 1;
  }
  const newL = [...without.slice(0, insertAt), target, ...without.slice(insertAt)];

  // Write the reordered raw entry lines back into the same slots.
  newL.forEach((e, k) => {
    lines[slots[k]] = e.raw;
  });
  writeFileSync(bp, lines.join("\n"));

  console.log(
    `${GRN}✔${RST} Moved phase ${nn} to incomplete position ${j} ${DIM}(was ${i})${RST} in BACKLOG.md\n`,
  );
  runListSpec(rootDir, "undone");
  return 0;
}
