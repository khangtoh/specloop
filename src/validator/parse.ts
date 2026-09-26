import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
  file: string; // phase-relative source file: "NN-x.md", or "NN-x/NNa-y.md" in a group
  line: number; // 1-indexed line in that file
  index: number; // 1-indexed position among the phase's checkbox tasks
  checked: boolean;
  priority: Priority | null;
  text: string; // task text, priority tag stripped
}

export type PhaseLayout = "flat" | "grouped";

/** One markdown file that belongs to a phase (the phase file, or a group member). */
export interface PhasePart {
  file: string; // spec-relative path
  path: string; // absolute
  title: string;
  checked: number;
  total: number;
}

export interface PhaseFile {
  /** Spec-relative path of the phase root: "NN-x.md" (flat) or "NN-x/README.md" (grouped). */
  file: string;
  path: string; // absolute path of the root file
  number: number;
  layout: PhaseLayout;
  /** Grouped: the folder name. Flat: same as `file`. */
  name: string;
  title: string;
  goal: string | null;
  dependsOn: string | null;
  tasks: Task[];
  checked: number;
  total: number;
  /** Every file contributing tasks, root first then sub-specs in name order. */
  parts: PhasePart[];
}

/** A row parsed from the index (README) phase table. */
export interface IndexRow {
  line: number;
  number: number | null;
  file: string | null; // linked target, normalized spec-relative path
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

/** Root file of a grouped phase folder. */
export const GROUP_ROOT = "README.md";
const NUMBERED_DIR = /^\d{2,}-/;

/**
 * Line-by-line fenced-code tracker (CommonMark rules, indentation-tolerant so
 * fences inside list items count). Returns true for fence lines and every line
 * inside a fence. A backtick run followed by an info string that itself holds a
 * backtick is inline code in prose, not a fence — "a ```mermaid fence renders
 * as `<div>`" must not swallow the rest of the file.
 */
export function createFenceTracker(): (line: string) => boolean {
  let open: { ch: string; len: number } | null = null;
  return (line: string) => {
    const m = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (open) {
      if (m && m[1][0] === open.ch && m[1].length >= open.len && m[2].trim() === "") open = null;
      return true;
    }
    if (!m) return false;
    if (m[1][0] === "`" && m[2].includes("`")) return false;
    open = { ch: m[1][0], len: m[1].length };
    return true;
  };
}

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
        best = { phase: p.number, file: t.file, task: t };
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
  const inCode = createFenceTracker();
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (inCode(raw)) continue;
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

export interface ParsedContent {
  title: string | null;
  goal: string | null;
  dependsOn: string | null;
  tasks: Omit<Task, "index" | "file">[];
}

/** Parse one markdown body: H1 title, Goal:/Depends on: lines, checkbox tasks. */
export function parsePhaseContent(content: string): ParsedContent {
  const lines = content.split(/\r?\n/);
  const tasks: ParsedContent["tasks"] = [];
  let goal: string | null = null;
  let dependsOn: string | null = null;
  let title: string | null = null;
  const inCode = createFenceTracker();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (inCode(raw)) continue;

    if (title === null) {
      const h = raw.match(/^#\s+(.*)$/);
      if (h) title = h[1].trim();
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
        checked: c[1].toLowerCase() === "x",
        priority: pm ? (pm[1] as Priority) : null,
        text: pm ? rest.slice(pm[0].length).trim() : rest,
      });
    }
  }
  return { title, goal, dependsOn, tasks };
}

function toPart(file: string, path: string, parsed: ParsedContent): PhasePart {
  return {
    file,
    path,
    title: parsed.title ?? file,
    checked: parsed.tasks.filter((t) => t.checked).length,
    total: parsed.tasks.length,
  };
}

function assemble(
  root: { file: string; path: string; name: string; layout: PhaseLayout; number: number },
  files: { file: string; path: string; parsed: ParsedContent }[],
): PhaseFile {
  const head = files[0].parsed;
  const tasks: Task[] = [];
  for (const f of files) {
    for (const t of f.parsed.tasks) tasks.push({ ...t, file: f.file, index: tasks.length + 1 });
  }
  const checked = tasks.filter((t) => t.checked).length;
  return {
    ...root,
    title: head.title ?? root.name,
    goal: head.goal,
    dependsOn: head.dependsOn,
    tasks,
    checked,
    total: tasks.length,
    parts: files.map((f) => toPart(f.file, f.path, f.parsed)),
  };
}

/** Parse a flat phase file (`spec/NN-slug.md`). */
export function parsePhaseFile(path: string, basename: string): PhaseFile {
  const parsed = parsePhaseContent(readFileSync(path, "utf8"));
  return assemble(
    { file: basename, path, name: basename, layout: "flat", number: extractNumber(basename) ?? -1 },
    [{ file: basename, path, parsed }],
  );
}

/** Sub-spec files of a grouped phase folder, in name order (root excluded). */
export function groupMembers(dirPath: string): string[] {
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".md") && f !== GROUP_ROOT)
    .filter((f) => statSync(join(dirPath, f)).isFile())
    .sort();
}

/**
 * Parse a grouped phase (`spec/NN-slug/README.md` + sub-specs). The root
 * carries Goal:/Depends on:; tasks aggregate root-first, then sub-specs by name,
 * numbered continuously so `prio-task NN.T` addresses the whole group.
 */
export function parseGroupedPhase(dirPath: string, dirName: string): PhaseFile {
  const rootPath = join(dirPath, GROUP_ROOT);
  const files = [
    { file: `${dirName}/${GROUP_ROOT}`, path: rootPath },
    ...groupMembers(dirPath).map((f) => ({ file: `${dirName}/${f}`, path: join(dirPath, f) })),
  ].map((f) => ({ ...f, parsed: parsePhaseContent(readFileSync(f.path, "utf8")) }));
  return assemble(
    {
      file: `${dirName}/${GROUP_ROOT}`,
      path: rootPath,
      name: dirName,
      layout: "grouped",
      number: extractNumber(dirName) ?? -1,
    },
    files,
  );
}

export interface Discovery {
  phases: PhaseFile[];
  /** Numbered folders with no README.md root — not phases, reported as errors. */
  rootlessGroups: string[];
}

/** Find every phase under the spec dir: flat files matching `phasePattern`
 *  plus numbered folders holding a `README.md` root. Sorted by name. */
export function discoverPhases(specDir: string, phasePattern: string): Discovery {
  if (!existsSync(specDir)) return { phases: [], rootlessGroups: [] };
  const phaseRe = new RegExp(phasePattern);
  const phases: PhaseFile[] = [];
  const rootlessGroups: string[] = [];
  for (const entry of readdirSync(specDir).sort()) {
    const abs = join(specDir, entry);
    const isDir = statSync(abs).isDirectory();
    if (!isDir && phaseRe.test(entry)) {
      phases.push(parsePhaseFile(abs, entry));
    } else if (isDir && NUMBERED_DIR.test(entry)) {
      if (existsSync(join(abs, GROUP_ROOT))) phases.push(parseGroupedPhase(abs, entry));
      else rootlessGroups.push(entry);
    }
  }
  return { phases, rootlessGroups };
}

/** Return 1-indexed line numbers of malformed checkbox-like lines (outside code). */
export function findMalformedTaskLines(path: string): number[] {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  const out: number[] = [];
  const inCode = createFenceTracker();
  for (let i = 0; i < lines.length; i++) {
    if (inCode(lines[i])) continue;
    if (CHECKBOX.test(lines[i])) continue;
    if (MALFORMED.test(lines[i])) out.push(i + 1);
  }
  return out;
}

const EMOJI_SET = ["✅", "🟡", "⬜", "⛔"];

/**
 * Normalize an index link target to a spec-relative phase path: drop any
 * `#anchor` and leading `./`; a folder link (`NN-x/` or bare `NN-x`) means its
 * `README.md` root.
 */
export function normalizePhaseLink(target: string): string {
  let t = target.split("#")[0].trim().replace(/^(\.\/)+/, "");
  if (t.endsWith("/")) t += GROUP_ROOT;
  else if (NUMBERED_DIR.test(t) && !t.includes("/") && !/\.md$/i.test(t)) t += `/${GROUP_ROOT}`;
  return t;
}

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
    const file = linkMatch ? normalizePhaseLink(linkMatch[1]) : null;
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
