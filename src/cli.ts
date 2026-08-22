import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "./commands/check.js";
import { runStatus } from "./commands/status.js";
import { runInit } from "./commands/init.js";
import { runGoalCheck } from "./commands/goalCheck.js";

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
  init [dir]            Scaffold the spec/ structure, AGENTS.md, and config
                        into [dir] (default: current directory).
  check                 Validate the spec structure; non-zero exit on errors.
  status               Show phase progress read straight from the checkboxes.
  goal-check "<goal>"   Print the goal-completion-check prompt for "<goal>".
  help, --help          Show this help.
  version, --version    Show the version.

Options:
  --dir <path>          Project root to operate on (default: cwd).
  --force               (init) overwrite an existing spec/ and files.
  --json                (check, status) machine-readable output.

Examples:
  specloop init
  specloop check
  specloop status
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
  const force = takeFlag(rest, "--force");
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
