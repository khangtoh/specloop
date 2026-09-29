import { AGENTS, runRefresh, type Agent } from "./commands/refresh.js";
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
import { runPreflight } from "./commands/preflight.js";
import { parseSkillsMode, SKILLS_MODES } from "./commands/agentAssets.js";
import { runLayout } from "./commands/layout.js";
import { runGroup } from "./commands/group.js";

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
  init [dir]              Scaffold the spec/ structure, BACKLOG, AGENTS.md, config,
                          and selected agent skills, commands and hooks.
  refresh [dir]          Refresh recognized agent assets (dry run; --apply to write).
  check                   Validate the spec structure; non-zero exit on errors.
  status                  Show phase progress + next box, in BACKLOG order.
  list [filter]           List phases in priority order (all|done|undone).
  preflight                Check workspace readiness without changing it.
  prio spec <NN> <pos>    Reprioritize a phase in BACKLOG (0=top, +up, -down).
  prio task <NN.T>        Raise a task's priority within a phase (--to pN, or bump).
  layout                  Show phase layouts and recommend changes.
  group <NN>              Group a flat phase (dry run; --apply to write).
  upgrade [dir]           Adopt an existing project's spec model into specloop
                          (report; --apply to scaffold non-destructively, incl.
                          selected agent skills, commands and hooks).
  audit "<goal>"          Print the goal-completion-check prompt for "<goal>".
  help, --help, -h        Show this help (also after any command).
  version, --version      Show the version.

Options:
  --dir <path>            Project root to operate on (default: cwd).
  --no-split              (group) move without splitting task sections.
  --force                 (init) overwrite an existing spec/ and files.
  --apply                 (upgrade, refresh, group) apply the inspected changes.
  --json                  (check, status, list, preflight, layout) machine-readable output.
  --to <p1|p2|p3>         (prio task) set an explicit priority instead of bumping.
  --agent <runtime>      (init, upgrade, refresh) claude (default), codex, both.
  --skills <mode>         (init, upgrade) how the specloop skills and /spec-*
                          commands land: copy (default), link
                          (symlink into a specloop checkout), or none.

Compatibility aliases: list-spec/listspec, prio-spec/priospec,
prio-task/priotask, goal-check/goalcheck.

Agent menu: submit $specloop in Codex or /specloop in Claude Code.
Claude marketplace installs use /specloop:specloop.
Append an action, e.g. $specloop status or /specloop prio task 07.3.
The agent also supports loop [phase]; the shell CLI has no loop command.
Bare shell specloop runs preflight; help only displays this text.

Two priority levels compose: prio spec picks the phase (BACKLOG order), and
within a phase, task tags \`- [ ] (p1) …\` (p1 high, p2/untagged medium, p3 low)
plus prio task pick the box. The loop takes the top BACKLOG phase's highest
box. Done-state is always derived from the checkboxes; BACKLOG stores order.

Examples:
  specloop init
  specloop status
  specloop list undone
  specloop prio spec 22 0          # move phase 22 to the top of the backlog
  specloop prio task 07.3 --to p1  # set phase 07's 3rd task to high
  specloop init --skills none      # scaffold spec/ only, no agent assets/hooks
  specloop layout
  specloop group 12 --apply
  specloop upgrade ./other-repo --apply
  specloop audit "the checkout flow is done"
`;

export function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0) return runPreflight(process.cwd(), {}).exitCode;
  if (args[0] === "help" || args.includes("--help") || args.includes("-h")) {
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
  const agentPresent = rest.includes("--agent");
  const agentRaw = takeFlagValue(rest, "--agent");
  if (agentPresent && !AGENTS.includes(agentRaw as Agent)) {
    console.error("Invalid --agent value. Expected claude, codex, or both."); return 1;
  }
  const agent = (agentRaw ?? "claude") as Agent;
  const skillsRaw = takeFlagValue(rest, "--skills");
  const skills = parseSkillsMode(skillsRaw);
  if (skillsRaw !== undefined && skills === undefined) {
    console.error(`Invalid --skills value: ${skillsRaw}. Expected one of: ${SKILLS_MODES.join(", ")}.`);
    return 1;
  }
  const noSplit = takeFlag(rest, "--no-split");
  const apply = takeFlag(rest, "--apply");
  const json = takeFlag(rest, "--json");
  const positional = rest.filter((a) => !a.startsWith("--"));
  const rootDir = dirFlag ?? process.cwd();

  switch (cmd) {
    case "init":
      return runInit(positional[0] ?? rootDir, { force, skills, agent });
    case "refresh":
      return runRefresh(dirFlag ?? positional[0] ?? process.cwd(), { apply, agent });
    case "check":
      return runCheck(rootDir, { json });
    case "preflight":
      return runPreflight(rootDir, { json }).exitCode;
    case "status":
      return runStatus(rootDir, { json });
    case "list":
    case "list-spec":
    case "listspec":
      return runListSpec(rootDir, positional[0], { json });
    case "prio":
      if (positional[0] === "spec") return runPrioSpec(rootDir, positional[1], positional[2]);
      if (positional[0] === "task") return runPrioTask(rootDir, positional[1], to);
      console.error("Usage: specloop prio spec <NN> <pos> | specloop prio task <NN.T> [--to p1|p2|p3]");
      return 1;
    case "prio-spec":
    case "priospec":
      return runPrioSpec(rootDir, positional[0], positional[1]);
    case "prio-task":
    case "priotask":
      return runPrioTask(rootDir, positional[0], to);
    case "layout":
      return runLayout(rootDir, { json });
    case "group":
      return runGroup(rootDir, positional[0], { apply, split: !noSplit });
    case "upgrade":
      return runUpgrade(dirFlag ?? positional[0] ?? process.cwd(), { apply, skills, agent });
    case "audit":
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
