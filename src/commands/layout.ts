import { join } from "node:path";
import { loadConfig } from "../config.js";
import { discoverPhases } from "../validator/parse.js";
import { recommendLayout, printLayoutReport } from "../layout.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

/**
 * Report each phase's layout (flat file vs. folder of sub-specs) and whether it
 * should change.   specloop layout [--json]
 */
export function runLayout(rootDir: string, opts: { json?: boolean } = {}): number {
  const config = loadConfig(rootDir);
  const { phases } = discoverPhases(join(rootDir, config.specDir), config.phasePattern);
  const report = recommendLayout(phases);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  console.log(
    `${BOLD}specloop layout${RST} ${DIM}(${config.specDir}/: ${report.flat} flat, ${report.grouped} grouped)${RST}\n`,
  );
  printLayoutReport(report, { verbose: true });
  return 0;
}
