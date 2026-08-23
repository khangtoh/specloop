import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SpecloopConfig } from "./config.js";
import { check } from "./validator/index.js";
import { parseBacklog, orderPhases, type PhaseFile, type BacklogEntry } from "./validator/parse.js";

export interface OrderedSpecs {
  phases: PhaseFile[]; // as parsed (unordered)
  backlog: BacklogEntry[] | null; // null when no BACKLOG.md
  ordered: PhaseFile[]; // phases in work order (backlog, then numeric fallback)
  backlogPath: string;
  hasBacklog: boolean;
}

export function backlogPath(rootDir: string, config: SpecloopConfig): string {
  return join(rootDir, config.specDir, "BACKLOG.md");
}

/** Load phase files and the BACKLOG order in one shot, ordered for the loop. */
export function loadOrdered(rootDir: string, config: SpecloopConfig): OrderedSpecs {
  const phases = check(rootDir, config).phases;
  const bp = backlogPath(rootDir, config);
  const backlog = existsSync(bp) ? parseBacklog(bp) : null;
  return {
    phases,
    backlog,
    ordered: orderPhases(phases, backlog),
    backlogPath: bp,
    hasBacklog: backlog !== null,
  };
}
