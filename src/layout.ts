import { readFileSync } from "node:fs";
import { createFenceTracker, type PhaseFile } from "./validator/parse.js";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const RST = "\x1b[0m";

/** A flat phase this big is hard to work in as one file. */
export const GROUP_TASK_LIMIT = 40;
/** Above this size, several task-bearing sections also argue for grouping. */
export const GROUP_SECTION_TASKS = 25;
export const GROUP_MIN_SECTIONS = 3;
/** A group this small is overhead: one sub-spec (or none) and few tasks. */
export const FLATTEN_TASK_LIMIT = 10;

export interface Section {
  heading: string | null; // `## ` heading text, null for the preamble
  start: number; // 0-indexed first line (the heading line, or 0)
  end: number; // 0-indexed exclusive end
  tasks: number;
  checked: number;
}

/** Split a markdown body at top-level `## ` headings (outside code fences). */
export function splitSections(content: string): Section[] {
  const lines = content.split(/\r?\n/);
  const inCode = createFenceTracker();
  const sections: Section[] = [{ heading: null, start: 0, end: lines.length, tasks: 0, checked: 0 }];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (inCode(raw)) continue;
    const h = raw.match(/^##\s+(.*)$/);
    if (h) {
      sections[sections.length - 1].end = i;
      sections.push({ heading: h[1].trim(), start: i, end: lines.length, tasks: 0, checked: 0 });
      continue;
    }
    const c = raw.match(/^\s*-\s\[( |x|X)\]/);
    if (c) {
      const s = sections[sections.length - 1];
      s.tasks++;
      if (c[1] !== " ") s.checked++;
    }
  }
  return sections;
}

export type Advice = "keep" | "group" | "flatten";

export interface PhaseLayoutAdvice {
  number: number;
  name: string;
  layout: PhaseFile["layout"];
  total: number;
  advice: Advice;
  reason: string;
  /** For `group`: the `##` sections that would become sub-specs. */
  proposedParts: { heading: string; tasks: number }[];
}

export interface LayoutReport {
  phases: PhaseLayoutAdvice[];
  flat: number;
  grouped: number;
  summary: string;
}

function adviseOne(p: PhaseFile, content: string | null): PhaseLayoutAdvice {
  const base = { number: p.number, name: p.name, layout: p.layout, total: p.total, proposedParts: [] };
  if (p.layout === "grouped") {
    const subs = p.parts.length - 1;
    if (subs <= 1 && p.total <= FLATTEN_TASK_LIMIT) {
      return {
        ...base,
        advice: "flatten",
        reason: `${subs} sub-spec, ${p.total} tasks — a single file is simpler`,
      };
    }
    return { ...base, advice: "keep", reason: `${subs} sub-specs, ${p.total} tasks` };
  }

  // Restructuring finished work only churns history and links.
  if (p.total > 0 && p.checked === p.total) {
    return { ...base, advice: "keep", reason: `${p.total} tasks, complete` };
  }
  const taskSections = content
    ? splitSections(content).filter((s) => s.heading !== null && s.tasks > 0)
    : [];
  const proposedParts = taskSections.map((s) => ({ heading: s.heading!, tasks: s.tasks }));
  const bigSections = taskSections.filter((s) => s.tasks >= 3).length;
  if (p.total > GROUP_TASK_LIMIT && taskSections.length >= 2) {
    return {
      ...base,
      advice: "group",
      reason: `${p.total} tasks in one file (> ${GROUP_TASK_LIMIT})`,
      proposedParts,
    };
  }
  if (p.total > GROUP_SECTION_TASKS && bigSections >= GROUP_MIN_SECTIONS) {
    return {
      ...base,
      advice: "group",
      reason: `${p.total} tasks across ${bigSections} sections of 3+ tasks`,
      proposedParts,
    };
  }
  return { ...base, advice: "keep", reason: `${p.total} tasks` };
}

/**
 * Recommend a layout for each phase. Flat is the default; grouping pays off
 * when one file holds a large, sectioned body of work that people (or parallel
 * agents) would otherwise edit at once.
 */
export function recommendLayout(
  phases: PhaseFile[],
  readContent: (p: PhaseFile) => string | null = defaultRead,
): LayoutReport {
  const advice = phases.map((p) => adviseOne(p, p.layout === "flat" ? readContent(p) : null));
  const flat = phases.filter((p) => p.layout === "flat").length;
  const grouped = phases.length - flat;
  const toGroup = advice.filter((a) => a.advice === "group").map((a) => pad(a.number));
  const toFlatten = advice.filter((a) => a.advice === "flatten").map((a) => pad(a.number));
  let summary: string;
  if (toGroup.length === 0 && toFlatten.length === 0) {
    summary = `Current layout fits (${flat} flat, ${grouped} grouped). Keep new phases flat until one outgrows a single file.`;
  } else {
    const parts = [];
    if (toGroup.length) parts.push(`group ${toGroup.join(", ")} (specloop group <NN>)`);
    if (toFlatten.length) parts.push(`flatten ${toFlatten.join(", ")} (by hand)`);
    summary = `Mixed layout recommended: ${parts.join("; ")}. Everything else stays as is.`;
  }
  return { phases: advice, flat, grouped, summary };
}

function defaultRead(p: PhaseFile): string | null {
  try {
    return readFileSync(p.path, "utf8");
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function printLayoutReport(
  report: LayoutReport,
  opts: { indent?: string; heading?: string; verbose?: boolean } = {},
): void {
  const ind = opts.indent ?? "";
  if (opts.heading) console.log(`${BOLD}${opts.heading}${RST}`);
  for (const a of report.phases) {
    if (!opts.verbose && a.advice === "keep") continue;
    const color = a.advice === "keep" ? DIM : YEL;
    console.log(
      `${ind}${color}${a.advice.padEnd(7)}${RST} ${pad(a.number)} ${a.name} ${DIM}(${a.layout}; ${a.reason})${RST}`,
    );
    if (a.advice === "group") {
      for (const part of a.proposedParts) {
        console.log(`${ind}          ${DIM}└ ${part.heading} — ${part.tasks} tasks${RST}`);
      }
    }
  }
  const allKeep = report.phases.every((a) => a.advice === "keep");
  console.log(`${ind}${allKeep ? GRN + "✔" : YEL + "▲"}${RST} ${report.summary}`);
}
