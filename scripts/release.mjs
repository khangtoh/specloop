#!/usr/bin/env node
// Shared release transaction. Credentials and recovery artifacts never enter git.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const manifests = ['package.json', 'plugin/specloop/.claude-plugin/plugin.json', 'plugin/specloop/.codex-plugin/plugin.json'];
const ledger = 'spec/agent-session-ledger.md';
const mode = process.argv[2];
let bump = 'patch', dry = false;
const args = process.argv.slice(3);
for (const arg of args) {
  if (arg === '--dry' || arg === '--dry-run') dry = true;
  else if (mode === 'release' && ['patch', 'minor', 'major'].includes(arg) && args.indexOf(arg) === 0) bump = arg;
  else {
    console.error('Usage: bun run release [patch|minor|major] [--dry|--dry-run]\n       bash scripts/finish-release.sh [--dry|--dry-run]\nAll verification gates are mandatory. Configure npm login or NPM_TOKEN before running; --skip-verify and --otp are no longer accepted.');
    process.exit(1);
  }
}
const scratch = mkdtempSync(join(tmpdir(), 'specloop-release-'));
let env = { ...process.env };
// The temporary config contains an environment reference, never the token value.
if (process.env.NPM_TOKEN) {
  const config = join(scratch, 'npmrc');
  writeFileSync(config, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n', { mode: 0o600 });
  env.NPM_CONFIG_USERCONFIG = config;
}
const fail = message => { throw new Error(message); };
function run(command, argv, { allowFailure = false, quiet = false } = {}) {
  const result = spawnSync(command, argv, { env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) fail(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    // npm may echo configuration or authentication data; never forward its errors.
    if (command !== 'npm' && !quiet) process.stderr.write(result.stderr || '');
    fail(`${command} ${argv[0]} failed (exit ${result.status}).${command === 'npm' ? ' Check connectivity and npm login (or a valid package-write NPM_TOKEN); interactive authentication may be required.' : ''}`);
  }
  if (!quiet && command === 'bun') process.stdout.write(result.stdout || '');
  return result;
}
const git = (...argv) => run('git', argv, { quiet: true }).stdout.trim();
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const step = message => console.log(`▶ ${message}`);
const npmArgs = ['--registry=https://registry.npmjs.org', '--fetch-retries=0', '--fetch-timeout=10000'];
function registryVersion(name, version) {
  const result = run('npm', ['view', `${name}${version ? `@${version}` : ''}`, 'version', 'dist.integrity', '--json', ...npmArgs], { allowFailure: true, quiet: true });
  let data;
  try { data = JSON.parse(result.stdout); } catch { /* handled below */ }
  if (result.status !== 0) {
    if (data?.error?.code === 'E404') return null;
    fail('Could not query npm registry. Check connectivity and npm login; registry errors are not evidence that a version is unpublished.');
  }
  if (!data?.version || !data['dist.integrity']) fail('npm returned incomplete version/integrity metadata.');
  return data;
}
function compareVersions(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b)) fail('Cannot compare a non-stable registry version safely.');
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}
function assertClean() {
  if (git('status', '--porcelain')) fail('Working tree is not clean. Commit or stash your changes; the release never discards them.');
}
function verify() {
  for (const argv of [['test'], ['run', 'typecheck'], ['run', 'check:spec'], ['run', 'check:self']]) {
    step(`bun ${argv.join(' ')}`);
    run('bun', argv);
  }
}
function onboarding(tarball) {
  step('Verify onboarding against the exact release tarball');
  const result = run('bash', ['scripts/verify-onboarding.sh', '--tarball', tarball]);
  process.stdout.write(result.stdout);
}
let original, statePath, state, artifactDir;
function cleanup() {
  if (dry && original) for (const [path, content] of Object.entries(original)) writeFileSync(path, content);
  rmSync(scratch, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  cleanup();
  console.error('Release interrupted. Use finish-release.sh if a live release state was created.');
  process.exit(signal === 'SIGINT' ? 130 : 143);
});
function save() {
  if (dry) return;
  writeFileSync(`${statePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${statePath}.tmp`, statePath);
}
function checkManagedChanges() {
  for (const [path, content] of Object.entries(state.files)) {
    if (read(path) !== content && read(path) === state.previousFiles?.[path] && !state.commit) {
      if (!dry) writeFileSync(path, content);
    } else if (read(path) !== content) fail(`Recovery stopped: ${path} differs from the saved release. Preserve your changes and reconcile them before retrying.`);
  }
  const changed = run('git', ['status', '--porcelain', '--untracked-files=all'], { quiet: true }).stdout.split('\n').filter(Boolean);
  if (changed.some(line => !Object.hasOwn(state.files, line.slice(3)))) fail('Recovery stopped: unrelated changes exist. Commit or stash them before retrying.');
  const head = git('rev-parse', 'HEAD');
  if (head !== state.base && head !== state.commit) {
    // Handle a successful commit immediately followed by interruption before save().
    if (git('log', '-1', '--format=%s') !== `release: v${state.version}` || git('rev-parse', 'HEAD^') !== state.base || changed.length) {
      fail('Recovery stopped: HEAD changed outside this release. Review saved state; no history will be rewritten.');
    }
    const committedPaths = git('diff', '--name-only', state.base, head).split('\n').filter(Boolean);
    if (committedPaths.some(path => !Object.hasOwn(state.files, path))) fail('Recovery stopped: an intervening commit changed files outside this release.');
    state.commit = head;
    save();
  }
}
try {
  if (!['release', 'finish'].includes(mode)) fail('Unknown release mode.');
  if (git('branch', '--show-current') !== 'main') fail("Release must run on main.");
  statePath = resolve(git('rev-parse', '--git-path', 'specloop-release.json'));
  artifactDir = resolve(git('rev-parse', '--git-path', 'specloop-release'));
  if (existsSync(statePath)) {
    if (mode !== 'finish') fail('An unfinished release exists. Run bash scripts/finish-release.sh; do not bump again.');
    state = json(statePath);
    if (state.schema !== 1) fail('Unknown recovery state format; inspect it manually.');
    checkManagedChanges();
  } else assertClean();
  // Dry runs do not update local refs/FETCH_HEAD. Live runs fetch before ancestry checks.
  if (dry) {
    const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
    if (!remote) fail('origin/main is missing.');
    const known = run('git', ['merge-base', '--is-ancestor', remote, 'HEAD'], { allowFailure: true, quiet: true });
    if (known.status !== 0) fail('origin/main is ahead, divergent, or not fetched. Fetch/reconcile manually before retrying; dry-run does not write refs.');
  } else {
    run('git', ['fetch', 'origin', 'main', '--tags']);
    if (run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { allowFailure: true, quiet: true }).status !== 0) fail('origin/main is ahead or divergent. Reconcile it manually before releasing; no changes were discarded.');
  }
  const current = json(manifests[0]);
  if (!/^\d+\.\d+\.\d+$/.test(current.version)) fail('Release automation requires a stable major.minor.patch version.');
  for (const path of manifests.slice(1)) if (json(path).version !== current.version) fail(`Version mismatch in ${path}; align all three manifests before releasing.`);
  if (!existsSync(ledger)) fail(`Missing ${ledger}; release evidence needs the existing ledger.`);
  const latest = registryVersion(current.name);
  if (mode === 'release' && latest && latest.version !== current.version) fail(`Local ${current.version} differs from npm latest ${latest.version}. Fetch/reconcile upstream, or use finish-release.sh for an existing unpublished bump.`);
  if (!state) {
    const parts = current.version.split('.').map(Number);
    if (mode === 'release') {
      const index = { major: 0, minor: 1, patch: 2 }[bump];
      parts[index]++;
      for (let i = index + 1; i < 3; i++) parts[i] = 0;
    }
    state = { schema: 1, name: current.name, version: parts.join('.'), base: git('rev-parse', 'HEAD'), files: {}, previousFiles: {}, integrity: null, tarball: null, commit: null };
    for (const path of [...manifests, ledger]) state.files[path] = state.previousFiles[path] = read(path);
  }
  const tag = `v${state.version}`;
  if (mode === 'release' && (registryVersion(state.name, state.version) || run('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { allowFailure: true, quiet: true }).status === 0)) fail(`${tag} already exists; investigate before choosing another release.`);
  const tagCommit = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], { allowFailure: true, quiet: true });
  if (mode === 'finish' && tagCommit.status === 0 && tagCommit.stdout.trim() !== (state.tagTarget || git('rev-parse', 'HEAD'))) fail(`Existing ${tag} points to another commit; it will not be moved.`);
  if (tagCommit.status === 0) {
    for (const path of manifests) {
      if (JSON.parse(git('show', `${tagCommit.stdout.trim()}:${path}`)).version !== state.version) fail(`Existing ${tag} does not contain synchronized release versions; it will not be moved.`);
    }
    state.tagTarget = tagCommit.stdout.trim();
  }
  const publishedBefore = registryVersion(state.name, state.version);
  if (!publishedBefore && latest && compareVersions(state.version, latest.version) <= 0) fail(`Unpublished target ${state.version} is not newer than npm latest ${latest.version}; refusing to downgrade latest. Reconcile the release manually.`);
  // Publishing credentials aren't needed to finish a version already published.
  if (!publishedBefore && run('npm', ['whoami', ...npmArgs], { allowFailure: true, quiet: true }).status !== 0) fail('npm authentication failed. Run npm login or configure a valid package-write NPM_TOKEN, then retry. Credentials are never recorded.');
  step(`${dry ? 'Dry run: ' : ''}${state.name}@${state.version}`);
  verify();
  checkManagedChanges();
  original = Object.fromEntries(manifests.map(path => [path, read(path)]));
  for (const path of manifests) {
    const data = json(path);
    data.version = state.version;
    const content = `${JSON.stringify(data, null, 2)}\n`;
    state.files[path] = content;
  }
  save();
  for (const path of manifests) writeFileSync(path, state.files[path]);
  if (!state.tarball || !existsSync(state.tarball)) {
    if (state.tarball) fail('Saved release tarball is missing. Restore it before recovery; do not silently pack different bytes.');
    const destination = dry ? scratch : artifactDir;
    mkdirSync(destination, { recursive: true });
    const packed = run('npm', ['pack', '--json', '--pack-destination', destination, '--ignore-scripts'], { quiet: true });
    const metadata = JSON.parse(packed.stdout)[0];
    state.tarball = join(destination, metadata.filename);
    state.integrity = `sha512-${createHash('sha512').update(readFileSync(state.tarball)).digest('base64')}`;
    if (metadata.integrity !== state.integrity) fail('Packed artifact integrity differs from npm metadata.');
    save();
  }
  if (`sha512-${createHash('sha512').update(readFileSync(state.tarball)).digest('base64')}` !== state.integrity) fail('Saved tarball integrity changed; recovery stopped.');
  onboarding(state.tarball);
  checkManagedChanges();
  if (dry) {
    if (publishedBefore && publishedBefore['dist.integrity'] !== state.integrity) fail('Published artifact integrity differs from the local release tarball.');
    console.log(`✔ Dry run passed for ${tag}; no publish, commit, tag, push or persistent version changes.`);
  } else {
    if (publishedBefore) {
      if (publishedBefore['dist.integrity'] !== state.integrity) fail('Published artifact integrity differs from the saved tarball. Refusing to tag or republish.');
      step('Version already published; skip publication');
    } else {
      const latestNow = registryVersion(state.name);
      if (latestNow && compareVersions(state.version, latestNow.version) <= 0) fail('npm latest advanced during verification. Stop and reconcile before publishing.');
      step('Publish the verified tarball');
      run('npm', ['publish', state.tarball, '--access', 'public', '--ignore-scripts', ...npmArgs], { quiet: true });
    }
    let verified = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const published = registryVersion(state.name, state.version);
        verified = published?.version === state.version && published['dist.integrity'] === state.integrity;
        if (published && !verified) fail('Registry integrity does not match the verified tarball.');
      } catch (error) { if (attempt === 5) throw error; }
      if (verified) break;
      if (attempt < 5) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    }
    if (!verified) fail('Registry did not confirm version/integrity after six attempts. Resume with finish-release.sh.');
    if (!state.evidence) {
      const entry = `\n\n## Session: ${new Date().toISOString().slice(0, 10)} — automated release ${tag}\n\nPublished ${state.name}@${state.version}; npm registry version and integrity\nverified against the exact tarball used for onboarding and publication.\nIntegrity: \`${state.integrity}\`.\nVerification: bun test, typecheck, template/self structural checks, and exact\ntarball onboarding passed. No unrelated acceptance checkboxes were changed.\nRelease commit/tag ${tag} and explicit main/tag push follow this verified\npublication; interrupted git finalization resumes with scripts/finish-release.sh.\n`;
      state.files[ledger] += entry;
      state.evidence = true;
      // Save intent before writing to make the ledger append recoverable.
      save();
      writeFileSync(ledger, state.files[ledger]);
    }
    checkManagedChanges();
    if (git('status', '--porcelain')) {
      run('git', ['add', '--', ...manifests, ledger]);
      run('git', ['commit', '-m', `release: ${tag}`]);
      state.commit = git('rev-parse', 'HEAD');
      save();
    }
    const target = git('rev-parse', 'HEAD');
    const tagTarget = state.tagTarget || target;
    const existing = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], { allowFailure: true, quiet: true });
    if (existing.status === 0 && existing.stdout.trim() !== tagTarget) fail(`Existing ${tag} points elsewhere and will not be overwritten.`);
    if (existing.status !== 0) run('git', ['tag', '-a', tag, tagTarget, '-m', `Release ${tag}`]);
    run('git', ['push', 'origin', 'main', `refs/tags/${tag}`]);
    const remote = git('ls-remote', 'origin', 'refs/heads/main', `refs/tags/${tag}`, `refs/tags/${tag}^{}`);
    const refs = new Map(remote.split('\n').map(line => line.split(/\s+/)).map(([sha, ref]) => [ref, sha]));
    if (refs.get('refs/heads/main') !== target || (refs.get(`refs/tags/${tag}^{}`) || refs.get(`refs/tags/${tag}`)) !== tagTarget) fail('Remote main/tag verification failed; inspect origin and retry recovery.');
    rmSync(statePath);
    rmSync(artifactDir, { recursive: true, force: true });
    console.log(`✔ Published and verified ${state.name}@${state.version}; pushed main at ${target} and ${tag} at ${tagTarget}.`);
  }
} catch (error) {
  console.error(`✖ ${error.message}`);
  if (!dry && statePath && existsSync(statePath)) console.error('Release state retained. Resolve the named problem, then run bash scripts/finish-release.sh (no second bump).');
  process.exitCode = 1;
} finally {
  cleanup();
}
