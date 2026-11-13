#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const HELP = `Usage: t3/sync.ts <command> [--dry-run]

Syncs T3 Code's settings.json between this machine and t3/, and checks the rest of the setup.

Commands:
  capture        Copy this machine's settings.json into t3/settings.json and t3/projects.json.
                 Run it after changing settings in T3, then commit.
  apply          Write t3/ into this machine's settings.json (the old file is kept as
                 settings.json.bak-<time>), merge t3/desktop-settings.json, and report providers
                 whose binary is not on T3's PATH. setup.sh runs this.
  check-secrets  Refuse inline secrets in t3/ (the repo's pre-commit hook runs this).

Options:
  --dry-run      Print what capture or apply would change without writing.
  --help         Show this help.`;

const repoT3 = import.meta.dir;
const userdata = join(process.env.T3CODE_HOME ?? join(homedir(), '.t3'), 'userdata');
const machineSettingsPath = join(userdata, 'settings.json');
const projectsPath = join(repoT3, 'projects.json');
const linkedFiles = ['client-settings.json', 'keybindings.json'];
// T3 drops overrides for project ids it doesn't know, and each machine gives a repo its own id,
// so these live in projects.json keyed by project path instead of in the shared settings.json.
const projectKeys = ['projectSettingsOverrides', 'projectAutoPullOverrides'] as const;
// T3 writes this marker in place of a secret it moved into its secret store.
const REDACTED = '••••••';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
type ProjectOverrides = { [pathHash: string]: Partial<Record<(typeof projectKeys)[number], Json>> };

const readJson = <T = JsonObject>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sortKeys = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

// Writes through a symlink, so a link into this repo survives.
function writeJson(path: string, value: unknown) {
	const target = existsSync(path) ? realpathSync(path) : path;
	const temp = `${target}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
	renameSync(temp, target);
}

function findInlineSecrets(value: Json, path: string, found: string[]) {
	if (Array.isArray(value)) value.forEach((item, i) => findInlineSecrets(item, `${path}[${i}]`, found));
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return;
	if (value.sensitive === true && typeof value.value === 'string' && value.value !== '' && value.valueRedacted !== true)
		found.push(`${path} (environment variable ${value.name})`);
	for (const [key, child] of Object.entries(value)) {
		if (/password|secret|token|api.?key/i.test(key) && typeof child === 'string' && child !== '' && child !== REDACTED)
			found.push(`${path}.${key}`);
		findInlineSecrets(child, `${path}.${key}`, found);
	}
}

const repoFiles = (): [string, Json][] =>
	['settings.json', 'projects.json', ...linkedFiles]
		.filter(file => existsSync(join(repoT3, file)))
		.map(file => [file, readJson<Json>(join(repoT3, file))]);

function checkSecrets(files: [string, Json][] = repoFiles()) {
	const found: string[] = [];
	for (const [file, value] of files) findInlineSecrets(value, file, found);
	if (found.length > 0)
		throw new Error(
			`Inline secrets in t3/ (this repo is public):\n  ${found.join('\n  ')}\n` +
				'Re-enter each one in T3 Code settings so T3 moves it into its secret store, then run t3/sync.ts capture again.',
		);
}

// A hash, not the path itself, because the repo is public and some project names are private.
const pathHash = (workspaceRoot: string) =>
	createHash('sha256')
		.update(workspaceRoot.replace(homedir(), '~'))
		.digest('hex')
		.slice(0, 16);

function machineProjects(): Map<string, string> {
	// Not readonly: after T3 quits cleanly its WAL files are gone, and SQLite can't open a WAL database readonly without them.
	const db = new Database(join(userdata, 'statev2.sqlite'));
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

function readMachineSettings() {
	if (lstatSync(machineSettingsPath).isSymbolicLink())
		throw new Error(`${machineSettingsPath} is a symlink. Replace it with a copy of its target, then rerun.`);
	return readJson(machineSettingsPath);
}

function capture(dryRun: boolean) {
	const machine = readMachineSettings();
	const shared = Object.fromEntries(Object.entries(machine).filter(([key]) => !(projectKeys as readonly string[]).includes(key)));

	const projects: ProjectOverrides = existsSync(projectsPath) ? readJson<ProjectOverrides>(projectsPath) : {};
	for (const [id, hash] of machineProjects()) {
		const entry = Object.fromEntries(
			projectKeys.flatMap(key => {
				const value = (machine[key] as JsonObject | undefined)?.[id];
				return value === undefined ? [] : [[key, value]];
			}),
		);
		if (Object.keys(entry).length > 0) projects[hash] = entry;
		else delete projects[hash];
	}

	const changes = [
		['settings.json', join(repoT3, 'settings.json'), shared],
		['projects.json', projectsPath, sortKeys(projects)],
	] as const;
	checkSecrets(changes.map(([name, , value]) => [name, value as Json]));
	const changed = changes.filter(([, path, value]) => !existsSync(path) || !same(readJson(path), value));
	if (!dryRun) for (const [, path, value] of changed) writeJson(path, value);
	report(
		changed.map(([name]) => `t3/${name}: updated from this machine`),
		[],
		dryRun,
	);
}

function apply(dryRun: boolean) {
	checkSecrets();
	for (const file of linkedFiles) {
		const path = join(userdata, file);
		if (!existsSync(path) || realpathSync(path) !== realpathSync(join(repoT3, file)))
			throw new Error(`${path} is not linked to t3/${file}. Run ./setup.sh, which links it and then runs this.`);
	}
	const log: string[] = [];
	const warn: string[] = [];

	const machine = readMachineSettings();
	const projects = readJson<ProjectOverrides>(projectsPath);
	const next: JsonObject = readJson(join(repoT3, 'settings.json'));
	for (const key of projectKeys) {
		const overrides: JsonObject = {};
		for (const [id, hash] of machineProjects()) {
			const value = projects[hash]?.[key];
			if (value !== undefined) overrides[id] = value;
		}
		if (Object.keys(overrides).length > 0) next[key] = overrides;
	}
	const changedKeys = [...new Set([...Object.keys(machine), ...Object.keys(next)])].filter(key => !same(machine[key], next[key]));
	if (changedKeys.length > 0) {
		const backup = `${machineSettingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
		if (!dryRun) {
			copyFileSync(machineSettingsPath, backup);
			writeJson(machineSettingsPath, next);
		}
		log.push(`settings.json: set ${changedKeys.join(', ')} (previous file: ${backup})`);
	}

	mergeDesktopSettings(dryRun, log, warn);
	reportMissingProviders(next, warn);
	report(log, warn, dryRun);
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
	const shared = readJson(join(repoT3, 'desktop-settings.json'));
	const current = readJson(path);
	const differing = Object.keys(shared).filter(key => !same(current[key], shared[key]));
	if (differing.length === 0) return;
	// The desktop app keeps these in memory and rewrites the whole file on every window move.
	if (desktopAppRunning()) {
		warn.push(`desktop-settings.json differs in ${differing.join(', ')}: quit T3 Code and rerun setup.sh.`);
		return;
	}
	if (!dryRun) writeJson(path, { ...current, ...shared });
	log.push(`desktop-settings.json: set ${differing.join(', ')}`);
}

function reportMissingProviders(settings: JsonObject, warn: string[]) {
	const shellEnv = join(userdata, 'shell-environment-cache.json');
	const PATH = existsSync(shellEnv) ? (readJson(shellEnv).environment as JsonObject | undefined)?.PATH : undefined;
	for (const [id, instance] of Object.entries((settings.providerInstances ?? {}) as JsonObject)) {
		const { enabled, config } = instance as { enabled?: boolean; config?: { binaryPath?: string } };
		const binary = config?.binaryPath;
		if (enabled === false || !binary) continue;
		if (!Bun.which(binary, { PATH: typeof PATH === 'string' ? PATH : process.env.PATH }))
			warn.push(`provider ${id}: \`${binary}\` is not on T3's PATH. Install it, or disable ${id} in T3 settings.`);
	}
}

function report(log: string[], warn: string[], dryRun: boolean) {
	for (const line of log) console.log(`${dryRun ? 'would ' : ''}${line}`);
	for (const line of warn) console.warn(`warning: ${line}`);
	if (log.length === 0 && warn.length === 0) console.log('ok      T3 Code settings are in sync');
}

const commands = { capture, apply, 'check-secrets': () => checkSecrets() } as const;
const args = process.argv.slice(2);
const [command] = args.filter(arg => !arg.startsWith('--'));
const unknown = args.filter(arg => arg.startsWith('--') && !['--dry-run', '--help'].includes(arg));
if (args.includes('--help')) {
	console.log(HELP);
} else if (unknown.length > 0 || !(command in commands)) {
	console.error(`${basename(process.argv[1])}: ${unknown[0] ?? command ?? 'missing command'} is not a command or option\n\n${HELP}`);
	process.exit(2);
} else {
	try {
		commands[command as keyof typeof commands](args.includes('--dry-run'));
	} catch (error) {
		console.error(`error: ${(error as Error).message}`);
		process.exit(1);
	}
}
