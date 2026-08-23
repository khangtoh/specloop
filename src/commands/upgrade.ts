import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { parsePhaseFile, extractNumber, phaseTitle } from "../validator/parse.js";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const CYN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

type Model = "specloop" | "dillinger-like" | "omarchy-like" | "ad-hoc" | "none";

interface Detection {
  specDir: string | null; // relative
  model: Model;
  numbered: string[]; // numbered spec filenames
  hasBacklog: boolean;
  hasProcessFiles: { summaryStatus: boolean; goalCheck: boolean; ledger: boolean };
  hasTasks: boolean; // any `- [ ]` inside spec files
  hasGoalDepends: boolean; // Goal:/Depends on: headers
  hasPrdSections: boolean; // Summary/Problem/Scope
  hasAgents: boolean;
}

const PROCESS_FILES = {
  summaryStatus: "spec-summary-status.md",
  goalCheck: "goal-completion-check.md",
  ledger: "agent-session-ledger.md",
};

function templateDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "template");
}

/** Find the most likely spec directory and classify the model in use. */
export function detect(rootDir: string): Detection {
  const candidates = ["spec", "docs/specs", "specs"].map((d) => ({ rel: d, abs: join(rootDir, d) }));
  const found = candidates.find((c) => existsSync(c.abs) && statSync(c.abs).isDirectory());

  const base: Detection = {
    specDir: null,
    model: "none",
    numbered: [],
    hasBacklog: false,
    hasProcessFiles: { summaryStatus: false, goalCheck: false, ledger: false },
    hasTasks: false,
    hasGoalDepends: false,
    hasPrdSections: false,
    hasAgents: existsSync(join(rootDir, "AGENTS.md")),
  };
  if (!found) return base;

  const files = readdirSync(found.abs);
  const numbered = files.filter((f) => /^\d{2,}-.*\.md$/.test(f)).sort();
  const bodies = numbered.map((f) => {
    try {
      return readFileSync(join(found.abs, f), "utf8");
    } catch {
      return "";
    }
  });
  const joined = bodies.join("\n");

  const det: Detection = {
    ...base,
    specDir: found.rel,
    numbered,
    hasBacklog: files.includes("BACKLOG.md"),
    hasProcessFiles: {
      summaryStatus: files.includes(PROCESS_FILES.summaryStatus),
      goalCheck: files.includes(PROCESS_FILES.goalCheck),
      ledger: files.includes(PROCESS_FILES.ledger),
    },
    hasTasks: /^\s*-\s\[[ xX]\]/m.test(joined),
    hasGoalDepends: /^\s*Goal:/im.test(joined) && /^\s*Depends on:/im.test(joined),
    hasPrdSections: /^##\s+(Summary|Problem|Scope)\b/im.test(joined),
  };

  const p = det.hasProcessFiles;
  if (p.summaryStatus && p.goalCheck && p.ledger) det.model = "specloop";
  else if (det.hasGoalDepends && det.hasTasks) det.model = "dillinger-like";
  else if (det.hasBacklog || det.hasPrdSections) det.model = "omarchy-like";
  else if (numbered.length > 0) det.model = "ad-hoc";
  else det.model = "none";
  return det;
}

/**
 * Inspect a project's existing spec model and adopt it into specloop.
 *   specloop upgrade [dir] [--apply]
 * Without --apply: report what was found and what adoption would do (dry run).
 * With --apply: non-destructively scaffold missing specloop process files,
 * an AGENTS binding, and generate BACKLOG.md from the existing numbered specs.
 * Never overwrites existing spec content; re-authoring PRD-style specs into
 * atomic-task phases is the agent's job (see the /spec-upgrade command).
 */
export function runUpgrade(rootDir: string, opts: { apply?: boolean } = {}): number {
  const det = detect(rootDir);
  console.log(`${BOLD}specloop upgrade${RST} ${DIM}(inspecting ${rootDir})${RST}\n`);

  if (det.model === "none" || !det.specDir) {
    console.log(
      `No existing spec model found (looked in spec/, docs/specs/, specs/).\n` +
        `This looks like a fresh project — run ${CYN}specloop init${RST} instead.`,
    );
    return det.model === "none" ? 0 : 1;
  }

  console.log(`Detected model: ${BOLD}${det.model}${RST}  ${DIM}in ${det.specDir}/${RST}`);
  console.log(`  numbered specs:     ${det.numbered.length}`);
  console.log(`  in-file tasks:      ${yesno(det.hasTasks)} ${DIM}(- [ ] checkboxes)${RST}`);
  console.log(`  Goal:/Depends on:   ${yesno(det.hasGoalDepends)}`);
  console.log(`  PRD sections:       ${yesno(det.hasPrdSections)} ${DIM}(Summary/Problem/Scope)${RST}`);
  console.log(`  BACKLOG.md:         ${yesno(det.hasBacklog)}`);
  console.log(
    `  process files:      summary-status ${yesno(det.hasProcessFiles.summaryStatus)}, ` +
      `goal-check ${yesno(det.hasProcessFiles.goalCheck)}, ledger ${yesno(det.hasProcessFiles.ledger)}`,
  );
  console.log(`  AGENTS.md:          ${yesno(det.hasAgents)}\n`);

  const actions = planActions(det, rootDir);
  if (actions.length === 0) {
    if (opts.apply) reportKeptFiles(det, rootDir);
    console.log(`${GRN}✔ Already a complete specloop layout.${RST} Nothing to adopt.`);
    return 0;
  }

  console.log(`${BOLD}Adoption plan:${RST}`);
  for (const a of actions) console.log(`  ${opts.apply ? "•" : "◦"} ${a.label}`);
  console.log("");

  if (det.model === "omarchy-like" || det.hasPrdSections) {
    console.log(
      `${YEL}Note:${RST} PRD-style specs need re-authoring into atomic-task phases\n` +
        `(Goal:/Depends on: + '- [ ]' tasks). specloop scaffolds the structure; use the\n` +
        `${CYN}/spec-upgrade${RST} agent command to map each spec's Acceptance Criteria into tasks.\n`,
    );
  }

  if (!opts.apply) {
    console.log(`${DIM}Dry run. Re-run with ${RST}${CYN}--apply${RST}${DIM} to perform the adoption.${RST}`);
    return 0;
  }

  const specAbs = join(rootDir, det.specDir);
  reportKeptFiles(det, rootDir);
  for (const a of actions) a.run(rootDir, specAbs, det);
  console.log(`\n${GRN}✔ Adoption applied.${RST} Run ${CYN}specloop check${RST} to validate.`);
  return 0;
}

interface Action {
  label: string;
  run: (rootDir: string, specAbs: string, det: Detection) => void;
}
/** Report protected existing files without adding them to the missing-file plan. */
function reportKeptFiles(det: Detection, rootDir: string): void {
  for (const [key, name] of Object.entries(PROCESS_FILES) as [keyof typeof PROCESS_FILES, string][]) {
    if (det.hasProcessFiles[key]) console.log(`${YEL}▲${RST} ${name} exists — kept`);
  }
  if (det.hasBacklog) console.log(`${YEL}▲${RST} BACKLOG.md exists — kept`);
  if (det.hasAgents) console.log(`${YEL}▲${RST} AGENTS.md exists — kept`);
  if (existsSync(join(rootDir, ".specloop.json"))) console.log(`${YEL}▲${RST} .specloop.json exists — kept`);
}


function planActions(det: Detection, rootDir: string): Action[] {
  const actions: Action[] = [];
  const tpl = templateDir();

  for (const [key, name] of Object.entries(PROCESS_FILES) as [keyof typeof PROCESS_FILES, string][]) {
    if (!det.hasProcessFiles[key]) {
      actions.push({
        label: `add ${det.specDir}/${name}`,
        run: (_r, specAbs) => copyIfAbsent(join(tpl, "spec", name), join(specAbs, name)),
      });
    }
  }
  if (!det.hasBacklog) {
    actions.push({
      label: `generate ${det.specDir}/BACKLOG.md from ${det.numbered.length} numbered specs`,
      run: (_r, specAbs, d) => generateBacklog(specAbs, d),
    });
  }
  if (!det.hasAgents) {
    actions.push({
      label: `add AGENTS.md (specloop binding)`,
      run: (rootDir) => copyIfAbsent(join(tpl, "AGENTS.md"), join(rootDir, "AGENTS.md")),
    });
  }
  if (!existsSync(join(rootDir, ".specloop.json"))) {
    actions.push({
      label: `add .specloop.json (validator config)`,
      run: (rootDir, _s, d) => writeConfig(rootDir, d),
    });
  }
  return actions;
}

function generateBacklog(specAbs: string, det: Detection): void {
  const lines = [
    "# Backlog",
    "",
    "Priority-ordered list of phases. **List position = work order (top = next).**",
    "`NN` is a stable spec id, not a priority. Done-state is derived from each",
    "phase's checkboxes — reprioritize with `specloop prio-spec <NN> <pos>`.",
    "",
    "## Phases (priority order)",
    "",
  ];
  for (const f of det.numbered) {
    const num = extractNumber(f);
    if (num === null) continue;
    const phase = parsePhaseFile(join(specAbs, f), f);
    const title = phaseTitle(phase.title, num, f);
    lines.push(`- ${String(num).padStart(2, "0")} ${title}`);
  }
  lines.push("");
  writeFileSync(join(specAbs, "BACKLOG.md"), lines.join("\n"));
  console.log(`${GRN}✔${RST} generated BACKLOG.md (${det.numbered.length} phases)`);
}

function writeConfig(rootDir: string, det: Detection): void {
  const cfg = {
    specDir: det.specDir,
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
  writeFileSync(join(rootDir, ".specloop.json"), JSON.stringify(cfg, null, 2) + "\n");
  console.log(`${GRN}✔${RST} wrote .specloop.json (specDir: ${det.specDir})`);
}

function copyIfAbsent(src: string, dest: string): void {
  if (existsSync(dest)) {
    console.log(`${YEL}▲${RST} ${dest.split("/").pop()} exists — kept`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`${GRN}✔${RST} ${dest.split("/").pop()}`);
}

function yesno(b: boolean): string {
  return b ? `${GRN}yes${RST}` : `${DIM}no${RST}`;
}
