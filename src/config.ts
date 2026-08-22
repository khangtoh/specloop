import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export interface SpecloopConfig {
  specDir: string;
  indexFile: string;
  phasePattern: string;
  requiredProcessFiles: string[];
  requireGoalLine: boolean;
  requireDependsOnLine: boolean;
  enforceIndexCounts: boolean;
  agentsFile: string;
}

export const DEFAULT_CONFIG: SpecloopConfig = {
  specDir: "spec",
  indexFile: "README.md",
  phasePattern: "^\\d{2,}-.*\\.md$",
  requiredProcessFiles: [
    "README.md",
    "spec-summary-status.md",
    "goal-completion-check.md",
    "agent-session-ledger.md",
  ],
  requireGoalLine: true,
  requireDependsOnLine: true,
  enforceIndexCounts: true,
  agentsFile: "AGENTS.md",
};

/** Load `.specloop.json` from the project root, merged over defaults. */
export function loadConfig(rootDir: string): SpecloopConfig {
  const path = join(rootDir, ".specloop.json");
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  let raw: Partial<SpecloopConfig>;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`.specloop.json is not valid JSON: ${(e as Error).message}`);
  }
  return { ...DEFAULT_CONFIG, ...raw };
}
