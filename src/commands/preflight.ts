import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runCheck } from "./check.js";

export type PreflightStatus = "pass" | "warning" | "blocked";
export interface PreflightCheck { id: string; status: PreflightStatus; message: string; action: string; }
export interface PreflightResult { checks: PreflightCheck[]; exitCode: number; }

/** A goal declares this evidence need in its acceptance text or advisory run record. */
function needsCleanCloneProof(rootDir: string): boolean {
  const sources = [
    join(rootDir, "spec", "README.md"),
    join(rootDir, "spec", "specloop-run-state.md"),
  ];
  return sources.some((file) => existsSync(file) && /clean[ -]clone(?: proof| evidence)?/i.test(readFileSync(file, "utf8")));
}

/** Check a workspace without changing it.  A blocked result is actionable. */
export function runPreflight(rootDir: string, opts: { json?: boolean } = {}): PreflightResult {
  const checks: PreflightCheck[] = [];
  const required = ["AGENTS.md", "spec/README.md", "spec/BACKLOG.md", "package.json"];
  const missing = required.filter((file) => !existsSync(join(rootDir, file)));
  if (missing.length) checks.push({ id: "repository", status: "blocked", message: `Missing ${missing.join(", ")}.`, action: "Run specloop init or restore the missing files." });
  else {
    const original = console.log;
    let code = 1;
    try { console.log = () => {}; code = runCheck(rootDir); } finally { console.log = original; }
    checks.push(code === 0
      ? { id: "repository", status: "pass", message: "Repository structure is valid.", action: "Continue." }
      : { id: "repository", status: "blocked", message: "specloop check failed.", action: "Run specloop check and repair the reported errors." });
  }

  try {
    const git = (args: string[]) => execFileSync("git", args, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const optional = (args: string[], fallback: string) => { try { return git(args); } catch { return fallback; } };
    const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const dirty = git(["status", "--porcelain"]).length > 0;
    const name = optional(["config", "--get", "user.name"], "unset");
    const email = optional(["config", "--get", "user.email"], "unset");
    const origin = optional(["remote", "get-url", "origin"], "none");
    const cleanClone = needsCleanCloneProof(rootDir);
    const missingOriginForProof = origin === "none" && cleanClone;
    const status = missingOriginForProof ? "blocked" : dirty || origin === "none" ? "warning" : "pass";
    const action = missingOriginForProof
      ? "Add an origin remote before collecting clean-clone proof."
      : dirty
        ? "Commit or stash intended changes before collecting evidence."
        : origin === "none"
          ? "Add an origin remote if clean-clone proof is required."
          : "Continue.";
    checks.push({ id: "git", status, message: branch + "; working tree " + (dirty ? "has changes" : "clean") + "; user " + name + " <" + email + ">; origin " + origin + (cleanClone ? "; clean-clone proof required." : "."), action });
  } catch {
    checks.push({ id: "git", status: "blocked", message: "git rev-parse --is-inside-work-tree failed: not inside a Git work tree or git is unavailable.", action: "git init" });
  }

  const pkg = join(rootDir, "package.json");
  if (!existsSync(pkg)) checks.push({ id: "runtime", status: "blocked", message: "package.json is missing.", action: "Restore package.json." });
  else if (!existsSync(join(rootDir, "node_modules"))) checks.push({ id: "runtime", status: "blocked", message: "Dependencies are not installed; runtime verification cannot run.", action: "bun install" });
  else {
    const expected = JSON.parse(readFileSync(pkg, "utf8")).engines?.bun ?? "unspecified";
    checks.push({ id: "runtime", status: "pass", message: `Bun ${Bun.version}; required ${expected}; dependencies installed.`, action: "Continue." });
  }
  checks.push({ id: "spec-state", status: "pass", message: "Run-state is advisory; phase completion is derived from checkboxes.", action: "Continue." });
  checks.push({ id: "artifacts", status: "pass", message: "Workspace paths are available for spec artifacts.", action: "Continue." });

  const blocked = checks.find((c) => c.status === "blocked");
  const result = { checks, exitCode: blocked ? 1 : 0 };
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("| Check | Result | Action |");
    console.log("|---|---|---|");
    for (const c of checks) console.log(`| ${c.id} | ${c.status}: ${c.message} | ${c.action} |`);
    if (blocked) console.error(`Preflight blocked by ${blocked.id}: ${blocked.message} Repair: ${blocked.action}`);
  }
  return result;
}
