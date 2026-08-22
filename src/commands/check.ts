import { loadConfig } from "../config.js";
import { check } from "../validator/index.js";

const RED = "\x1b[31m";
const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

export function runCheck(rootDir: string, opts: { json?: boolean } = {}): number {
  const config = loadConfig(rootDir);
  const result = check(rootDir, config);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  const warns = result.issues.filter((i) => i.severity === "warn");

  for (const issue of result.issues) {
    const color = issue.severity === "error" ? RED : YEL;
    const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    const tag = issue.severity === "error" ? "✖" : "▲";
    console.log(`${color}${tag}${RST} ${loc} ${DIM}[${issue.rule}]${RST}\n    ${issue.message}`);
  }

  const totalChecked = result.phases.reduce((n, p) => n + p.checked, 0);
  const totalTasks = result.phases.reduce((n, p) => n + p.total, 0);

  console.log("");
  if (result.ok && warns.length === 0) {
    console.log(
      `${GRN}✔ specloop: structure valid${RST} — ${result.phases.length} phases, ${totalChecked}/${totalTasks} tasks checked.`,
    );
  } else if (result.ok) {
    console.log(
      `${GRN}✔ specloop: no errors${RST}, ${YEL}${warns.length} warning(s)${RST} — ${result.phases.length} phases, ${totalChecked}/${totalTasks} tasks.`,
    );
  } else {
    console.log(
      `${RED}✖ specloop: ${errors.length} error(s)${RST}, ${warns.length} warning(s). Structure invalid.`,
    );
  }
  return result.ok ? 0 : 1;
}
