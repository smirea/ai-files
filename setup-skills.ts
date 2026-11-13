#!/usr/bin/env bun
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const HELP = `Usage: ./setup-skills.ts [--dry-run]

Installs and updates the global skills every T3 Code provider reads, and moves anything
else in their skill directories to the Trash. setup.sh runs this.

- skills/<name>/ in this repo: linked into each skill directory below.
- Plugins: installed or updated in Claude Code and Codex from the marketplaces listed in
  this script. A plugin or marketplace not listed is removed (Codex's built-in openai-*
  ones are left alone).
- t3-pstack: its own installer (it also writes the T3 model sheet's links).
- cua-driver: \`cua-driver skills install\` or \`update\`, which links its pack into each agent.

Options:
  --dry-run  Print what would change without changing it.
  --help     Show this help.`;

const repo = import.meta.dir;
const home = homedir();

const claudeMarketplaces: Record<string, string> = {
	'claude-plugins-official': 'anthropics/claude-plugins-official',
	cloudflare: 'cloudflare/skills',
	'caldo-skills': 'caldoai/skills',
};
const codexMarketplaces: Record<string, string> = {
	cloudflare: 'cloudflare/skills',
	'caldo-skills': 'caldoai/skills',
	'sentry-plugin-marketplace': 'getsentry/plugin-codex',
};
// frontend-design is Claude-only on purpose: it was turned off in Codex.
const claudePlugins = ['frontend-design@claude-plugins-official', 'sentry@claude-plugins-official', 'cloudflare@cloudflare', 'untangle-codebase@caldo-skills'];
const codexPlugins = ['sentry@sentry-plugin-marketplace', 'cloudflare@cloudflare', 'untangle-codebase@caldo-skills'];
// Plugins from Codex's own marketplaces (openai-*) ship with the app or come with the ChatGPT account, so they
// are left alone, except the ones turned off here.
const codexDisabledPlugins = ['presentations@openai-primary-runtime'];
// Installed and updated by its own installer below, so only kept here, never removed.
const T3_PSTACK = 't3-pstack';

// Claude Code, Codex (and Cursor, OpenCode, Pi), and Antigravity, which T3 links from ~/.gemini/config/skills.
const personalSkillDirs = ['.claude/skills', '.agents/skills', '.gemini/config/skills'].map(dir => join(home, dir));
const scannedSkillDirs = [
	...personalSkillDirs,
	...['.codex/skills', '.gemini/antigravity-cli/skills', '.gemini/antigravity/skills', '.gemini/skills', '.config/opencode/skills', '.grok/skills', '.cursor/skills'].map(dir =>
		join(home, dir),
	),
];
// Claude Code's copies of skills synced from claude.ai; Claude Code manages them.
const claudeSynced = join(home, '.claude/skills/synced');
const skillsCliLock = join(home, '.agents/.skill-lock.json');

const dryRun = process.argv.includes('--dry-run');
// Paths trashed so far, so a dry run still shows the links that would replace them.
const trashed = new Set<string>();
const report = (verb: string, pastTense: string, detail: string) =>
	console.log(`${(dryRun ? `would ${verb}` : pastTense).padEnd(13)} ${detail}`);

function run(cmd: string[], { mutates = true } = {}): string {
	if (mutates && dryRun) {
		report('run', 'ran', cmd.join(' '));
		return '';
	}
	const result = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' });
	if (result.exitCode !== 0)
		throw new Error(`\`${cmd.join(' ')}\` failed (exit ${result.exitCode}):\n${result.stderr.toString().trim() || result.stdout.toString().trim()}`);
	if (mutates) report('run', 'ran', cmd.join(' '));
	return result.stdout.toString();
}

const trash = (path: string, why: string) => {
	if (!dryRun) run(['trash', path], { mutates: false });
	trashed.add(path);
	report('trash', 'trashed', `${path} (${why})`);
};

const isLinkInto = (path: string, root: string) => {
	if (!lstatSync(path).isSymbolicLink()) return false;
	const target = resolve(join(path, '..'), readlinkSync(path));
	return target === root || target.startsWith(`${root}/`);
};

function requireTools() {
	const missing = ['claude', 'codex', 'npx', 'trash'].filter(tool => !Bun.which(tool));
	if (missing.length > 0) throw new Error(`setup-skills.ts needs ${missing.join(', ')} on PATH.`);
}

const personalSkills = () => readdirSync(join(repo, 'skills')).filter(name => existsSync(join(repo, 'skills', name, 'SKILL.md')));

function cleanStrays(cuaPack: string | undefined) {
	const personal = new Set(personalSkills());
	for (const dir of scannedSkillDirs) {
		if (!existsSync(dir)) continue;
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (name.startsWith('.') || path === claudeSynced) continue;
			if (personal.has(name) && isLinkInto(path, join(repo, 'skills', name))) continue;
			if (cuaPack !== undefined && isLinkInto(path, cuaPack)) continue;
			trash(path, personal.has(name) ? 'replaced by a link into ai-files' : 'not managed by setup-skills.ts');
		}
	}
	if (existsSync(skillsCliLock)) trash(skillsCliLock, 'the skills CLI no longer installs anything here');
}

function linkPersonalSkills() {
	for (const dir of personalSkillDirs) {
		for (const name of personalSkills()) {
			const path = join(dir, name);
			if (existsSync(path) && !trashed.has(path)) continue;
			if (!dryRun) {
				mkdirSync(dir, { recursive: true });
				symlinkSync(join(repo, 'skills', name), path);
			}
			report('link', 'linked', `${path} -> ${join(repo, 'skills', name)}`);
		}
	}
}

function syncClaude() {
	const marketplaces: { name: string }[] = JSON.parse(run(['claude', 'plugin', 'marketplace', 'list', '--json'], { mutates: false }));
	const installed: { id: string; enabled: boolean }[] = JSON.parse(run(['claude', 'plugin', 'list', '--json'], { mutates: false }));
	const keep = (id: string) => claudePlugins.includes(id) || id.endsWith(`@${T3_PSTACK}`);

	for (const plugin of installed.filter(plugin => !keep(plugin.id))) run(['claude', 'plugin', 'uninstall', plugin.id]);
	for (const { name } of marketplaces.filter(({ name }) => !(name in claudeMarketplaces) && name !== T3_PSTACK))
		run(['claude', 'plugin', 'marketplace', 'remove', name]);
	for (const [name, source] of Object.entries(claudeMarketplaces))
		if (!marketplaces.some(marketplace => marketplace.name === name)) run(['claude', 'plugin', 'marketplace', 'add', source]);
	run(['claude', 'plugin', 'marketplace', 'update']);

	for (const id of claudePlugins) {
		const current = installed.find(plugin => plugin.id === id);
		if (current === undefined) run(['claude', 'plugin', 'install', id]);
		else {
			run(['claude', 'plugin', 'update', id]);
			if (!current.enabled) run(['claude', 'plugin', 'enable', id]);
		}
	}
}

function syncCodex() {
	const marketplaces = run(['codex', 'plugin', 'marketplace', 'list'], { mutates: false })
		.split('\n')
		.slice(1)
		.map(line => line.split(/\s+/)[0])
		.filter(Boolean);
	const installed = new Map(
		[...run(['codex', 'plugin', 'list'], { mutates: false }).matchAll(/^(\S+@\S+)\s+installed, (enabled|disabled)/gm)].map(match => [match[1], match[2] === 'enabled']),
	);
	const keep = (id: string) => codexPlugins.includes(id) || id.split('@')[1].startsWith('openai-') || id.endsWith(`@${T3_PSTACK}`);

	for (const id of [...installed.keys()].filter(id => !keep(id))) run(['codex', 'plugin', 'remove', id]);
	for (const name of marketplaces.filter(name => !name.startsWith('openai-') && !(name in codexMarketplaces) && name !== T3_PSTACK))
		run(['codex', 'plugin', 'marketplace', 'remove', name]);
	for (const [name, source] of Object.entries(codexMarketplaces))
		if (!marketplaces.includes(name)) run(['codex', 'plugin', 'marketplace', 'add', source]);
	run(['codex', 'plugin', 'marketplace', 'upgrade']);
	// Adding an installed plugin reinstalls it from the upgraded marketplace, which is how Codex updates one.
	for (const id of codexPlugins) run(['codex', 'plugin', 'add', id]);
	for (const id of codexDisabledPlugins) if (installed.get(id) !== false) disableCodexPlugin(id);
}

// `codex plugin` has no disable command, so this sets `enabled = false` in the plugin's config.toml table.
function disableCodexPlugin(id: string) {
	const path = join(home, '.codex/config.toml');
	const lines = readFileSync(path, 'utf8').split('\n');
	const header = lines.indexOf(`[plugins."${id}"]`);
	if (header === -1) lines.push('', `[plugins."${id}"]`, 'enabled = false');
	else {
		const end = lines.findIndex((line, i) => i > header && line.startsWith('['));
		const enabled = lines.slice(header + 1, end === -1 ? undefined : end).findIndex(line => /^enabled\s*=/.test(line));
		if (enabled === -1) lines.splice(header + 1, 0, 'enabled = false');
		else lines[header + 1 + enabled] = 'enabled = false';
	}
	if (!dryRun) writeFileSync(path, lines.join('\n'));
	report('disable', 'disabled', `${id} in ${path}`);
}

function syncT3Pstack() {
	// npm 12 refuses git packages unless --allow-git is passed.
	run(['npx', '--allow-git=all', '-y', 'github:chhoumann/t3-pstack', 'install']);
}

function cuaDriverPack() {
	if (!Bun.which('cua-driver')) return undefined;
	return run(['cua-driver', 'skills', 'path'], { mutates: false }).trim();
}

function syncCuaDriver(pack: string | undefined) {
	if (pack === undefined) {
		console.warn('warning: cua-driver is not on PATH, so its skill is not installed. Install cua-driver, then rerun.');
		return;
	}
	run(['cua-driver', 'skills', existsSync(pack) ? 'update' : 'install']);
}

if (process.argv.includes('--help')) {
	console.log(HELP);
} else if (process.argv.slice(2).some(arg => arg !== '--dry-run')) {
	console.error(`setup-skills.ts: unknown argument ${process.argv.slice(2).find(arg => arg !== '--dry-run')}\n\n${HELP}`);
	process.exit(2);
} else {
	try {
		requireTools();
		const pack = cuaDriverPack();
		cleanStrays(pack);
		linkPersonalSkills();
		syncClaude();
		syncCodex();
		syncT3Pstack();
		syncCuaDriver(pack);
	} catch (error) {
		console.error(`error: ${(error as Error).message}`);
		process.exit(1);
	}
}
