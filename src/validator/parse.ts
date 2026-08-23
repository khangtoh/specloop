import { readFileSync } from "node:fs";

export type Priority = "p1" | "p2" | "p3";

/** Priority tag written just after the checkbox, e.g. `- [ ] (p1) do the thing`.
 *  p1 = high, p2 = medium, p3 = low. An untagged task is treated as medium. */
export const PRIORITY_RE = /^\((p[1-3])\)\s+/;
const PRIORITY_RANK: Record<Priority, number> = { p1: 0, p2: 1, p3: 2 };
export const UNTAGGED_RANK = 1; // medium, same slot as p2

/** Lower rank = higher priority = selected sooner. Untagged sits at medium. */
export function priorityRank(p: Priority | null): number {
  return p ? PRIORITY_RANK[p] : UNTAGGED_RANK;
}

export interface Task {
  line: number; // 1-indexed line in the file
  index: number; // 1-indexed position among the phase's checkbox tasks
  checked: boolean;
  priority: Priority | null;
  text: string; // task text, priority tag stripped
}

export interface PhaseFile {
  file: string; // basename
  path: string; // absolute
  number: number;
  title: string;
  goal: string | null;
  dependsOn: string | null;
  tasks: Task[];
  checked: number;
  total: number;
}

/** A row parsed from the index (README) phase table. */
export interface IndexRow {
  line: number;
  number: number | null;
  file: string | null; // linked target basename
  purpose: string;
  emoji: string | null;
  checked: number | null;
  total: number | null;
  statusRaw: string;
}

const CHECKBOX = /^\s*-\s\[( |x|X)\]\s?(.*)$/;
// A line that looks like it wanted to be a task but is malformed, e.g. `- [] x`,
// `- [~]`, `-[ ]`, `* [ ]`.
const MALFORMED = /^\s*[-*]\s*\[[^ xX]?\]|^\s*[-*]\[[ xX]?\]/;

export function extractNumber(basename: string): number | null {
  const m = basename.match(/^(\d{2,})-/);
  return m ? parseInt(m[1], 10) : null;
}

export interface OpenTaskRef {
  phase: number;
  file: string;
  task: Task;
}

/**
 * The next box the loop should take: the highest-priority open task, breaking
 * ties by lowest phase number, then task position. `Depends on:` gating is the
 * agent's judgment (its prose isn't machine-evaluated here) — this orders the
 * frontier the agent chooses from.
 */
export function selectNextTask(phases: PhaseFile[]): OpenTaskRef | null {
  let best: OpenTaskRef | null = null;
  for (const p of phases) {
    for (const t of p.tasks) {
      if (t.checked) continue;
      const candidate: OpenTaskRef = { phase: p.number, file: p.file, task: t };
      if (best === null || compareOpenTasks(candidate, best) < 0) best = candidate;
    }
  }
  return best;
}

/** Order: highest priority first, then lowest phase number, then task position. */
export function compareOpenTasks(a: OpenTaskRef, b: OpenTaskRef): number {
  return (
    priorityRank(a.task.priority) - priorityRank(b.task.priority) ||
    a.phase - b.phase ||
    a.task.index - b.task.index
  );
}

export function parsePhaseFile(path: string, basename: string): PhaseFile {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  const tasks: Task[] = [];
  let goal: string | null = null;
  let dependsOn: string | null = null;
  let title = basename;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*```/.test(raw)) inCode = !inCode;
    if (inCode) continue;

    if (i === 0 || title === basename) {
      const h = raw.match(/^#\s+(.*)$/);
      if (h && title === basename) title = h[1].trim();
    }
    if (goal === null) {
      const g = raw.match(/^\s*Goal:\s*(.*)$/i);
      if (g) goal = g[1].trim();
    }
    if (dependsOn === null) {
      const d = raw.match(/^\s*Depends on:\s*(.*)$/i);
      if (d) dependsOn = d[1].trim();
    }
    const c = raw.match(CHECKBOX);
    if (c) {
      const rest = c[2].trim();
      const pm = rest.match(PRIORITY_RE);
      tasks.push({
        line: i + 1,
        index: tasks.length + 1,
        checked: c[1].toLowerCase() === "x",
        priority: pm ? (pm[1] as Priority) : null,
        text: pm ? rest.slice(pm[0].length).trim() : rest,
      });
    }
  }

  const checked = tasks.filter((t) => t.checked).length;
  return {
    file: basename,
    path,
    number: extractNumber(basename) ?? -1,
    title,
    goal,
    dependsOn,
    tasks,
    checked,
    total: tasks.length,
  };
}

/** Return 1-indexed line numbers of malformed checkbox-like lines (outside code). */
export function findMalformedTaskLines(path: string): number[] {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  const out: number[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (CHECKBOX.test(lines[i])) continue;
    if (MALFORMED.test(lines[i])) out.push(i + 1);
  }
  return out;
}

const EMOJI_SET = ["✅", "🟡", "⬜", "⛔"];

/** Parse the phase table out of the index file. */
export function parseIndex(path: string): IndexRow[] {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  const rows: IndexRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim().startsWith("|")) continue;
    const cells = raw
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    // Skip header + separator rows.
    if (/^-+:?$/.test(cells[0].replace(/:/g, "-")) || cells[0] === "#") continue;
    if (!/^\d+$/.test(cells[0])) continue;

    const number = parseInt(cells[0], 10);
    const fileCell = cells[1];
    const linkMatch = fileCell.match(/\]\(([^)]+)\)/);
    const file = linkMatch ? linkMatch[1].split("/").pop()! : null;
    const statusCell = cells[cells.length - 2];
    const emoji = EMOJI_SET.find((e) => statusCell.includes(e)) ?? null;
    const prog = statusCell.match(/(\d+)\s*\/\s*(\d+)/);
    rows.push({
      line: i + 1,
      number,
      file,
      purpose: cells[2] ?? "",
      emoji,
      checked: prog ? parseInt(prog[1], 10) : null,
      total: prog ? parseInt(prog[2], 10) : null,
      statusRaw: statusCell,
    });
  }
  return rows;
}

/** The emoji a phase's counts imply, ignoring blocked (which needs prose). */
export function expectedEmoji(checked: number, total: number): "✅" | "🟡" | "⬜" {
  if (total > 0 && checked === total) return "✅";
  if (checked === 0) return "⬜";
  return "🟡";
}
