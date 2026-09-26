import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../config.js";
import {
  createFenceTracker,
  discoverPhases,
  parsePhaseContent,
  phaseTitle,
  GROUP_ROOT,
} from "../validator/parse.js";
import { splitSections } from "../layout.js";

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const RED = "\x1b[31m";
const CYN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

export interface GroupPlan {
  number: number;
  from: string; // spec-relative flat file
  dir: string; // new folder name
  files: { file: string; content: string; tasks: number; checked: number }[]; // spec-relative, README first
  inbound: { path: string; content: string; links: number }[]; // absolute paths rewritten
  otherRefs: string[]; // repo-relative files that mention the old path (not edited)
  before: { checked: number; total: number };
  after: { checked: number; total: number };
  split: boolean;
}

/** `[text](target)` and `[id]: target` — capture the target so it can be rewritten. */
const INLINE_LINK = /(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;
const REF_LINK = /^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/;

function isRelative(target: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target);
}

/** Apply `fn` to every link target outside code fences. Returns [content, changed]. */
function mapLinks(content: string, fn: (t: string) => string): [string, number] {
  const inCode = createFenceTracker();
  let changed = 0;
  const out = content.split("\n").map((line) => {
    if (inCode(line)) return line;
    const swap = (t: string) => {
      const n = fn(t);
      if (n !== t) changed++;
      return n;
    };
    const ref = line.match(REF_LINK);
    if (ref) return ref[1] + swap(ref[2]) + ref[3];
    return line.replace(INLINE_LINK, (_m, a: string, t: string, b: string) => a + swap(t) + b);
  });
  return [out.join("\n"), changed];
}

function slugify(heading: string): string {
  return (
    heading
      .replace(/^[A-Z0-9]{1,3}[.)]\s+/, "") // "A. Parser" → "Parser"
      .toLowerCase()
      .replace(/`/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .reduce((acc, w) => (acc && acc.length + 1 + w.length > 40 ? acc : acc ? `${acc}-${w}` : w), "")
      .slice(0, 40) || "part"
  );
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a].trim() === "") a++;
  while (b > a && lines[b - 1].trim() === "") b--;
  return lines.slice(a, b);
}

function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) out.push(...mdFiles(abs));
    else if (e.endsWith(".md")) out.push(abs);
  }
  return out;
}

function git(rootDir: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", ["-C", rootDir, ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: r.stdout ?? "" };
}

/** Build (without writing) the flat → grouped migration for phase `nn`. */
export function planGroup(
  rootDir: string,
  nn: number,
  opts: { split?: boolean } = {},
): GroupPlan | string {
  const config = loadConfig(rootDir);
  const specDir = join(rootDir, config.specDir);
  const phase = discoverPhases(specDir, config.phasePattern).phases.find((p) => p.number === nn);
  if (!phase) return `No phase ${nn} in ${config.specDir}/.`;
  if (phase.layout === "grouped") return `Phase ${nn} is already grouped (${phase.name}/).`;

  const from = phase.file;
  const dir = from.replace(/\.md$/i, "");
  if (existsSync(join(specDir, dir))) return `${config.specDir}/${dir}/ already exists; refusing to overwrite it.`;
  const prefix = dir.match(/^(\d{2,})-/)![1];

  const content = readFileSync(phase.path, "utf8");
  const lines = content.split(/\r?\n/);
  const sections = splitSections(content);
  const taskSections = sections.filter((s) => s.heading !== null && s.tasks > 0);
  const split = opts.split !== false && taskSections.length >= 2;

  // Moved content sits one folder deeper: relative links gain "../"; a link to
  // the phase's own old file now means the group root.
  const deepen = (t: string) => {
    if (!isRelative(t)) return t;
    const [path, anchor] = t.split("#");
    if (path === from) return GROUP_ROOT + (anchor !== undefined ? `#${anchor}` : "");
    return `../${t}`;
  };
  // Rewrite the original body once, before any generated (already-correct)
  // links are added; mapLinks keeps line numbers so section bounds still hold.
  const moved = mapLinks(lines.join("\n"), deepen)[0].split("\n");

  const title = phaseTitle(phase.title, nn, dir);
  const subs: { file: string; heading: string; body: string }[] = [];
  const rootLines: string[] = [];
  const used = new Set<string>();
  let listed = false;
  for (const s of sections) {
    const isPart = split && s.heading !== null && s.tasks > 0;
    if (!isPart) {
      rootLines.push(...moved.slice(s.start, s.end));
      continue;
    }
    const letter = String.fromCharCode(97 + subs.length); // a, b, c…
    let file = `${prefix}${letter}-${slugify(s.heading!)}.md`;
    while (used.has(file)) file = file.replace(/\.md$/, "-2.md");
    used.add(file);
    const body = trimBlank(moved.slice(s.start + 1, s.end));
    subs.push({
      file,
      heading: s.heading!,
      body: [
        `# Phase ${prefix}${letter} — ${s.heading}`,
        "",
        `Part of [Phase ${prefix} — ${title}](${GROUP_ROOT}); its Goal and dependencies live there.`,
        "",
        ...body,
        "",
      ].join("\n"),
    });
    if (!listed) {
      rootLines.push("## Sub-specs", "", "@@SUBSPECS@@", "");
      listed = true;
    }
  }

  let rootContent = rootLines.join("\n");
  if (listed) {
    const list = subs.map((x) => `- [${prefix}${x.file.slice(prefix.length, prefix.length + 1)} — ${x.heading}](${x.file})`);
    rootContent = rootContent.replace("@@SUBSPECS@@", list.join("\n"));
  }
  const files = [
    { file: `${dir}/${GROUP_ROOT}`, content: rootContent },
    ...subs.map((x) => ({ file: `${dir}/${x.file}`, content: x.body })),
  ].map((f) => {
    const t = parsePhaseContent(f.content).tasks;
    return { ...f, tasks: t.length, checked: t.filter((x) => x.checked).length };
  });

  // Inbound links: spec markdown + the AGENTS file.
  const retarget = (t: string) => {
    if (!isRelative(t)) return t;
    const [path, anchor] = t.split("#");
    if (path !== from && !path.endsWith(`/${from}`)) return t;
    const moved = path.slice(0, path.length - from.length) + `${dir}/${GROUP_ROOT}`;
    return moved + (anchor !== undefined ? `#${anchor}` : "");
  };
  const candidates = mdFiles(specDir).filter((p) => p !== phase.path);
  const agents = join(rootDir, config.agentsFile);
  if (config.agentsFile && existsSync(agents)) candidates.push(agents);
  const inbound: GroupPlan["inbound"] = [];
  const stillMentions: string[] = [];
  for (const path of candidates) {
    let [next, links] = mapLinks(readFileSync(path, "utf8"), retarget);
    // A link whose text was the old filename now names the folder.
    if (links > 0) next = next.split(`[${from}](${dir}/`).join(`[${dir}/](${dir}/`);
    if (links > 0) inbound.push({ path, content: next, links });
    if (next.includes(from)) stillMentions.push(relative(rootDir, path));
  }

  // Anything else naming the old path (prose, scripts, other docs) is
  // reported, not edited — only markdown links are rewritten automatically.
  const handled = new Set([phase.path, ...candidates].map((p) => relative(rootDir, p)));
  const grep = git(rootDir, ["grep", "-l", "-F", from]);
  const otherRefs = [
    ...stillMentions,
    ...(grep.ok ? grep.out.split("\n").filter((f) => f && !handled.has(f)) : []),
  ];

  return {
    number: nn,
    from,
    dir,
    files,
    inbound,
    otherRefs,
    before: { checked: phase.checked, total: phase.total },
    after: {
      checked: files.reduce((n, f) => n + f.checked, 0),
      total: files.reduce((n, f) => n + f.tasks, 0),
    },
    split,
  };
}

/**
 * Move a flat phase into a folder of sub-specs.
 *   specloop group <NN> [--apply] [--no-split]
 * Dry run by default. Each `##` section holding tasks becomes `NNa-<slug>.md`,
 * `NNb-…`; the rest stays in `NN-slug/README.md` with a Sub-specs list. The
 * phase keeps its number, so BACKLOG is untouched.
 */
export function runGroup(
  rootDir: string,
  nnArg: string | undefined,
  opts: { apply?: boolean; split?: boolean } = {},
): number {
  const nn = nnArg ? parseInt(nnArg, 10) : NaN;
  if (Number.isNaN(nn)) {
    console.error("Usage: specloop group <NN> [--apply] [--no-split]   e.g. specloop group 12");
    return 1;
  }
  const config = loadConfig(rootDir);
  const plan = planGroup(rootDir, nn, { split: opts.split });
  if (typeof plan === "string") {
    const done = plan.includes("already grouped");
    console[done ? "log" : "error"](`${done ? YEL + "▲" : RED + "✖"}${RST} ${plan}`);
    return done ? 0 : 1;
  }

  const sd = config.specDir;
  console.log(`${BOLD}specloop group${RST} ${DIM}(phase ${String(nn).padStart(2, "0")})${RST}\n`);
  console.log(`  move   ${sd}/${plan.from} → ${sd}/${plan.dir}/${GROUP_ROOT}`);
  for (const f of plan.files.slice(1)) {
    console.log(`  add    ${sd}/${f.file} ${DIM}(${f.checked}/${f.tasks})${RST}`);
  }
  if (!plan.split) console.log(`  ${DIM}(no split — ${opts.split === false ? "--no-split" : "fewer than 2 task sections"})${RST}`);
  for (const i of plan.inbound) {
    console.log(`  link   ${relative(rootDir, i.path)} ${DIM}(${i.links} link${i.links === 1 ? "" : "s"})${RST}`);
  }
  console.log(
    `  tasks  ${plan.before.checked}/${plan.before.total} → ${plan.after.checked}/${plan.after.total}`,
  );
  if (plan.otherRefs.length) {
    console.log(`\n${YEL}▲${RST} Also mention ${plan.from} (not edited — update by hand if they should follow):`);
    for (const r of plan.otherRefs) console.log(`    ${r}`);
  }

  if (plan.before.checked !== plan.after.checked || plan.before.total !== plan.after.total) {
    console.error(`\n${RED}✖${RST} Checkbox totals would change; refusing to write anything.`);
    return 1;
  }
  if (!opts.apply) {
    console.log(`\n${DIM}Dry run. Re-run with ${RST}${CYN}--apply${RST}${DIM} to perform it.${RST}`);
    return 0;
  }

  const specDir = join(rootDir, sd);
  const src = join(specDir, plan.from);
  const dest = join(specDir, plan.dir, GROUP_ROOT);
  mkdirSync(join(specDir, plan.dir), { recursive: true });
  // `git mv` keeps the file's history attached to the new root.
  const tracked = git(rootDir, ["ls-files", "--error-unmatch", relative(rootDir, src)]).ok;
  if (!(tracked && git(rootDir, ["mv", relative(rootDir, src), relative(rootDir, dest)]).ok)) {
    renameSync(src, dest);
  }
  for (const f of plan.files) writeFileSync(join(specDir, f.file), f.content);
  for (const i of plan.inbound) writeFileSync(i.path, i.content);

  console.log(
    `\n${GRN}✔${RST} Phase ${nn} is now ${sd}/${plan.dir}/ (${plan.files.length - 1} sub-specs). Run ${CYN}specloop check${RST}.`,
  );
  return 0;
}
