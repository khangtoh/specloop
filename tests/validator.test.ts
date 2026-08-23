import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check } from "../src/validator/index.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  parsePhaseFile,
  parseIndex,
  expectedEmoji,
  selectNextTask,
  priorityRank,
} from "../src/validator/parse.js";
import { runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedFromTemplate() {
  const tpl = join(import.meta.dir, "..", "template");
  cpSync(join(tpl, "spec"), join(dir, "spec"), { recursive: true });
  cpSync(join(tpl, "AGENTS.md"), join(dir, "AGENTS.md"));
  cpSync(join(tpl, ".specloop.json"), join(dir, ".specloop.json"));
}

function specFile(name: string, content: string) {
  mkdirSync(join(dir, "spec"), { recursive: true });
  writeFileSync(join(dir, "spec", name), content);
}

function ruleIds(rootDir: string): string[] {
  return check(rootDir, DEFAULT_CONFIG).issues.map((i) => i.rule);
}

test("pristine template validates clean", () => {
  seedFromTemplate();
  const result = check(dir, DEFAULT_CONFIG);
  expect(result.ok).toBe(true);
  expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
});

test("missing spec dir is a hard error", () => {
  const result = check(dir, DEFAULT_CONFIG);
  expect(result.ok).toBe(false);
  expect(result.issues[0].rule).toBe("spec-dir-missing");
});

test("phase without Goal/Depends-on is flagged", () => {
  seedFromTemplate();
  specFile("02-nogoal.md", "# Phase 02 — no header\n\n- [ ] a task\n");
  // register it in the index so it isn't only an index-missing error
  const idx = join(dir, "spec", "README.md");
  const md = require("node:fs").readFileSync(idx, "utf8");
  require("node:fs").writeFileSync(
    idx,
    md.replace(
      "| 1 | [01-example-phase.md](01-example-phase.md) | Example scaffold phase — replace with your own | 🟡 2/4 | None |",
      "| 1 | [01-example-phase.md](01-example-phase.md) | Example scaffold phase — replace with your own | 🟡 2/4 | None |\n| 2 | [02-nogoal.md](02-nogoal.md) | broken | ⬜ 0/1 | None |",
    ),
  );
  const rules = ruleIds(dir);
  expect(rules).toContain("missing-goal");
  expect(rules).toContain("missing-depends-on");
});

test("index count mismatch is caught", () => {
  seedFromTemplate();
  const idx = join(dir, "spec", "README.md");
  const md = require("node:fs").readFileSync(idx, "utf8");
  require("node:fs").writeFileSync(idx, md.replace("🟡 2/4", "🟡 4/4"));
  const rules = ruleIds(dir);
  expect(rules).toContain("index-count-mismatch");
});

test("index emoji mismatch is caught", () => {
  seedFromTemplate();
  const idx = join(dir, "spec", "README.md");
  const md = require("node:fs").readFileSync(idx, "utf8");
  // 2/4 is partial; claim ✅ complete
  require("node:fs").writeFileSync(idx, md.replace("🟡 2/4", "✅ 2/4"));
  expect(ruleIds(dir)).toContain("index-emoji-mismatch");
});

test("blocked emoji is never auto-flagged", () => {
  seedFromTemplate();
  const idx = join(dir, "spec", "README.md");
  const md = require("node:fs").readFileSync(idx, "utf8");
  require("node:fs").writeFileSync(idx, md.replace("🟡 2/4", "⛔ 2/4"));
  expect(ruleIds(dir)).not.toContain("index-emoji-mismatch");
});

test("phase file missing from index is caught", () => {
  seedFromTemplate();
  specFile(
    "03-orphan.md",
    "# Phase 03\n\nGoal: x.\n\nDepends on: None.\n\n- [ ] task\n",
  );
  expect(ruleIds(dir)).toContain("index-missing-phase");
});

test("malformed task line is caught", () => {
  seedFromTemplate();
  specFile(
    "04-bad.md",
    "# Phase 04\n\nGoal: x.\n\nDepends on: None.\n\n- [] not a real checkbox\n",
  );
  expect(ruleIds(dir)).toContain("malformed-task");
});

test("parsePhaseFile counts checkboxes and ignores code fences", () => {
  specFile(
    "05-count.md",
    "# Phase 05\n\nGoal: g.\n\nDepends on: None.\n\n- [x] one\n- [x] two\n- [ ] three\n\n```\n- [ ] not a task, inside a fence\n```\n",
  );
  const p = parsePhaseFile(join(dir, "spec", "05-count.md"), "05-count.md");
  expect(p.total).toBe(3);
  expect(p.checked).toBe(2);
  expect(p.goal).toBe("g.");
  expect(p.dependsOn).toBe("None.");
});

test("expectedEmoji maps counts correctly", () => {
  expect(expectedEmoji(0, 4)).toBe("⬜");
  expect(expectedEmoji(2, 4)).toBe("🟡");
  expect(expectedEmoji(4, 4)).toBe("✅");
});

test("parsePhaseFile parses priority tags and strips them from text", () => {
  specFile(
    "06-prio.md",
    "# Phase 06\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] (p1) high one\n- [ ] normal one\n- [x] (p3) low done\n",
  );
  const p = parsePhaseFile(join(dir, "spec", "06-prio.md"), "06-prio.md");
  expect(p.tasks[0].priority).toBe("p1");
  expect(p.tasks[0].text).toBe("high one");
  expect(p.tasks[0].index).toBe(1);
  expect(p.tasks[1].priority).toBe(null);
  expect(p.tasks[2].priority).toBe("p3");
});

test("priorityRank: p1 < untagged < p3", () => {
  expect(priorityRank("p1")).toBeLessThan(priorityRank(null));
  expect(priorityRank(null)).toBeLessThan(priorityRank("p3"));
  expect(priorityRank("p2")).toBe(priorityRank(null));
});

test("selectNextTask takes highest priority across phases, then phase/pos order", () => {
  specFile("02-a.md", "# Phase 02\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] a1\n- [ ] a2\n");
  specFile("03-b.md", "# Phase 03\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] (p1) b1\n");
  const phases = [
    parsePhaseFile(join(dir, "spec", "02-a.md"), "02-a.md"),
    parsePhaseFile(join(dir, "spec", "03-b.md"), "03-b.md"),
  ];
  const next = selectNextTask(phases);
  // b1 is p1 in phase 3; it outranks the untagged phase-2 tasks.
  expect(next?.phase).toBe(3);
  expect(next?.task.text).toBe("b1");
});

test("invalid priority tag is flagged", () => {
  seedFromTemplate();
  specFile("07-badp.md", "# Phase 07\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] (p4) nope\n");
  expect(ruleIds(dir)).toContain("invalid-priority");
});

test("runUpgrade bumps an untagged task to p1 and --to sets explicitly", () => {
  specFile(
    "08-up.md",
    "# Phase 08\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] first\n- [ ] (p3) second\n",
  );
  const cfg = { rootDir: dir };
  runUpgrade(cfg.rootDir, "8.1"); // untagged -> p1
  runUpgrade(cfg.rootDir, "8.2", "p2"); // p3 -> p2 explicitly
  const p = parsePhaseFile(join(dir, "spec", "08-up.md"), "08-up.md");
  expect(p.tasks[0].priority).toBe("p1");
  expect(p.tasks[0].text).toBe("first");
  expect(p.tasks[1].priority).toBe("p2");
  expect(p.tasks[1].text).toBe("second");
});

test("parseIndex reads rows with links and progress", () => {
  seedFromTemplate();
  const rows = parseIndex(join(dir, "spec", "README.md"));
  expect(rows).toHaveLength(1);
  expect(rows[0].file).toBe("01-example-phase.md");
  expect(rows[0].checked).toBe(2);
  expect(rows[0].total).toBe(4);
  expect(rows[0].emoji).toBe("🟡");
});
