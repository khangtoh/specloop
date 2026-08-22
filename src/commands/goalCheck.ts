import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";

/**
 * Emit the goal-completion-check prompt with {GOAL} substituted, ready to paste
 * into an agent. Prefers the project's own copy of the prompt so local edits win.
 */
export function runGoalCheck(rootDir: string, goal: string): number {
  if (!goal || !goal.trim()) {
    console.error("Usage: specloop goal-check \"<the goal to check>\"");
    return 1;
  }
  const config = loadConfig(rootDir);
  const localPrompt = join(rootDir, config.specDir, "goal-completion-check.md");
  const pkgPrompt = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "template",
    "spec",
    "goal-completion-check.md",
  );
  const source = existsSync(localPrompt) ? localPrompt : pkgPrompt;
  const md = readFileSync(source, "utf8");

  // Extract the fenced prompt block; fall back to the whole file.
  const fence = md.match(/```([\s\S]*?)```/);
  const prompt = (fence ? fence[1] : md).trim();
  console.log(prompt.replace(/\{GOAL\}/g, goal.trim()));
  return 0;
}
