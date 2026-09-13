import { cpSync, existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installAgentAssets, type SkillsMode } from "./agentAssets.js";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

/** Package root = two levels up from this file (src/commands -> package). */
function templateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "template");
}

export function runInit(
  targetDir: string,
  opts: { force?: boolean; skills?: SkillsMode } = {},
): number {
  const tpl = templateDir();
  if (!existsSync(tpl)) {
    console.error(`Template directory not found at ${tpl}.`);
    return 1;
  }

  const specDest = join(targetDir, "spec");
  if (existsSync(specDest) && readdirSync(specDest).length > 0 && !opts.force) {
    console.error(
      `${YEL}Refusing to init:${RST} '${specDest}' already exists and is non-empty. Re-run with --force to overwrite.`,
    );
    return 1;
  }

  mkdirSync(targetDir, { recursive: true });

  // spec/ directory (always).
  cpSync(join(tpl, "spec"), specDest, { recursive: true });
  console.log(`${GRN}✔${RST} spec/  ${DIM}(README, process files, example phase)${RST}`);

  // .specloop.json config.
  copyIfAbsentOrForce(join(tpl, ".specloop.json"), join(targetDir, ".specloop.json"), opts.force);

  // AGENTS.md — don't clobber an existing one unless forced.
  copyIfAbsentOrForce(join(tpl, "AGENTS.md"), join(targetDir, "AGENTS.md"), opts.force);

  // Project-scoped agent assets, so the repo onboards without a plugin install.
  const assets = installAgentAssets(targetDir, { mode: opts.skills ?? "copy", force: opts.force });

  console.log(`\n${GRN}specloop initialized.${RST} Next steps:`);
  console.log(`  1. Edit ${DIM}spec/README.md${RST} — set the project goal and replace the example phase.`);
  console.log(`  2. Write your phases as ${DIM}spec/NN-title.md${RST} (copy ${DIM}spec/_TEMPLATE-phase.md${RST}).`);
  console.log(`  3. Run ${DIM}specloop check${RST} to validate the structure.`);
  console.log(`  4. Run the loop: pick the next unchecked box, verify, check it, hand off, commit.`);
  if (assets.installed.length > 0) {
    console.log(
      `\n${DIM}The specloop skill and /spec-* commands are installed in .claude/ for this` +
        `\nrepository — restart the agent session to pick them up, then run /spec-loop.${RST}`,
    );
  }
  return 0;
}

function copyIfAbsentOrForce(src: string, dest: string, force?: boolean): void {
  if (existsSync(dest) && !force) {
    console.log(`${YEL}▲${RST} ${dest.split("/").pop()} already exists — kept ${DIM}(use --force to overwrite)${RST}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`${GRN}✔${RST} ${dest.split("/").pop()}`);
}
