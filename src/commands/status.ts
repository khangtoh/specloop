import { loadConfig } from "../config.js";
import { check } from "../validator/index.js";
import { expectedEmoji, selectNextTask } from "../validator/parse.js";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

/** Print a rolled-up view of phase progress, read straight from the checkboxes. */
export function runStatus(rootDir: string, opts: { json?: boolean } = {}): number {
  const config = loadConfig(rootDir);
  const result = check(rootDir, config);
  const phases = [...result.phases].sort((a, b) => a.number - b.number);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          phases: phases.map((p) => ({
            number: p.number,
            file: p.file,
            title: p.title,
            checked: p.checked,
            total: p.total,
            emoji: expectedEmoji(p.checked, p.total),
            nextTask: p.tasks.find((t) => !t.checked)?.text ?? null,
          })),
          next: (() => {
            const n = selectNextTask(phases);
            return n
              ? { phase: n.phase, index: n.task.index, priority: n.task.priority, text: n.task.text }
              : null;
          })(),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const totalChecked = phases.reduce((n, p) => n + p.checked, 0);
  const totalTasks = phases.reduce((n, p) => n + p.total, 0);

  console.log(`${BOLD}specloop status${RST} ${DIM}(${config.specDir}/)${RST}\n`);
  for (const p of phases) {
    const emoji = expectedEmoji(p.checked, p.total);
    const bar = progressBar(p.checked, p.total);
    console.log(
      `${emoji} ${String(p.number).padStart(2, "0")} ${p.title}\n   ${bar} ${p.checked}/${p.total}  ${DIM}${p.file}${RST}`,
    );
  }

  const next = selectNextTask(phases);
  console.log(
    `\n${BOLD}Overall:${RST} ${totalChecked}/${totalTasks} tasks across ${phases.length} phases.`,
  );
  if (next) {
    const tag = next.task.priority ? ` ${DIM}(${next.task.priority})${RST}` : "";
    console.log(
      `${BOLD}Next box:${RST} [Phase ${String(next.phase).padStart(2, "0")}.${next.task.index}]${tag} ${next.task.text}`,
    );
  } else if (totalTasks > 0) {
    console.log(`${BOLD}Next box:${RST} none — every task is checked.`);
  }
  return 0;
}

function progressBar(checked: number, total: number, width = 20): string {
  if (total === 0) return "░".repeat(width);
  const filled = Math.round((checked / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
