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

/** A clean human title for a phase: drop a leading "Phase N —" or the phase's
 *  own number prefix (so "# 01 Foo" and "# Phase 1 — Foo" both give "Foo"). */
export function phaseTitle(rawTitle: string, num: number, fallback: string): string {
  let t = rawTitle.replace(/^Phase\s+\d+\s*[—:.\-]\s*/i, "").trim();
  t = t.replace(new RegExp(`^0*${num}\\b[\\s—:.\\-]*`), "").trim();
  return t || fallback;
}

export interface OpenTaskRef {
  phase: number;
  file: string;
  task: Task;
}

/** A phase is complete when it has tasks and all of them are checked. */
export function phaseComplete(p: PhaseFile): boolean {
  return p.total > 0 && p.checked === p.total;
}

/**
 * The next box the loop should take, given phases already in work order
 * (BACKLOG order, or numeric fallback). Phase order is primary — `prio-spec`
 * picks the phase; within a phase, task `(pN)` priority then position decide.
 * `Depends on:` gating is the agent's judgment (its prose isn't machine-
 * evaluated here) — this orders the frontier the agent chooses from.
 */
export function selectNextTask(phasesInOrder: PhaseFile[]): OpenTaskRef | null {
  let best: OpenTaskRef | null = null;
  let bestRank: [number, number, number] | null = null;
  phasesInOrder.forEach((p, phaseOrder) => {
    for (const t of p.tasks) {
      if (t.checked) continue;
      const rank: [number, number, number] = [phaseOrder, priorityRank(t.priority), t.index];
      if (bestRank === null || tupleLess(rank, bestRank)) {
        best = { phase: p.number, file: p.file, task: t };
        bestRank = rank;
      }
    }
  });
  return best;
}

function tupleLess(a: [number, number, number], b: [number, number, number]): boolean {
  const d = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return d < 0;
}

export interface BacklogEntry {
  line: number; // 1-indexed line in BACKLOG.md
  number: number; // phase id
  title: string;
}

const BACKLOG_HEADING = /^##\s+Phases\s*\(priority order\)/i;
const BACKLOG_ENTRY = /^\s*-\s+(?:\[[ xX]\]\s+)?(\d{2,})\b\s*(.*)$/;

/** Parse the ordered phase list out of BACKLOG.md's `## Phases (priority order)`. */
export function parseBacklog(path: string): BacklogEntry[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const out: BacklogEntry[] = [];
  let inSection = false;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*```/.test(raw)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (/^##\s+/.test(raw)) inSection = BACKLOG_HEADING.test(raw);
    if (!inSection) continue;
    const m = raw.match(BACKLOG_ENTRY);
    if (m) out.push({ line: i + 1, number: parseInt(m[1], 10), title: m[2].trim() });
  }
  return out;
}

/** Phases in work order: BACKLOG position if a backlog is given, else by number.
 *  Phases missing from the backlog are appended in numeric order. */
export function orderPhases(phases: PhaseFile[], backlog: BacklogEntry[] | null): PhaseFile[] {
  const byNumber = new Map(phases.map((p) => [p.number, p]));
  const ordered: PhaseFile[] = [];
  const seen = new Set<number>();
  if (backlog) {
    for (const e of backlog) {
      const p = byNumber.get(e.number);
      if (p && !seen.has(p.number)) {
        ordered.push(p);
        seen.add(p.number);
      }
    }
  }
  for (const p of [...phases].sort((a, b) => a.number - b.number)) {
    if (!seen.has(p.number)) ordered.push(p);
  }
  return ordered;
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
