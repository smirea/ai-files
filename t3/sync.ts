#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const HELP = `Usage: t3/sync.ts <command> [--dry-run]

Syncs the T3 Code setup that setup.sh cannot symlink.

Commands:
  apply          Refuse inline secrets, mirror project overrides to this machine's
                 project ids, merge t3/desktop-settings.json, and report providers
                 whose binary is not on T3's PATH. setup.sh runs this.
  check-secrets  Only refuse inline secrets (the repo's pre-commit hook runs this).

Options:
  --dry-run      Print what apply would change without writing.
  --help         Show this help.`;

const repo = join(import.meta.dir, '..');
const userdata = join(process.env.T3CODE_HOME ?? join(homedir(), '.t3'), 'userdata');
const sharedFiles = ['settings.json', 'client-settings.json', 'keybindings.json'];
const projectKeyedSettings = ['projectSettingsOverrides', 'projectAutoPullOverrides'] as const;
// T3 writes this marker in place of a secret it moved into its secret store.
const REDACTED = '••••••';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
type Registry = { [environmentId: string]: { [projectId: string]: string } };

const readJson = <T = JsonObject>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));

// Writes through a symlink so T3's link into this repo survives.
function writeJson(path: string, value: unknown, dryRun: boolean) {
	if (dryRun) return;
	const target = existsSync(path) ? realpathSync(path) : path;
	const temp = `${target}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
	renameSync(temp, target);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function findInlineSecrets(value: Json, path: string, found: string[]) {
	if (Array.isArray(value)) value.forEach((item, i) => findInlineSecrets(item, `${path}[${i}]`, found));
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return;
	const env = value as JsonObject;
	if (env.sensitive === true && typeof env.value === 'string' && env.value !== '' && env.valueRedacted !== true)
		found.push(`${path} (environment variable ${env.name})`);
	for (const [key, child] of Object.entries(value)) {
		if (/password|secret|token|api.?key/i.test(key) && typeof child === 'string' && child !== '' && child !== REDACTED)
			found.push(`${path}.${key}`);
		findInlineSecrets(child, `${path}.${key}`, found);
	}
}

function checkSecrets() {
	const found: string[] = [];
	for (const file of sharedFiles) findInlineSecrets(readJson<Json>(join(repo, 't3', file)), file, found);
	if (found.length > 0)
		throw new Error(
			`Inline secrets in t3/ (this repo is public):\n  ${found.join('\n  ')}\n` +
				'Re-enter each one in T3 Code settings so T3 moves it into its secret store, then confirm the file shows "" or "••••••".',
		);
}

// Project ids are random per machine, so overrides are matched across machines by a hash of the project's path.
const pathHash = (workspaceRoot: string) =>
	createHash('sha256')
		.update(workspaceRoot.replace(homedir(), '~'))
		.digest('hex')
		.slice(0, 16);

function localProjects(): Map<string, string> {
	const db = new Database(join(userdata, 'statev2.sqlite'), { readonly: true });
	try {
		const rows = db
			.query<{ id: string; root: string }, []>(
				'SELECT project_id AS id, workspace_root AS root FROM projection_projects WHERE deleted_at IS NULL',
			)
			.all();
		return new Map(rows.map(row => [row.id, pathHash(row.root)]));
	} finally {
		db.close();
	}
}

function mirrorProjectOverrides(settings: JsonObject, registry: Registry, environmentId: string, log: string[], warn: string[]) {
	const hashById = new Map(Object.values(registry).flatMap(projects => Object.entries(projects)));
	let changed = false;
	for (const key of projectKeyedSettings) {
		const overrides = (settings[key] ?? {}) as JsonObject;
		for (const [localId, hash] of Object.entries(registry[environmentId] ?? {})) {
			const others = Object.entries(overrides).filter(([id]) => id !== localId && hashById.get(id) === hash);
			if (others.length === 0) continue;
			const [[firstId, first]] = others;
			const agree = others.every(([, value]) => same(value, first));
			if (overrides[localId] === undefined && agree) {
				overrides[localId] = first;
				changed = true;
				log.push(`${key}: copied ${firstId} to this machine's project ${localId}`);
			} else if (!agree || !same(overrides[localId], first)) {
				warn.push(
					`${key}: project ${localId} has different overrides on another machine (${others.map(([id]) => id).join(', ')}). ` +
						'Set it the same in T3 project settings on each machine, or delete the stale entry from t3/settings.json.',
				);
			}
		}
		if (Object.keys(overrides).length > 0) settings[key] = overrides;
	}
	return changed;
}

function desktopAppRunning() {
	const ps = Bun.spawnSync(['ps', '-axo', 'command=']);
	return ps.stdout
		.toString()
		.split('\n')
		.some(line => /\.app\/Contents\/MacOS\/T3 Code[^/]*$/.test(line));
}

function mergeDesktopSettings(dryRun: boolean, log: string[], warn: string[]) {
	const path = join(userdata, 'desktop-settings.json');
	if (!existsSync(path)) {
		warn.push('desktop-settings.json is missing: open T3 Code once, quit it, and rerun.');
		return;
	}
	const shared = readJson(join(repo, 't3', 'desktop-settings.json'));
	const current = readJson(path);
	const differing = Object.keys(shared).filter(key => !same(current[key], shared[key]));
	if (differing.length === 0) return;
	// The desktop app keeps these in memory and rewrites the whole file on every window move.
	if (desktopAppRunning()) {
		warn.push(`desktop-settings.json differs in ${differing.join(', ')}: quit T3 Code and rerun setup.sh.`);
		return;
	}
	writeJson(path, { ...current, ...shared }, dryRun);
	log.push(`desktop-settings.json: set ${differing.join(', ')}`);
}

function reportMissingProviders(settings: JsonObject, warn: string[]) {
	const shellEnv = join(userdata, 'shell-environment-cache.json');
	const PATH = existsSync(shellEnv) ? (readJson(shellEnv).environment as JsonObject | undefined)?.PATH : undefined;
	for (const [id, instance] of Object.entries((settings.providerInstances ?? {}) as JsonObject)) {
		const { enabled, config } = instance as { enabled?: boolean; config?: { binaryPath?: string } };
		const binary = config?.binaryPath;
		if (enabled === false || !binary) continue;
		if (!Bun.which(binary, { PATH: typeof PATH === 'string' ? PATH : process.env.PATH })) {
			warn.push(`provider ${id}: \`${binary}\` is not on T3's PATH. Install it, or disable ${id} in T3 settings.`);
		}
	}
}

function apply(dryRun: boolean) {
	checkSecrets();
	for (const file of sharedFiles) {
		const path = join(userdata, file);
		if (!existsSync(path) || realpathSync(path) !== realpathSync(join(repo, 't3', file)))
			throw new Error(`${path} is not linked to t3/${file}. Run ./setup.sh, which links it and then runs this.`);
	}

	const log: string[] = [];
	const warn: string[] = [];
	const environmentId = readFileSync(join(userdata, 'environment-id'), 'utf8').trim();
	const registryPath = join(repo, 't3', 'projects.json');
	const registry: Registry = existsSync(registryPath) ? readJson<Registry>(registryPath) : {};
	const projects = Object.fromEntries([...localProjects()].sort(([a], [b]) => a.localeCompare(b)));
	if (!same(registry[environmentId], projects)) {
		registry[environmentId] = projects;
		writeJson(registryPath, registry, dryRun);
		log.push(`projects.json: recorded ${Object.keys(projects).length} projects for this machine`);
	}

	const settingsPath = join(userdata, 'settings.json');
	const settings = readJson(settingsPath);
	if (mirrorProjectOverrides(settings, registry, environmentId, log, warn)) writeJson(settingsPath, settings, dryRun);
	mergeDesktopSettings(dryRun, log, warn);
	reportMissingProviders(settings, warn);

	const prefix = dryRun ? 'would ' : '';
	for (const line of log) console.log(`${prefix}${line}`);
	for (const line of warn) console.warn(`warning: ${line}`);
	if (log.length === 0 && warn.length === 0) console.log('ok      T3 Code setup is in sync');
}

const args = process.argv.slice(2);
const [command] = args.filter(arg => !arg.startsWith('--'));
const unknown = args.filter(arg => arg.startsWith('--') && !['--dry-run', '--help'].includes(arg));
if (args.includes('--help')) {
	console.log(HELP);
} else if (unknown.length > 0 || (command !== 'apply' && command !== 'check-secrets')) {
	console.error(`${basename(process.argv[1])}: ${unknown[0] ?? command ?? 'missing command'} is not a command or option\n\n${HELP}`);
	process.exit(2);
} else {
	try {
		if (command === 'check-secrets') checkSecrets();
		else apply(args.includes('--dry-run'));
	} catch (error) {
		console.error(`error: ${(error as Error).message}`);
		process.exit(1);
	}
}
