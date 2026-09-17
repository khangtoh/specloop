/** specloop reconciliation hook v1. Never writes project files or decision prose. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, readlinkSync, realpathSync, renameSync, writeSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const hash = value => createHash('sha256').update(value).digest('hex');
let output;
const emit = value => { output = { ...output, ...value }; };
// One JSON object per invocation, including failures after context preparation.
process.on('exit', () => { if (output) writeSync(1, JSON.stringify(output) + '\n'); });
const reminder = ledger => `specloop: Before work, including direct requests and after resume/compaction, read ${ledger} and relevant authoritative specs. Compare incoming instructions with applicable decisions. Follow instruction precedence; clear user overrides need no repeated permission. Before dependent implementation append a dated conflict entry: Previous decision (source), Conflicting instruction (source), Resolution (what survives/supersedes and why), Scope and consequences (requirements/tasks/remaining work). Clarify genuinely ambiguous conflicts. Update authoritative specs with supersession references; never rewrite ledger history or undo historical completed checkboxes. Ordinary material work needs a session entry; read-only questions need no ledger churn. Plan Mode: review and describe pending reconciliation without mutating project files. Hooks cannot prove semantic completeness.`;

function project(cwd) {
  let root = realpathSync(cwd);
  for (;;) {
    if (existsSync(join(root, '.specloop.json'))) return root;
    if (existsSync(join(root, 'spec', 'agent-session-ledger.md')) && existsSync(join(root, 'spec', 'spec-summary-status.md'))) return root;
    const parent = dirname(root);
    if (parent === root) return null;
    root = parent;
  }
}
function snapshot(root, ledger) {
  let names;
  try {
    // --cached keeps deleted tracked paths; content hashes survive commits.
    names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
  } catch {
    names = [];
    const walk = dir => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        if (['.git', 'node_modules', '.cache', 'dist', 'build'].includes(item.name)) continue;
        const path = join(dir, item.name);
        if (item.isDirectory()) walk(path); else names.push(relative(root, path));
      }
    };
    walk(root);
  }
  const files = {};
  for (const name of [...new Set(names)].sort()) {
    if (name === ledger) continue;
    const path = join(root, name);
    try {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) files[name] = hash('link:' + readlinkSync(path));
      else if (stat.isFile()) files[name] = hash(readFileSync(path)) + ':' + (stat.mode & 0o111);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return files;
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const event = input.hook_event_name;
  if (!['SessionStart', 'UserPromptSubmit', 'Stop'].includes(event)) process.exit(0);
  const root = project(input.cwd || process.cwd());
  if (!root) process.exit(0);
  const config = existsSync(join(root, '.specloop.json')) ? JSON.parse(readFileSync(join(root, '.specloop.json'), 'utf8')) : {};
  const ledger = relative(root, resolve(root, config.specDir || 'spec', 'agent-session-ledger.md'));
  if (ledger.startsWith('..') || isAbsolute(ledger)) throw new Error('specDir must stay inside the project');
  if (event !== 'Stop') emit({ hookSpecificOutput: { hookEventName: event, additionalContext: reminder(ledger) } });
  if (input.permission_mode === 'plan') process.exit(0);
  if (!input.session_id) throw new Error('missing session_id; baseline unavailable');
  const runtime = process.argv[2] || 'unknown';
  const stateDir = join(process.env.SPECLOOP_HOOK_STATE_DIR || tmpdir(), 'specloop-hooks', hash(root), hash(runtime + ':' + input.session_id));
  const statePath = join(stateDir, 'baseline.json');
  const readLedger = () => existsSync(join(root, ledger)) ? readFileSync(join(root, ledger)) : Buffer.alloc(0);
  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
  const save = () => {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const temporary = statePath + '.' + process.pid;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, statePath);
  };
  if (event === 'SessionStart') process.exit(0); // Never discard a baseline on compact/resume.
  if (event === 'UserPromptSubmit') {
    // Preserve an unfinished turn, including a Stop-generated continuation prompt.
    if (!state || state.closed) {
      state = { files: snapshot(root, ledger), ledger: readLedger().toString('base64'), retried: false, closed: false };
      save();
    }
    process.exit(0);
  }
  if (!state || state.closed) {
    emit({ systemMessage: 'specloop: no active prompt baseline; ledger verification unavailable. Review material work manually.' });
    process.exit(0);
  }
  const before = Buffer.from(state.ledger, 'base64');
  const after = readLedger();
  const append = after.subarray(0, before.length).equals(before) && after.subarray(before.length).toString().trim().length > 0;
  const changed = JSON.stringify(state.files) !== JSON.stringify(snapshot(root, ledger));
  const rewritten = !after.subarray(0, before.length).equals(before);
  if ((changed && !append) || rewritten) {
    const reason = `specloop: ${rewritten ? 'Ledger history was altered.' : 'Material workspace contents changed without an appended ledger entry.'} Review ${ledger}, preserve its prior bytes and append a dated account of this session before finishing. Reconcile any instruction conflicts with authoritative specs; do not invent decisions.`;
    if (input.stop_hook_active || state.retried) {
      emit({ systemMessage: reason + ' Correction remains unresolved; retry guard prevents another continuation. Report this in the handoff.' });
      state.closed = true;
    } else {
      emit({ decision: 'block', reason });
      state.retried = true;
    }
  } else state.closed = true;
  save();
} catch (error) {
  // Fail visibly, without an unbounded continuation when Git/cache/files are unavailable.
  emit({ systemMessage: `specloop: reconciliation hook could not verify this turn: ${error.message}. Review ledger updates manually.` });
}
