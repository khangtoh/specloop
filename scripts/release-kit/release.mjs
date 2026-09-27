#!/usr/bin/env node
// release-kit: the shared VERSION-driven release process.
//
// The same bytes ship in khangtoh/specloop (the source copy) and
// khangtoh/product-os. Change the specloop copy, then copy it across;
// `release.mjs drift` reports a copy that has diverged. Each repository
// describes its own checks and packaging in release.config.json.
//
// Commands (run from the repository root):
//   bump <patch|minor|major|X.Y.Z> [--no-push]  set VERSION, sync files, commit, push
//   check                                        VERSION is valid and synced files agree
//   plan                                         decide whether this checkout releases
//   verify                                       run the configured setup and checks
//   package [--out dir]                          build artifacts, checksums, artifact checks
//   publish [--out dir] [--dry]                  publish to the configured registry
//   github-release [--out dir] [--dry]           tag vX.Y.Z and attach the artifacts
//   drift                                        compare this kit with the upstream copy
//
// Only Node's standard library is used. The npm and gh CLIs are needed only by
// the steps that use them.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const KIT_FILES = ['scripts/release-kit/release.mjs', 'scripts/release-kit/release.test.mjs', '.github/workflows/release.yml'];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

class ReleaseError extends Error {}
const fail = (message) => { throw new ReleaseError(message); };
const log = (message) => console.log(message);

function flag(args, name) {
  const at = args.indexOf(name);
  if (at < 0) return false;
  args.splice(at, 1);
  return true;
}
function option(args, name, fallback) {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) fail(`${name} needs a value.`);
  args.splice(at, 2);
  return value;
}

function run(root, argv, { allowFailure = false, quiet = false, env } = {}) {
  if (!quiet) log(`$ ${argv.join(' ')}`);
  const result = spawnSync(argv[0], argv.slice(1), { cwd: root, encoding: 'utf8', env: env ?? process.env, stdio: quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'] });
  if (result.error) fail(`${argv[0]} could not start: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) fail(`${argv.join(' ')} failed (exit ${result.status}).${quiet && result.stderr ? '\n' + result.stderr.trim() : ''}`);
  return result;
}
const git = (root, ...argv) => run(root, ['git', ...argv], { quiet: true }).stdout.trim();

export function parseVersion(text) {
  const match = SEMVER.exec(text);
  if (!match) fail(`"${text}" is not a semantic version (X.Y.Z or X.Y.Z-pre).`);
  return { core: match.slice(1, 4).map(Number), pre: match[4] ?? null };
}
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}
export function nextVersion(current, how) {
  if (SEMVER.test(how)) return how;
  const { core } = parseVersion(current);
  if (how === 'major') return `${core[0] + 1}.0.0`;
  if (how === 'minor') return `${core[0]}.${core[1] + 1}.0`;
  if (how === 'patch') return `${core[0]}.${core[1]}.${core[2] + 1}`;
  fail(`Unknown bump "${how}". Use patch, minor, major, or an explicit X.Y.Z.`);
}

export function loadConfig(root) {
  const path = join(root, 'release.config.json');
  if (!existsSync(path)) fail('release.config.json is missing at the repository root.');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (!config.name) fail('release.config.json needs a "name".');
  return { branch: 'main', sync: [], setup: [], verify: [], verifyArtifacts: [], publish: null, ...config };
}
export function readVersion(root) {
  const path = join(root, 'VERSION');
  if (!existsSync(path)) fail('VERSION is missing at the repository root.');
  const version = readFileSync(path, 'utf8').trim();
  parseVersion(version);
  return version;
}

/** Read or rewrite one synced location. JSON keys are replaced in place so formatting survives. */
function syncTarget(root, target, version) {
  const path = join(root, target.file);
  if (!existsSync(path)) fail(`Synced file ${target.file} does not exist.`);
  const text = readFileSync(path, 'utf8');
  if (target.json) {
    let value = JSON.parse(text);
    for (const key of target.json.split('.')) value = value?.[key];
    if (typeof value !== 'string') fail(`${target.file} has no string at "${target.json}".`);
    const key = target.json.split('.').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`("${key}"\\s*:\\s*")${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`);
    return { current: value, updated: version === undefined ? text : text.replace(pattern, `$1${version}$2`) };
  }
  if (target.pattern) {
    const pattern = new RegExp(target.pattern, 'm');
    const match = pattern.exec(text);
    if (!match || match[1] === undefined) fail(`${target.file} does not match ${target.pattern}.`);
    const start = match.index + match[0].indexOf(match[1]);
    return { current: match[1], updated: version === undefined ? text : text.slice(0, start) + version + text.slice(start + match[1].length) };
  }
  fail(`Synced entry for ${target.file} needs "json" or "pattern".`);
}
export function syncFiles(root, config, version, { write }) {
  const stale = [];
  for (const target of config.sync) {
    const { current, updated } = syncTarget(root, target, version);
    if (current !== version) {
      stale.push(`${target.file} (${current})`);
      if (write) writeFileSync(join(root, target.file), updated);
    }
  }
  return stale;
}

/** Turn "## Unreleased" into this version's heading and open a fresh Unreleased section. */
export function cutChangelog(root, config, version, date) {
  if (!config.changelog) return false;
  const path = join(root, config.changelog);
  const text = readFileSync(path, 'utf8');
  if (!/^## Unreleased[ \t]*$/m.test(text)) fail(`${config.changelog} has no "## Unreleased" section to release.`);
  if (new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(text)) fail(`${config.changelog} already has a ${version} section.`);
  writeFileSync(path, text.replace(/^## Unreleased[ \t]*$/m, `## Unreleased\n\nNo unreleased changes.\n\n## ${version} — ${date}`));
  return true;
}
export function releaseNotes(root, config, version) {
  if (config.changelog) {
    const text = readFileSync(join(root, config.changelog), 'utf8');
    const start = text.search(new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b.*$`, 'm'));
    if (start >= 0) {
      const body = text.slice(start).split('\n').slice(1);
      const end = body.findIndex((line) => line.startsWith('## '));
      return (end < 0 ? body : body.slice(0, end)).join('\n').trim() || null;
    }
  }
  if (config.notes) {
    const path = join(root, config.notes.replaceAll('{version}', version));
    if (existsSync(path)) return readFileSync(path, 'utf8').trim();
  }
  return null;
}

function tagExists(root, tag) {
  const local = run(root, ['git', 'rev-parse', '-q', '--verify', `refs/tags/${tag}`], { quiet: true, allowFailure: true });
  if (local.status === 0) return true;
  const remote = run(root, ['git', 'ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { quiet: true, allowFailure: true });
  return remote.status === 0 && remote.stdout.trim() !== '';
}
function existingTags(root) {
  const local = git(root, 'tag', '--list', 'v*').split('\n');
  const remote = run(root, ['git', 'ls-remote', '--tags', 'origin', 'refs/tags/v*'], { quiet: true, allowFailure: true });
  const remoteTags = remote.status === 0 ? remote.stdout.split('\n').map((line) => line.split('refs/tags/')[1]).filter(Boolean) : [];
  return [...new Set([...local, ...remoteTags])].map((t) => t.replace(/\^\{\}$/, '')).filter((t) => SEMVER.test(t.slice(1)));
}
function output(values) {
  for (const [key, value] of Object.entries(values)) log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''));
}
function expand(argv, values) {
  return argv.map((part) => part.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key]() : whole)));
}
function artifacts(out) {
  if (!existsSync(out)) fail(`No artifacts at ${out}; run package first.`);
  return readdirSync(out).filter((name) => name !== 'SHA256SUMS' && name !== 'release-evidence.md').sort();
}
function tarball(out) {
  const tgz = artifacts(out).filter((name) => name.endsWith('.tgz'));
  if (tgz.length !== 1) fail(`Expected exactly one .tgz in ${out}, found ${tgz.length}.`);
  return join(out, tgz[0]);
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const integrity = (path) => 'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');

// ---------------------------------------------------------------- commands

function cmdBump(root, args) {
  const push = !flag(args, '--no-push');
  const how = args[0];
  if (!how) fail('Usage: release.mjs bump <patch|minor|major|X.Y.Z> [--no-push]');
  const config = loadConfig(root);
  if (git(root, 'status', '--porcelain')) fail('The working tree has uncommitted changes. Commit or stash them before bumping.');
  const current = readVersion(root);
  const version = nextVersion(current, how);
  if (compareVersions(version, current) <= 0) fail(`${version} is not newer than the current ${current}.`);
  if (tagExists(root, `v${version}`)) fail(`Tag v${version} already exists.`);
  writeFileSync(join(root, 'VERSION'), version + '\n');
  const synced = syncFiles(root, config, version, { write: true });
  const cut = cutChangelog(root, config, version, new Date().toISOString().slice(0, 10));
  git(root, 'add', 'VERSION', ...config.sync.map((t) => t.file), ...(cut ? [config.changelog] : []));
  git(root, 'commit', '-m', `Release v${version}`);
  log(`Bumped ${current} → ${version}${synced.length ? `; synced ${synced.join(', ')}` : ''}${cut ? `; cut ${config.changelog}` : ''}.`);
  const branch = git(root, 'branch', '--show-current');
  if (push && branch === config.branch) {
    git(root, 'push', 'origin', `HEAD:refs/heads/${config.branch}`);
    log(`Pushed to ${config.branch}. The release workflow publishes v${version} once its checks pass.`);
  } else {
    log(push ? `On ${branch || 'a detached HEAD'}, not ${config.branch}: merge this commit to ${config.branch} to release v${version}.` : `Not pushed. Push or merge to ${config.branch} to release v${version}.`);
  }
}

function cmdCheck(root) {
  const config = loadConfig(root);
  const version = readVersion(root);
  const stale = syncFiles(root, config, version, { write: false });
  if (stale.length) fail(`VERSION is ${version} but these differ: ${stale.join(', ')}. Run "release.mjs bump ${version}" or sync them by hand.`);
  log(`${config.name} ${version}: VERSION and ${config.sync.length} synced file(s) agree.`);
}

function cmdPlan(root) {
  const config = loadConfig(root);
  const version = readVersion(root);
  const tag = `v${version}`;
  const ref = process.env.GITHUB_REF ?? `refs/heads/${git(root, 'branch', '--show-current')}`;
  const onBranch = ref === `refs/heads/${config.branch}`;
  let release = false, reason;
  const exists = tagExists(root, tag);
  if (exists) {
    reason = `${tag} already exists; nothing to release.`;
  } else {
    const newer = existingTags(root).filter((t) => compareVersions(t.slice(1), version) > 0);
    if (newer.length) fail(`VERSION ${version} is older than existing tag ${newer.sort((a, b) => compareVersions(b.slice(1), a.slice(1)))[0]}. Versions only move forward.`);
    release = onBranch;
    reason = onBranch ? `${tag} is new; releasing from ${config.branch}.` : `${tag} is new, but ${ref} is not ${config.branch}: dry run only.`;
  }
  log(reason);
  output({ version, tag, new: String(!exists), release: String(release), prerelease: String(parseVersion(version).pre !== null) });
}

function cmdVerify(root) {
  const config = loadConfig(root);
  cmdCheck(root);
  for (const argv of [...config.setup, ...config.verify]) run(root, argv);
  log('All verification checks passed.');
}

function cmdPackage(root, args) {
  const config = loadConfig(root);
  const out = resolve(root, option(args, '--out', 'dist'));
  const version = readVersion(root);
  if (!config.package) fail('release.config.json has no "package" command.');
  const stale = syncFiles(root, config, version, { write: true });
  if (stale.length) log(`::warning::Synced ${stale.join(', ')} to ${version} for packaging only. Commit the sync (release.mjs bump) so the repository agrees.`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const values = { version: () => version, out: () => out, tarball: () => tarball(out) };
  run(root, expand(config.package, values));
  const files = artifacts(out);
  if (!files.length) fail(`The package command produced nothing in ${out}.`);
  for (const argv of config.verifyArtifacts) run(root, expand(argv, values));
  writeFileSync(join(out, 'SHA256SUMS'), files.map((name) => `${sha256(join(out, name))}  ${name}\n`).join(''));
  const commit = run(root, ['git', 'rev-parse', 'HEAD'], { quiet: true, allowFailure: true }).stdout.trim();
  writeFileSync(join(out, 'release-evidence.md'), [
    '## Verification',
    '',
    `Built from \`${commit}\` by the shared release kit.`,
    '',
    ...[...config.verify, ...config.verifyArtifacts].map((argv) => `- \`${expand(argv, { ...values, out: () => 'dist', tarball: () => files.find((f) => f.endsWith('.tgz')) ?? '{tarball}' }).join(' ')}\` passed`),
    '',
    '| Artifact | SHA-256 |',
    '|---|---|',
    ...files.map((name) => `| \`${name}\` | \`${sha256(join(out, name))}\` |`),
    '',
  ].join('\n'));
  log(`Packaged ${files.length} artifact(s) in ${out}: ${files.join(', ')}.`);
}

function npmRegistryIntegrity(root, name, version, env) {
  const result = run(root, ['npm', 'view', `${name}@${version}`, 'dist.integrity', '--json'], { quiet: true, allowFailure: true, env });
  if (result.status !== 0) {
    if (/E404|404 Not Found|is not in this registry/i.test(result.stderr + result.stdout)) return null;
    fail(`npm view ${name}@${version} failed; cannot tell whether it is published.\n${result.stderr.trim()}`);
  }
  const text = result.stdout.trim();
  return text ? JSON.parse(text) : null;
}

async function cmdPublish(root, args) {
  const dry = flag(args, '--dry');
  const config = loadConfig(root);
  const out = resolve(root, option(args, '--out', 'dist'));
  const version = readVersion(root);
  if (!config.publish) { log('No registry configured; nothing to publish.'); return; }
  if (config.publish !== 'npm') fail(`Unsupported publish target "${config.publish}".`);
  const file = tarball(out);
  const local = integrity(file);
  const name = config.name;
  const env = { ...process.env };
  let npmrc;
  if (process.env.NPM_TOKEN) {
    npmrc = mkdtempSync(join(tmpdir(), 'release-kit-npm-'));
    writeFileSync(join(npmrc, '.npmrc'), '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n', { mode: 0o600 });
    env.NPM_CONFIG_USERCONFIG = join(npmrc, '.npmrc');
  }
  try {
    const published = npmRegistryIntegrity(root, name, version, env);
    if (published) {
      if (published !== local) fail(`${name}@${version} is already on npm with different bytes (${published}). Published versions are immutable; release a new version.`);
      log(`${name}@${version} is already on npm with identical bytes; skipping publish.`);
      return;
    }
    if (dry) { log(`Dry run: would publish ${file} as ${name}@${version} (${local}).`); return; }
    if (!process.env.NPM_TOKEN) fail('NPM_TOKEN is not set. Add an npm automation or granular publish token as the NPM_TOKEN Actions secret, then re-run the workflow.');
    const tag = parseVersion(version).pre ? ['--tag', 'next'] : [];
    run(root, ['npm', 'publish', file, '--access', 'public', ...tag], { env });
    const delay = Number(process.env.RELEASE_KIT_POLL_MS ?? 10000);
    for (let attempt = 1; attempt <= 6; attempt++) {
      const seen = npmRegistryIntegrity(root, name, version, env);
      if (seen === local) { log(`npm confirms ${name}@${version} with integrity ${local}.`); appendFileSync(join(out, 'release-evidence.md'), `\nnpm: \`${name}@${version}\`, integrity \`${local}\`.\n`); return; }
      if (seen) fail(`npm reports different bytes for ${name}@${version} (${seen}).`);
      await new Promise((done) => setTimeout(done, delay));
    }
    fail(`npm did not show ${name}@${version} after publishing. Re-run the workflow; an identical published artifact is accepted.`);
  } finally {
    if (npmrc) rmSync(npmrc, { recursive: true, force: true });
  }
}

function cmdGithubRelease(root, args) {
  const dry = flag(args, '--dry');
  const config = loadConfig(root);
  const out = resolve(root, option(args, '--out', 'dist'));
  const version = readVersion(root);
  const tag = `v${version}`;
  const files = artifacts(out).map((name) => join(out, name));
  const sums = join(out, 'SHA256SUMS');
  if (existsSync(sums)) files.push(sums);
  const target = git(root, 'rev-parse', 'HEAD');
  const notes = [releaseNotes(root, config, version), existsSync(join(out, 'release-evidence.md')) ? readFileSync(join(out, 'release-evidence.md'), 'utf8').trim() : null].filter(Boolean).join('\n\n');
  if (dry) { log(`Dry run: would create ${tag} at ${target} with ${files.length} asset(s).`); return; }
  const existing = run(root, ['gh', 'release', 'view', tag, '--json', 'tagName'], { quiet: true, allowFailure: true });
  if (existing.status === 0) { log(`GitHub release ${tag} already exists; leaving it unchanged.`); return; }
  const notesDir = mkdtempSync(join(tmpdir(), 'release-kit-notes-'));
  try {
    writeFileSync(join(notesDir, 'notes.md'), notes + '\n');
    run(root, ['gh', 'release', 'create', tag, '--target', target, '--title', `${config.name} ${tag}`, '--notes-file', join(notesDir, 'notes.md'),
      ...(releaseNotes(root, config, version) ? [] : ['--generate-notes']),
      ...(parseVersion(version).pre ? ['--prerelease'] : []), ...files]);
  } finally {
    rmSync(notesDir, { recursive: true, force: true });
  }
  log(`Created GitHub release ${tag} at ${target}.`);
}

async function cmdDrift(root) {
  const config = loadConfig(root);
  if (config.kitSource) { log('This repository holds the source copy of the release kit.'); return; }
  const upstream = config.kitUpstream ?? 'khangtoh/specloop';
  const base = process.env.RELEASE_KIT_UPSTREAM_URL ?? `https://raw.githubusercontent.com/${upstream}/main`;
  const diverged = [];
  for (const path of KIT_FILES) {
    const response = await fetch(`${base}/${path}`);
    if (!response.ok) fail(`Could not fetch ${base}/${path} (HTTP ${response.status}).`);
    const theirs = Buffer.from(await response.arrayBuffer());
    const mine = existsSync(join(root, path)) ? readFileSync(join(root, path)) : Buffer.alloc(0);
    if (!theirs.equals(mine)) diverged.push(path);
  }
  if (diverged.length) fail(`Release kit differs from ${upstream}: ${diverged.join(', ')}. Copy those files from ${upstream} (or upstream this change there first).`);
  log(`Release kit matches ${upstream}.`);
}

export async function main(argv, root = process.cwd()) {
  const [command, ...args] = argv;
  const commands = { bump: cmdBump, check: cmdCheck, plan: cmdPlan, verify: cmdVerify, package: cmdPackage, publish: cmdPublish, 'github-release': cmdGithubRelease, drift: cmdDrift };
  if (!commands[command]) {
    console.error('Usage: node scripts/release-kit/release.mjs <bump|check|plan|verify|package|publish|github-release|drift> [options]');
    return 2;
  }
  try {
    await commands[command](root, args);
    return 0;
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error;
    console.error(`release: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
