import { loadConfig } from "../config.js";
import { loadOrdered } from "../backlog.js";
import { phaseComplete, phaseTitle, type PhaseFile } from "../validator/parse.js";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GRN = "\x1b[32m";
const RST = "\x1b[0m";

type Filter = "all" | "done" | "undone";

/**
 * List phases in priority (BACKLOG) order with derived done-state.
 *   specloop list-spec [all|done|undone]   (default: undone)
 * The leading number is the 1-based priority position in the full order, so a
 * filtered view can legitimately show gaps.
 */
export function runListSpec(rootDir: string, arg?: string, opts: { json?: boolean } = {}): number {
  const filter = (arg ?? "undone") as Filter;
  if (!["all", "done", "undone"].includes(filter)) {
    console.error(`Unknown filter '${arg}'. Use: all, done, undone.`);
    return 1;
  }
  const config = loadConfig(rootDir);
  const { ordered, hasBacklog } = loadOrdered(rootDir, config);

  const rows = ordered.map((p, i) => ({ pos: i + 1, phase: p, done: phaseComplete(p) }));
  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "done" ? r.done : !r.done,
  );

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          hasBacklog,
          filter,
          phases: shown.map((r) => ({
            position: r.pos,
            number: r.phase.number,
            title: displayTitle(r.phase),
            done: r.done,
            checked: r.phase.checked,
            total: r.phase.total,
          })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const src = hasBacklog ? "BACKLOG.md" : "numeric order (no BACKLOG.md)";
  console.log(`${BOLD}specloop list-spec${RST} ${DIM}(${filter}, ${src})${RST}\n`);
  if (shown.length === 0) {
    console.log(filter === "done" ? "No done phases yet." : "No remaining phases.");
    return 0;
  }
  for (const r of shown) {
    const box = r.done ? `${GRN}[x]${RST}` : "[ ]";
    console.log(
      `${String(r.pos).padStart(2)}. ${box} ${String(r.phase.number).padStart(2, "0")} ${displayTitle(r.phase)} ${DIM}— ${r.phase.checked}/${r.phase.total} (${r.phase.file})${RST}`,
    );
  }
  return 0;
}

/** Prefer the phase's H1 title; fall back to its Goal's first clause. */
function displayTitle(p: PhaseFile): string {
  const t = phaseTitle(p.title, p.number, "");
  if (t && t !== p.file) return t;
  if (p.goal) return p.goal.split(/[.;]/)[0].trim();
  return p.file;
}
