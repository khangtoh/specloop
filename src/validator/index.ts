import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SpecloopConfig } from "../config.js";
import {
  parsePhaseFile,
  parseIndex,
  findMalformedTaskLines,
  expectedEmoji,
  type PhaseFile,
} from "./parse.js";

export type Severity = "error" | "warn";

export interface Issue {
  severity: Severity;
  file: string; // repo-relative
  line?: number;
  rule: string;
  message: string;
}

export interface CheckResult {
  issues: Issue[];
  phases: PhaseFile[];
  ok: boolean;
}

export function check(rootDir: string, config: SpecloopConfig): CheckResult {
  const issues: Issue[] = [];
  const specDir = join(rootDir, config.specDir);
  const rel = (p: string) => p.replace(rootDir + "/", "");

  if (!existsSync(specDir)) {
    issues.push({
      severity: "error",
      file: config.specDir,
      rule: "spec-dir-missing",
      message: `Spec directory '${config.specDir}/' does not exist. Run 'specloop init' to scaffold it.`,
    });
    return { issues, phases: [], ok: false };
  }

  // 1. Required process files present.
  for (const f of config.requiredProcessFiles) {
    if (!existsSync(join(specDir, f))) {
      issues.push({
        severity: "error",
        file: join(config.specDir, f),
        rule: "process-file-missing",
        message: `Required process file '${f}' is missing from ${config.specDir}/.`,
      });
    }
  }

  // 2. Root AGENTS file references the reporting standard.
  if (config.agentsFile) {
    const agentsPath = join(rootDir, config.agentsFile);
    if (!existsSync(agentsPath)) {
      issues.push({
        severity: "warn",
        file: config.agentsFile,
        rule: "agents-file-missing",
        message: `${config.agentsFile} not found; agents won't be bound to the reporting standard.`,
      });
    } else if (!readFileSync(agentsPath, "utf8").includes("spec-summary-status.md")) {
      issues.push({
        severity: "warn",
        file: config.agentsFile,
        rule: "agents-file-unbound",
        message: `${config.agentsFile} does not reference spec/spec-summary-status.md.`,
      });
    }
  }

  // 3. Parse phase files.
  const phaseRe = new RegExp(config.phasePattern);
  const phaseFiles = readdirSync(specDir).filter((f) => phaseRe.test(f)).sort();
  const phases: PhaseFile[] = [];
  const seenNumbers = new Map<number, string>();

  for (const f of phaseFiles) {
    const path = join(specDir, f);
    const phase = parsePhaseFile(path, f);
    phases.push(phase);

    if (seenNumbers.has(phase.number)) {
      issues.push({
        severity: "error",
        file: rel(path),
        rule: "duplicate-phase-number",
        message: `Phase number ${phase.number} also used by ${seenNumbers.get(phase.number)}.`,
      });
    } else {
      seenNumbers.set(phase.number, f);
    }

    if (config.requireGoalLine && !phase.goal) {
      issues.push({
        severity: "error",
        file: rel(path),
        rule: "missing-goal",
        message: "Phase file has no 'Goal:' line.",
      });
    }
    if (config.requireDependsOnLine && phase.dependsOn === null) {
      issues.push({
        severity: "error",
        file: rel(path),
        rule: "missing-depends-on",
        message: "Phase file has no 'Depends on:' line.",
      });
    }
    if (phase.total === 0) {
      issues.push({
        severity: "warn",
        file: rel(path),
        rule: "no-tasks",
        message: "Phase file has no checkbox tasks.",
      });
    }
    for (const ln of findMalformedTaskLines(path)) {
      issues.push({
        severity: "error",
        file: rel(path),
        line: ln,
        rule: "malformed-task",
        message: "Line looks like a task but is not a well-formed '- [ ]' / '- [x]' checkbox.",
      });
    }
  }

  // 4. Index (README) cross-checks.
  if (config.enforceIndexCounts) {
    const indexPath = join(specDir, config.indexFile);
    if (existsSync(indexPath)) {
      const rows = parseIndex(indexPath);
      const byFile = new Map(phases.map((p) => [p.file, p]));
      const rowFiles = new Set<string>();

      for (const row of rows) {
        if (!row.file) continue;
        rowFiles.add(row.file);
        const phase = byFile.get(row.file);
        if (!phase) {
          issues.push({
            severity: "error",
            file: rel(indexPath),
            line: row.line,
            rule: "index-orphan-row",
            message: `Index row ${row.number} links to '${row.file}', which is not a phase file.`,
          });
          continue;
        }
        if (row.checked !== null && row.total !== null) {
          if (row.checked !== phase.checked || row.total !== phase.total) {
            issues.push({
              severity: "error",
              file: rel(indexPath),
              line: row.line,
              rule: "index-count-mismatch",
              message: `Index shows ${row.checked}/${row.total} for ${row.file} but the file has ${phase.checked}/${phase.total}.`,
            });
          }
        } else {
          issues.push({
            severity: "warn",
            file: rel(indexPath),
            line: row.line,
            rule: "index-no-progress",
            message: `Index row for ${row.file} has no 'checked/total' progress.`,
          });
        }
        if (row.emoji) {
          const exp = expectedEmoji(phase.checked, phase.total);
          // ⛔ (blocked) is a valid human override; never auto-flag it.
          if (row.emoji !== "⛔" && row.emoji !== exp) {
            issues.push({
              severity: "error",
              file: rel(indexPath),
              line: row.line,
              rule: "index-emoji-mismatch",
              message: `Index status for ${row.file} shows ${row.emoji} but its ${phase.checked}/${phase.total} count implies ${exp}.`,
            });
          }
        } else {
          issues.push({
            severity: "error",
            file: rel(indexPath),
            line: row.line,
            rule: "index-no-emoji",
            message: `Index status for ${row.file} is missing a status emoji (✅/🟡/⬜/⛔).`,
          });
        }
      }

      // Every phase file on disk must appear in the index.
      for (const p of phases) {
        if (!rowFiles.has(p.file)) {
          issues.push({
            severity: "error",
            file: rel(indexPath),
            rule: "index-missing-phase",
            message: `Phase file '${p.file}' exists but is not listed in the index table.`,
          });
        }
      }
    }
  }

  const ok = issues.every((i) => i.severity !== "error");
  return { issues, phases, ok };
}
