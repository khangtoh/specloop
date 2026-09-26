import { test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { check } from "../src/validator/index.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  createFenceTracker,
  discoverPhases,
  normalizePhaseLink,
  parsePhaseFile,
  selectNextTask,
} from "../src/validator/parse.js";
import { recommendLayout, splitSections } from "../src/layout.js";
import { planGroup, runGroup } from "../src/commands/group.js";
import { runPrioTask } from "../src/commands/prioTask.js";
import { detect } from "../src/commands/upgrade.js";

let dir: string;
let logSpy: ReturnType<typeof spyOn>;
let errSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-group-"));
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errSpy = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  rmSync(dir, { recursive: true, force: true });
});

function write(rel: string, content: string) {
  const abs = join(dir, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}
const read = (rel: string) => readFileSync(join(dir, rel), "utf8");

/** Template process files + AGENTS, with the template's example phase removed. */
function seed() {
  const tpl = join(import.meta.dir, "..", "template");
  cpSync(join(tpl, "spec"), join(dir, "spec"), { recursive: true });
  cpSync(join(tpl, "AGENTS.md"), join(dir, "AGENTS.md"));
  rmSync(join(dir, "spec", "01-example-phase.md"));
}

function index(rows: string[]) {
  write(
    "spec/README.md",
    `# Index\n\n| # | File | Purpose | Status | Blocking dependency |\n|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}
function backlog(nums: string[]) {
  write("spec/BACKLOG.md", `# Backlog\n\n## Phases (priority order)\n\n${nums.map((n) => `- ${n} x`).join("\n")}\n`);
}

const GROUP_ROOT = `# Phase 02 — Orchestrator\n\nGoal: ship it.\n\nDepends on: None.\n\n- [x] shared pre-work\n`;

function seedGroup() {
  seed();
  write("spec/01-flat.md", "# Phase 01 — Flat\n\nGoal: g.\n\nDepends on: None.\n\n- [x] a\n- [ ] b\n");
  write("spec/02-orch/README.md", GROUP_ROOT);
  write("spec/02-orch/02b-second.md", "# 02b\n\n- [ ] (p1) second-a\n- [x] second-b\n");
  write("spec/02-orch/02a-first.md", "# 02a\n\n- [x] first-a\n- [ ] first-b\n");
  index([
    "| 1 | [01-flat.md](01-flat.md) | p | 🟡 1/2 | None |",
    "| 2 | [02-orch/README.md](02-orch/README.md) | p | 🟡 3/5 | None |",
  ]);
  backlog(["01", "02"]);
}

// ── A. Parser and validator ───────────────────────────────────────────────

test("inline ```lang in prose is not a fence opener (dillinger Phase 15 regression)", () => {
  const md = [
    "- [x] one",
    "      ```mermaid fence now renders as `<div class=\"x\"",
    "      data-line>` instead of a block.",
    "- [x] two",
    "```ts",
    "- [ ] inside real code",
    "```",
    "~~~",
    "- [ ] inside tilde code",
    "```",
    "~~~",
    "- [ ] three",
  ].join("\n");
  write("spec/05-x.md", md);
  const p = parsePhaseFile(join(dir, "spec/05-x.md"), "05-x.md");
  expect(p.tasks.map((t) => t.text)).toEqual(["one", "two", "three"]);
});

test("fence tracker closes only on same char with >= length", () => {
  const f = createFenceTracker();
  const flags = ["````", "```", "still code", "````", "after"].map(f);
  expect(flags).toEqual([true, true, true, true, false]);
});

test("grouped phase is discovered with aggregate, ordered tasks", () => {
  seedGroup();
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  const g = phases.find((p) => p.number === 2)!;
  expect(g.layout).toBe("grouped");
  expect(g.file).toBe("02-orch/README.md");
  expect(g.goal).toBe("ship it.");
  expect(g.parts.map((x) => x.file)).toEqual([
    "02-orch/README.md",
    "02-orch/02a-first.md",
    "02-orch/02b-second.md",
  ]);
  expect(g.tasks.map((t) => [t.index, t.file, t.text])).toEqual([
    [1, "02-orch/README.md", "shared pre-work"],
    [2, "02-orch/02a-first.md", "first-a"],
    [3, "02-orch/02a-first.md", "first-b"],
    [4, "02-orch/02b-second.md", "second-a"],
    [5, "02-orch/02b-second.md", "second-b"],
  ]);
  expect([g.checked, g.total]).toEqual([3, 5]);
});

test("a valid mixed flat + grouped spec passes check", () => {
  seedGroup();
  const r = check(dir, DEFAULT_CONFIG);
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  expect(r.phases).toHaveLength(2);
});

test("sub-specs don't need Goal/Depends on; the root does", () => {
  seedGroup();
  write("spec/02-orch/README.md", "# Phase 02\n\n- [x] shared\n");
  const rules = check(dir, DEFAULT_CONFIG).issues.filter((i) => i.file.startsWith("spec/02-orch"));
  expect(rules.map((i) => [i.rule, i.file])).toEqual([
    ["missing-goal", "spec/02-orch/README.md"],
    ["missing-depends-on", "spec/02-orch/README.md"],
  ]);
});

test("numbered folder without README is group-missing-root", () => {
  seedGroup();
  write("spec/03-loose/03a-x.md", "- [ ] x\n");
  const issue = check(dir, DEFAULT_CONFIG).issues.find((i) => i.rule === "group-missing-root");
  expect(issue?.file).toBe("spec/03-loose");
});

test("malformed tasks and bad priorities point at the sub-spec file", () => {
  seedGroup();
  write("spec/02-orch/02a-first.md", "# 02a\n\n- [x] first-a\n- [x] first-b\n- [] broken\n- [ ] (p9) typo\n");
  const issues = check(dir, DEFAULT_CONFIG).issues;
  expect(issues.find((i) => i.rule === "malformed-task")).toMatchObject({
    file: "spec/02-orch/02a-first.md",
    line: 5,
  });
  expect(issues.find((i) => i.rule === "invalid-priority")).toMatchObject({
    file: "spec/02-orch/02a-first.md",
    line: 6,
  });
});

test("index links: folder, trailing slash, ./ and anchors all resolve", () => {
  expect(normalizePhaseLink("02-orch/")).toBe("02-orch/README.md");
  expect(normalizePhaseLink("02-orch")).toBe("02-orch/README.md");
  expect(normalizePhaseLink("./01-flat.md#goal")).toBe("01-flat.md");
  seedGroup();
  index([
    "| 1 | [01](./01-flat.md) | p | 🟡 1/2 | None |",
    "| 2 | [02](02-orch/) | p | 🟡 3/5 | None |",
  ]);
  expect(check(dir, DEFAULT_CONFIG).ok).toBe(true);
});

test("index count for a group is the aggregate", () => {
  seedGroup();
  index([
    "| 1 | [01-flat.md](01-flat.md) | p | 🟡 1/2 | None |",
    "| 2 | [02-orch/README.md](02-orch/README.md) | p | ✅ 1/1 | None |",
  ]);
  const i = check(dir, DEFAULT_CONFIG).issues.find((x) => x.rule === "index-count-mismatch");
  expect(i?.message).toContain("has 3/5");
});

// ── B. Commands consume both layouts ──────────────────────────────────────

test("next box inside a group reports the sub-spec file", () => {
  seedGroup();
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  const next = selectNextTask([phases[1], phases[0]])!;
  expect(next.file).toBe("02-orch/02b-second.md");
  expect(next.task.text).toBe("second-a");
});

test("prio-task edits the sub-spec that holds the task", () => {
  seedGroup();
  expect(runPrioTask(dir, "02.3", "p1")).toBe(0);
  expect(read("spec/02-orch/02a-first.md")).toContain("- [ ] (p1) first-b");
  expect(read("spec/02-orch/README.md")).toBe(GROUP_ROOT);
});

test("upgrade detection counts groups and scans sub-spec bodies", () => {
  write("spec/01-flat.md", "# 01\n\nno tasks here\n");
  write("spec/02-orch/README.md", "# 02\n\nGoal: x\n\nDepends on: None\n");
  write("spec/02-orch/02a-first.md", "- [ ] only task lives in a sub-spec\n");
  const det = detect(dir);
  expect(det.numbered).toEqual(["01-flat.md", "02-orch/"]);
  expect(det.hasTasks).toBe(true);
  expect(det.model).toBe("dillinger-like");
});

// ── C. Layout recommendation ──────────────────────────────────────────────

function bigPhase(sections: number, perSection: number, checked = false): string {
  const box = checked ? "[x]" : "[ ]";
  let md = "# Phase 07 — Big\n\nGoal: g.\n\nDepends on: None.\n\n## Notes\n\nprose\n";
  for (let s = 0; s < sections; s++) {
    md += `\n## ${String.fromCharCode(65 + s)}. Section ${s}\n\n`;
    for (let t = 0; t < perSection; t++) md += `- ${box} task ${s}.${t}\n`;
  }
  return md + "\n## Findings / Results\n\n- none\n";
}

test("splitSections counts tasks per ## section", () => {
  const s = splitSections(bigPhase(2, 3));
  expect(s.map((x) => [x.heading, x.tasks])).toEqual([
    [null, 0],
    ["Notes", 0],
    ["A. Section 0", 3],
    ["B. Section 1", 3],
    ["Findings / Results", 0],
  ]);
});

test("layout: large or many-section flat phases → group; small ones keep", () => {
  write("spec/07-big.md", bigPhase(3, 14)); // 42 tasks
  write("spec/08-mid.md", bigPhase(3, 9).replace("07", "08")); // 27 tasks, 3 sections
  write("spec/09-small.md", bigPhase(2, 5).replace("07", "09")); // 10 tasks
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  const r = recommendLayout(phases);
  expect(r.phases.map((a) => a.advice)).toEqual(["group", "group", "keep"]);
  expect(r.phases[0].proposedParts.map((p) => p.tasks)).toEqual([14, 14, 14]);
  expect(r.summary).toContain("group 07, 08");
});

test("layout: complete phases are never regrouped", () => {
  write("spec/07-big.md", bigPhase(3, 14, true));
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  expect(recommendLayout(phases).phases[0].advice).toBe("keep");
});

test("layout: a tiny group → flatten", () => {
  write("spec/02-orch/README.md", GROUP_ROOT);
  write("spec/02-orch/02a-first.md", "- [ ] one\n");
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  expect(recommendLayout(phases).phases[0].advice).toBe("flatten");
});

// ── D. group ──────────────────────────────────────────────────────────────

function seedBig() {
  seed();
  write(
    "spec/07-big.md",
    bigPhase(3, 2).replace("prose\n", "prose, see [phase 01](01-flat.md) and [self](07-big.md#goal)\n"),
  );
  write("spec/01-flat.md", "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [x] a\n\nNext: [big](07-big.md#a-section-0).\n");
  index([
    "| 1 | [01-flat.md](01-flat.md) | p | ✅ 1/1 | None |",
    "| 7 | [07-big.md](07-big.md) | p | ⬜ 0/6 | None |",
  ]);
  backlog(["01", "07"]);
  write("scripts/run.sh", "cat spec/07-big.md\n");
}

test("group dry run plans without writing", () => {
  seedBig();
  const plan = planGroup(dir, 7);
  if (typeof plan === "string") throw new Error(plan);
  expect(plan.files.map((f) => f.file)).toEqual([
    "07-big/README.md",
    "07-big/07a-section-0.md",
    "07-big/07b-section-1.md",
    "07-big/07c-section-2.md",
  ]);
  expect(plan.after).toEqual(plan.before);
  expect(runGroup(dir, "7", {})).toBe(0);
  expect(existsSync(join(dir, "spec/07-big.md"))).toBe(true);
  expect(existsSync(join(dir, "spec/07-big"))).toBe(false);
});

test("group --apply splits, relinks, and keeps the spec valid", () => {
  seedBig();
  expect(runGroup(dir, "7", { apply: true })).toBe(0);
  expect(existsSync(join(dir, "spec/07-big.md"))).toBe(false);

  const root = read("spec/07-big/README.md");
  expect(root).toContain("Goal: g.");
  expect(root).toContain("## Sub-specs\n\n- [07a — A. Section 0](07a-section-0.md)");
  expect(root).toContain("[phase 01](../01-flat.md)"); // deepened
  expect(root).toContain("[self](README.md#goal)"); // self-link → root
  expect(root).toContain("## Findings / Results"); // non-task sections stay
  expect(root).not.toContain("- [ ]");

  const a = read("spec/07-big/07a-section-0.md");
  expect(a).toStartWith("# Phase 07a — A. Section 0\n\nPart of [Phase 07 — Big](README.md)");
  expect(a).toContain("- [ ] task 0.1");

  expect(read("spec/README.md")).toContain("[07-big/](07-big/README.md)");
  expect(read("spec/01-flat.md")).toContain("[big](07-big/README.md#a-section-0)");
  expect(read("scripts/run.sh")).toBe("cat spec/07-big.md\n"); // reported, not edited

  const r = check(dir, DEFAULT_CONFIG);
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  expect(r.phases.find((p) => p.number === 7)).toMatchObject({ layout: "grouped", total: 6 });
});

test("group --no-split only moves the file", () => {
  seedBig();
  expect(runGroup(dir, "7", { apply: true, split: false })).toBe(0);
  expect(read("spec/07-big/README.md")).toContain("- [ ] task 2.1");
  const { phases } = discoverPhases(join(dir, "spec"), DEFAULT_CONFIG.phasePattern);
  expect(phases.find((p) => p.number === 7)!.parts).toHaveLength(1);
});

test("group refuses an existing folder, unknown or already-grouped phases", () => {
  seedBig();
  mkdirSync(join(dir, "spec/07-big"));
  expect(runGroup(dir, "7", { apply: true })).toBe(1);
  expect(existsSync(join(dir, "spec/07-big.md"))).toBe(true);
  expect(runGroup(dir, "42", { apply: true })).toBe(1);
  rmSync(join(dir, "spec/07-big"), { recursive: true });
  runGroup(dir, "7", { apply: true });
  expect(runGroup(dir, "7", { apply: true })).toBe(0); // no-op, says already grouped
});

test("group uses git mv inside a work tree and reports other mentions", () => {
  seedBig();
  const git = (...a: string[]) =>
    spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "base");
  const plan = planGroup(dir, 7);
  if (typeof plan === "string") throw new Error(plan);
  expect(plan.otherRefs).toContain("scripts/run.sh");
  expect(runGroup(dir, "7", { apply: true })).toBe(0);
  const status = git("status", "--porcelain").stdout;
  expect(status).toMatch(/^R. spec\/07-big.md -> spec\/07-big\/README.md$/m);
});
