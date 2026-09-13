import { test, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  lstatSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";
import { runUpgrade } from "../src/commands/upgrade.js";
import { installAgentAssets, planAgentAssets, parseSkillsMode, pluginDir } from "../src/commands/agentAssets.js";

let dir: string;
const plugin = join(import.meta.dir, "..", "plugin", "specloop");

const SKILLS = readdirSync(join(plugin, "skills")).sort();
const COMMANDS = readdirSync(join(plugin, "commands")).sort();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-assets-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Silence the commands' progress output so test logs stay readable. */
function quiet<T>(fn: () => T): T {
  const original = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = original;
  }
}

test("the shipped plugin directory resolves and carries both asset groups", () => {
  expect(existsSync(pluginDir())).toBe(true);
  expect(SKILLS).toContain("specloop");
  expect(COMMANDS).toContain("spec-loop.md");
});

test("init installs every skill and /spec-* command into .claude/", () => {
  expect(quiet(() => runInit(dir))).toBe(0);

  for (const skill of SKILLS) {
    const installed = join(dir, ".claude", "skills", skill, "SKILL.md");
    expect(existsSync(installed)).toBe(true);
    expect(readFileSync(installed, "utf8")).toBe(readFileSync(join(plugin, "skills", skill, "SKILL.md"), "utf8"));
  }
  for (const command of COMMANDS) {
    const installed = join(dir, ".claude", "commands", command);
    expect(existsSync(installed)).toBe(true);
    expect(readFileSync(installed, "utf8")).toBe(readFileSync(join(plugin, "commands", command), "utf8"));
  }
});

test("installed assets reference no plugin-root variable, so copying is faithful", () => {
  quiet(() => runInit(dir));
  const claude = join(dir, ".claude");
  const bodies = [
    ...SKILLS.map((s) => readFileSync(join(claude, "skills", s, "SKILL.md"), "utf8")),
    ...COMMANDS.map((c) => readFileSync(join(claude, "commands", c), "utf8")),
  ].join("\n");
  expect(bodies).not.toContain("CLAUDE_PLUGIN_ROOT");
});

test("init --skills none scaffolds the spec but writes no .claude/ directory", () => {
  expect(quiet(() => runInit(dir, { skills: "none" }))).toBe(0);
  expect(existsSync(join(dir, "spec", "README.md"))).toBe(true);
  expect(existsSync(join(dir, ".claude"))).toBe(false);
});

test("an edited asset is kept without --force and restored with it", () => {
  quiet(() => runInit(dir));
  const skill = join(dir, ".claude", "skills", "specloop", "SKILL.md");
  writeFileSync(skill, "# edited by the project\n");

  quiet(() => installAgentAssets(dir));
  expect(readFileSync(skill, "utf8")).toBe("# edited by the project\n");

  quiet(() => installAgentAssets(dir, { force: true }));
  expect(readFileSync(skill, "utf8")).toBe(readFileSync(join(plugin, "skills", "specloop", "SKILL.md"), "utf8"));
});

test("installing twice is idempotent — the second run writes nothing", () => {
  const first = quiet(() => installAgentAssets(dir));
  expect(first.installed.length).toBe(SKILLS.length + COMMANDS.length);

  const second = quiet(() => installAgentAssets(dir));
  expect(second.installed).toEqual([]);
  expect(second.missing).toEqual([]);
  expect(second.present.length).toBe(SKILLS.length + COMMANDS.length);
});

test("--skills link symlinks into the checkout and the links resolve", () => {
  const result = quiet(() => installAgentAssets(dir, { mode: "link" }));
  expect(result.mode).toBe("link");

  const linked = join(dir, ".claude", "skills", "specloop");
  expect(lstatSync(linked).isSymbolicLink()).toBe(true);
  expect(readFileSync(join(linked, "SKILL.md"), "utf8")).toBe(
    readFileSync(join(plugin, "skills", "specloop", "SKILL.md"), "utf8"),
  );
});

test("a broken symlink at the target is replaced rather than reported as present", () => {
  quiet(() => installAgentAssets(dir, { mode: "link" }));
  const linked = join(dir, ".claude", "commands", "spec-loop.md");
  expect(lstatSync(linked).isSymbolicLink()).toBe(true);

  // planAgentAssets must see the link as occupying the path (existsSync would not).
  expect(planAgentAssets(dir).missing).toEqual([]);

  quiet(() => installAgentAssets(dir, { mode: "copy", force: true }));
  expect(lstatSync(linked).isSymbolicLink()).toBe(false);
});

test("upgrade --apply installs the agent assets into an adopted project", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "01-alpha.md"), "# Phase 01 — Alpha\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");

  expect(quiet(() => runUpgrade(dir, { apply: true }))).toBe(0);

  expect(existsSync(join(dir, ".claude", "skills", "specloop", "SKILL.md"))).toBe(true);
  expect(existsSync(join(dir, ".claude", "commands", "spec-loop.md"))).toBe(true);
});

test("upgrade without --apply plans the install but writes nothing", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "01-alpha.md"), "# Phase 01 — Alpha\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");

  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => void lines.push(args.join(" "));
  try {
    expect(runUpgrade(dir, {})).toBe(0);
  } finally {
    console.log = original;
  }

  expect(lines.join("\n")).toContain("/spec-* command");
  expect(existsSync(join(dir, ".claude"))).toBe(false);
});

test("upgrade --skills none leaves .claude/ alone", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "01-alpha.md"), "# Phase 01 — Alpha\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");

  expect(quiet(() => runUpgrade(dir, { apply: true, skills: "none" }))).toBe(0);
  expect(existsSync(join(dir, ".claude"))).toBe(false);
});

test("parseSkillsMode accepts the documented modes and rejects anything else", () => {
  expect(parseSkillsMode("copy")).toBe("copy");
  expect(parseSkillsMode("link")).toBe("link");
  expect(parseSkillsMode("none")).toBe("none");
  expect(parseSkillsMode(undefined)).toBeUndefined();
  expect(parseSkillsMode("symlink")).toBeUndefined();
});
