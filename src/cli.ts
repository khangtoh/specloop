import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "./commands/check.js";
import { runStatus } from "./commands/status.js";
import { runInit } from "./commands/init.js";
import { runGoalCheck } from "./commands/goalCheck.js";
import { runUpgrade } from "./commands/upgrade.js";
import { runPrioTask } from "./commands/prioTask.js";
import { runPrioSpec } from "./commands/prioSpec.js";
import { runListSpec } from "./commands/listSpec.js";

/** Single source of truth for the version: the package's own package.json. */
function readVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readVersion();

const HELP = `specloop ${VERSION} — spec-driven loop engineering

Usage:
  specloop <command> [options]

Commands:
  init [dir]              Scaffold the spec/ structure, BACKLOG, AGENTS.md, config.
  check                   Validate the spec structure; non-zero exit on errors.
  status                  Show phase progress + next box, in BACKLOG order.
  list-spec [filter]      List phases in priority order (all|done|undone).
  prio-spec <NN> <pos>    Reprioritize a phase in BACKLOG (0=top, +up, -down).
  prio-task <NN.T>        Raise a task's priority within a phase (--to pN, or bump).
  upgrade [dir]           Adopt an existing project's spec model into specloop
                          (report; --apply to scaffold non-destructively).
  goal-check "<goal>"     Print the goal-completion-check prompt for "<goal>".
  help, --help            Show this help.
  version, --version      Show the version.

Options:
  --dir <path>            Project root to operate on (default: cwd).
  --force                 (init) overwrite an existing spec/ and files.
  --apply                 (upgrade) perform the adoption instead of a dry run.
  --json                  (check, status, list-spec) machine-readable output.
  --to <p1|p2|p3>         (prio-task) set an explicit priority instead of bumping.

Two priority levels compose: prio-spec picks the phase (BACKLOG order), and
within a phase, task tags \`- [ ] (p1) …\` (p1 high, p2/untagged medium, p3 low)
plus prio-task pick the box. The loop takes the top BACKLOG phase's highest
box. Done-state is always derived from the checkboxes; BACKLOG stores order.

Examples:
  specloop init
  specloop status
  specloop list-spec undone
  specloop prio-spec 22 0          # move phase 22 to the top of the backlog
  specloop prio-task 07.3 --to p1  # set phase 07's 3rd task to high
  specloop upgrade ./other-repo --apply
  specloop goal-check "the checkout flow is done"
`;

export function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return 0;
  }
  if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") {
    console.log(VERSION);
    return 0;
  }

  const cmd = args[0];
  const rest = args.slice(1);
  const dirFlag = takeFlagValue(rest, "--dir");
  const to = takeFlagValue(rest, "--to");
  const force = takeFlag(rest, "--force");
  const apply = takeFlag(rest, "--apply");
  const json = takeFlag(rest, "--json");
  const positional = rest.filter((a) => !a.startsWith("--"));
  const rootDir = dirFlag ?? process.cwd();

  switch (cmd) {
    case "init":
      return runInit(positional[0] ?? rootDir, { force });
    case "check":
      return runCheck(rootDir, { json });
    case "status":
      return runStatus(rootDir, { json });
    case "list-spec":
    case "listspec":
      return runListSpec(rootDir, positional[0], { json });
    case "prio-spec":
    case "priospec":
      return runPrioSpec(rootDir, positional[0], positional[1]);
    case "prio-task":
    case "priotask":
      return runPrioTask(rootDir, positional[0], to);
    case "upgrade":
      return runUpgrade(dirFlag ?? positional[0] ?? process.cwd(), { apply });
    case "goal-check":
    case "goalcheck":
      return runGoalCheck(rootDir, positional.join(" "));
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      return 1;
  }
}

function takeFlag(args: string[], name: string): boolean {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function takeFlagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const val = args[i + 1];
  args.splice(i, 2);
  return val;
}
