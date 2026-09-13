import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

/** How the shipped skills and slash commands land in the target repository. */
export type SkillsMode = "copy" | "link" | "none";

export const SKILLS_MODES: SkillsMode[] = ["copy", "link", "none"];

/** What the target repository has, and is missing, of the shipped agent assets. */
export interface AgentAssetPlan {
  /** Assets absent from the target, as repo-relative paths. */
  missing: string[];
  /** Assets already present, and therefore protected without `--force`. */
  present: string[];
  /** Set to the searched path when the shipped plugin directory is unavailable. */
  unavailable?: string;
}

export interface AgentAssetResult extends AgentAssetPlan {
  /** Assets written by this call, as repo-relative paths. */
  installed: string[];
  /** The mode actually used — `link` degrades to `copy` from an unlinkable source. */
  mode: SkillsMode;
}

/**
 * The plugin's two asset groups and where a project-scoped agent reads them.
 * Claude Code discovers `.claude/skills/<name>/SKILL.md` and
 * `.claude/commands/<name>.md`; the shipped files reference only repo-relative
 * `spec/` paths and the `specloop` CLI, so they need no rewriting when copied.
 */
const GROUPS = [
  { src: "skills", dest: join(".claude", "skills") },
  { src: "commands", dest: join(".claude", "commands") },
] as const;

/** Package root = two levels up from src/commands; `plugin` ships via package.json `files`. */
export function pluginDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "plugin", "specloop");
}

/** `existsSync` reports false for a broken symlink; a broken link still occupies the path. */
function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * A symlink into a bun cache or an ignored `node_modules/` rots: the cache is
 * swept, and `node_modules/` is absent for the next person to clone the repo.
 */
function linkable(src: string): boolean {
  return !/[\\/](?:node_modules|\.bun[\\/]install[\\/]cache)[\\/]/.test(src);
}

/**
 * A relative link is portable across checkouts, but `relative()` is lexical:
 * computed through a symlinked parent (macOS `/var` -> `/private/var`) it
 * produces a link the kernel resolves somewhere else. Measure between the
 * physical paths so the result is correct from where the link actually sits.
 */
function linkTarget(linkPath: string, sourcePath: string): string {
  try {
    return relative(realpathSync(dirname(linkPath)), realpathSync(sourcePath));
  } catch {
    return relative(dirname(linkPath), sourcePath);
  }
}

export function parseSkillsMode(value: string | undefined): SkillsMode | undefined {
  if (value === undefined) return undefined;
  return (SKILLS_MODES as string[]).includes(value) ? (value as SkillsMode) : undefined;
}

/** Inspect the target without changing it — the dry-run half of the install. */
export function planAgentAssets(targetDir: string, src: string = pluginDir()): AgentAssetPlan {
  if (!existsSync(src)) return { missing: [], present: [], unavailable: src };

  const plan: AgentAssetPlan = { missing: [], present: [] };
  for (const group of GROUPS) {
    const from = join(src, group.src);
    if (!existsSync(from)) continue;
    for (const entry of readdirSync(from).sort()) {
      const rel = join(group.dest, entry);
      (exists(join(targetDir, rel)) ? plan.present : plan.missing).push(rel);
    }
  }
  return plan;
}

/**
 * Install the specloop skills and `/spec-*` commands into the target repo so a
 * fresh clone onboards without a separate plugin install. Never clobbers an
 * existing asset unless `force` is set — a project may have edited its copy.
 */
export function installAgentAssets(
  targetDir: string,
  opts: { mode?: SkillsMode; force?: boolean } = {},
): AgentAssetResult {
  const mode = opts.mode ?? "copy";
  const src = pluginDir();
  const result: AgentAssetResult = { ...planAgentAssets(targetDir, src), installed: [], mode };
  if (mode === "none") return result;

  if (result.unavailable) {
    console.log(`${YEL}▲${RST} plugin assets not found at ${result.unavailable} — skills not installed.`);
    return result;
  }

  if (mode === "link" && !linkable(src)) {
    console.log(
      `${YEL}▲${RST} --skills link needs a checkout of specloop; a link into\n` +
        `  ${DIM}${src}${RST} would break — copying instead.`,
    );
    result.mode = "copy";
  }

  for (const group of GROUPS) {
    const from = join(src, group.src);
    if (!existsSync(from)) continue;
    mkdirSync(join(targetDir, group.dest), { recursive: true });

    for (const entry of readdirSync(from).sort()) {
      const rel = join(group.dest, entry);
      const to = join(targetDir, rel);

      if (exists(to) && !opts.force) {
        console.log(`${YEL}▲${RST} ${rel} exists — kept ${DIM}(--force to overwrite)${RST}`);
        continue;
      }
      if (exists(to)) rmSync(to, { recursive: true, force: true });

      if (result.mode === "link") symlinkSync(linkTarget(to, join(from, entry)), to);
      else cpSync(join(from, entry), to, { recursive: true });

      result.installed.push(rel);
      console.log(`${GRN}✔${RST} ${rel}`);
    }
  }
  return result;
}

/** One line describing what an install would add, for a dry-run plan. */
export function describeAgentAssets(plan: AgentAssetPlan): string {
  const skills = plan.missing.filter((p) => p.includes(join(".claude", "skills"))).length;
  const commands = plan.missing.filter((p) => p.includes(join(".claude", "commands"))).length;
  return `install ${skills} specloop skill${skills === 1 ? "" : "s"} and ${commands} /spec-* command${commands === 1 ? "" : "s"} into .claude/`;
}
