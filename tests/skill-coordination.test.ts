import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { runCheck } from "../src/commands/check.js";
import { runInit } from "../src/commands/init.js";
import { refreshAssets, type Agent } from "../src/commands/refresh.js";
import { runUpgrade } from "../src/commands/upgrade.js";

const root = join(import.meta.dir, "..");
const reference = "specloop/references/coordination.md";
const rules = "skill-coordination.md";
const canonicalReference = readFileSync(join(root, "plugin/specloop/skills", reference), "utf8");
const canonicalRules = readFileSync(join(root, "template/spec", rules), "utf8");
let dir: string;
let log: typeof console.log;
const read = (path: string) => readFileSync(join(dir, path), "utf8");
function snapshot() {
  return Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => {
      const path = join(entry.parentPath, entry.name);
      return [relative(dir, path), createHash("sha256").update(readFileSync(path)).digest("hex")];
    }));
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop coordination spaces "));
  log = console.log;
  console.log = () => {};
});
afterEach(() => {
  console.log = log;
  rmSync(dir, { recursive: true, force: true });
});

for (const agent of ["claude", "codex", "both"] as Agent[]) {
  test(agent + " coordination installs faithfully, repairs missing guidance and preserves custom rules", () => {
    expect(runInit(dir, { agent })).toBe(0);
    const groups = agent === "both" ? [".claude/skills", ".agents/skills"] : [agent === "claude" ? ".claude/skills" : ".agents/skills"];
    for (const group of groups) expect(read(join(group, reference))).toBe(canonicalReference);
    expect(read(join("spec", rules))).toBe(canonicalRules);
    const missing = join(groups[0], reference);
    rmSync(join(dir, missing));
    const customRules = canonicalRules + "\nProject rule: design owns the mockup; implementation owns production behavior.\n";
    writeFileSync(join(dir, "spec", rules), customRules);
    const customReference = groups.length > 1 ? join(groups[1], reference) : null;
    if (customReference) writeFileSync(join(dir, customReference), "Project-specific coordination guidance\n");
    const ledger = read("spec/agent-session-ledger.md");
    const before = snapshot();
    const preview = refreshAssets(dir, { agent });
    expect(preview.find(action => action.path === missing)?.status).toBe("add");
    expect(preview.find(action => action.path === join("spec", rules))?.status).toBe("manual merge");
    expect(snapshot()).toEqual(before);
    refreshAssets(dir, { agent, apply: true });
    expect(read(missing)).toBe(canonicalReference);
    expect(read(join("spec", rules))).toBe(customRules);
    expect(read("spec/agent-session-ledger.md")).toBe(ledger);
    if (customReference) expect(read(customReference)).toBe("Project-specific coordination guidance\n");
  });
}

test("configured spec directory owns project rules; refresh is read-only until applied", () => {
  runInit(dir, { agent: "both" });
  mkdirSync(join(dir, "docs"));
  renameSync(join(dir, "spec"), join(dir, "docs/specs"));
  const config = JSON.parse(read(".specloop.json"));
  config.specDir = "docs/specs";
  writeFileSync(join(dir, ".specloop.json"), JSON.stringify(config));
  rmSync(join(dir, "docs/specs", rules));
  const before = snapshot();
  const preview = refreshAssets(dir, { agent: "both" });
  expect(preview.find(action => action.path === join("docs/specs", rules))?.status).toBe("add");
  expect(snapshot()).toEqual(before);
  refreshAssets(dir, { agent: "both", apply: true });
  expect(read(join("docs/specs", rules))).toBe(canonicalRules);
  expect(existsSync(join(dir, "spec", rules))).toBe(false);
  writeFileSync(join(dir, "docs/specs", rules), "Third-party integration rules\n");
  refreshAssets(dir, { agent: "both", apply: true });
  expect(read(join("docs/specs", rules))).toBe("Third-party integration rules\n");
});

test("forced init preserves project integration rules and existing ledger", () => {
  runInit(dir, { agent: "both" });
  const custom = "# Ownership\n\nProduction behavior belongs to implement.\n";
  writeFileSync(join(dir, "spec", rules), custom);
  const ledger = read("spec/agent-session-ledger.md");
  expect(runInit(dir, { force: true, agent: "both" })).toBe(0);
  expect(read(join("spec", rules))).toBe(custom);
  expect(read("spec/agent-session-ledger.md")).toBe(ledger);
});

test("adoption adds optional rules without agent assets and preserves existing third-party rules", () => {
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, "spec/01-work.md"), "# Work\n\nGoal: work.\nDepends on: None.\n\n- [ ] work\n");
  const before = snapshot();
  expect(runUpgrade(dir, { skills: "none" })).toBe(0);
  expect(snapshot()).toEqual(before);
  expect(runUpgrade(dir, { skills: "none", apply: true })).toBe(0);
  expect(read(join("spec", rules))).toBe(canonicalRules);
  expect(existsSync(join(dir, ".claude"))).toBe(false);
  writeFileSync(join(dir, "spec", rules), "Existing integration agreement\n");
  expect(runUpgrade(dir, { agent: "both", apply: true })).toBe(0);
  expect(read(join("spec", rules))).toBe("Existing integration agreement\n");
});

test("old projects without coordination rules still validate and check is read-only", () => {
  runInit(dir, { skills: "none" });
  rmSync(join(dir, "spec", rules));
  const before = snapshot();
  expect(runCheck(dir)).toBe(0);
  expect(snapshot()).toEqual(before);
});
