#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';

// The skill is reached through ~/.claude/skills and ~/.agents/skills symlinks, so resolve to the real checkout.
const root = join(dirname(realpathSync(import.meta.path)), '../../..');
const envFile = join(root, '.env.local');
const env = { PROCRASTIMATE_API_URL: '', PROCRASTIMATE_TOKEN: '' };

// Runs before every command's action, so help and usage errors work anywhere.
function loadEnv() {
	const gitDirs = Bun.spawnSync(['git', 'rev-parse', '--absolute-git-dir', '--path-format=absolute', '--git-common-dir']);
	const [gitDir, commonDir] = gitDirs.stdout.toString().trim().split('\n');
	if (gitDirs.exitCode === 0 && gitDir !== commonDir)
		fail('refusing to run in a linked worktree: only the orchestrator, in the main checkout, talks to the task API');
	if (!existsSync(envFile)) fail(`${envFile} is missing; run ${join(root, 'setup.sh')}`);
	// Bun has already loaded the cwd's .env.local, which in an orchestrated repo may set the same names (empty in
	// its worktrees), so ai-files' values must override rather than fill in.
	Object.assign(process.env, parseEnv(readFileSync(envFile, 'utf8')));
	for (const name of Object.keys(env) as (keyof typeof env)[]) {
		env[name] = process.env[name] ?? '';
		if (!env[name]) fail(`${name} is empty in ${envFile}; run env-manager down in ${root}`);
	}
}

type Config = { project: string; gc: string; teardown: string; ship: string; body: string; repo: string };
const configKeys = ['project', 'gc', 'teardown', 'ship'] as const;
const configParts = ['# Orchestrator', '# Worker'];

function git(cwd: string, ...args: string[]): string {
	const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'pipe' });
	if (result.exitCode !== 0) fail(`git ${args.join(' ')}: ${result.stderr.toString().trim()}`);
	return result.stdout.toString().trim();
}

function loadConfig(): Config {
	const top = git(process.cwd(), 'rev-parse', '--show-toplevel');
	const repo = dirname(git(top, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
	if (realpathSync(top) !== realpathSync(repo)) fail(`run from the main checkout ${repo}, not the worktree ${top}`);
	const path = join(repo, '.agents/task-orchestrator.md');
	if (!existsSync(path)) fail(`${path} is missing; this repo isn't set up for the task orchestrator`);
	const match = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) fail(`${path} must start with a --- frontmatter block`);
	const meta = Bun.YAML.parse(match[1]!) as Record<string, unknown>;
	for (const key of configKeys)
		if (typeof meta[key] !== 'string' || !meta[key]) fail(`${path}: frontmatter needs a string \`${key}\``);
	const body = match[2]!;
	for (const part of configParts)
		if (!body.split('\n').includes(part)) fail(`${path}: needs a \`${part}\` heading`);
	for (const key of ['gc', 'teardown', 'ship'] as const) {
		const [program, ...words] = (meta[key] as string).split(' ');
		if (!Bun.which(program!)) fail(`${path}: \`${key}\` runs ${program}, which isn't on PATH`);
		const script = words.find(word => word.includes('/'));
		if (script && !existsSync(join(repo, script))) fail(`${path}: \`${key}\` runs ${script}, which doesn't exist`);
	}
	if (Bun.spawnSync(['git', 'check-ignore', '-q', '.orchestrator'], { cwd: repo }).exitCode !== 0)
		fail(`${repo}/.gitignore must ignore .orchestrator, where session files live`);
	return { ...(meta as Omit<Config, 'body' | 'repo'>), body, repo };
}

type Named = { id: string; name: string };
type Attachment = { id: string; name?: string; bytes?: number };
type Task = {
	id: string;
	title: string;
	notes: string | null;
	projectId: string;
	sectionId: string | null;
	parentId: string | null;
	priority: number;
	labelIds: string[];
	attachments: Attachment[];
	completedAt: number | null;
};
type View = { projects: Named[]; labels: Named[]; sections: Named[]; tasks: Task[] };
type Comment = { body: string; createdAt: number; author: { name: string; kind: string } };

function fail(message: string): never {
	console.error(`pm: ${message}`);
	process.exit(1);
}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
	// Reads retry on transient errors; writes don't, because a retried write can land twice.
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(env.PROCRASTIMATE_API_URL + path, {
				method,
				headers: { Authorization: `Bearer ${env.PROCRASTIMATE_TOKEN}`, 'Content-Type': 'application/json' },
				body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
			});
			if (res.ok) return res;
			const error = new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
			if (method !== 'GET' || attempt >= 3 || res.status < 500) throw Object.assign(error, { final: true });
		} catch (error) {
			if (method !== 'GET' || attempt >= 3 || (error as { final?: boolean }).final) throw error;
		}
		await Bun.sleep(1000 * (attempt + 1));
	}
}

const api = async <T>(method: string, path: string, body?: unknown) => (await call(method, path, body)).json() as T;
const view = () => api<View>('GET', '/view');
const link = async (id: string) => (await api<{ url: string }>('POST', '/links', { target: { kind: 'task', id } })).url;

function projectId(v: View, nameOrId: string): string {
	const matches = v.projects.filter(p => p.id === nameOrId || p.name === nameOrId);
	if (matches.length !== 1) fail(`expected one project named ${nameOrId}, found ${matches.length}`);
	return matches[0]!.id;
}

function openTasks(v: View, project: string): Task[] {
	const pid = projectId(v, project);
	return v.tasks.filter(t => t.projectId === pid && t.completedAt === null);
}

async function complete(task: string, pr: string, note: string) {
	const { comments } = await api<{ comments: Comment[] }>('GET', `/comments?id=${task}`);
	if (!comments.some(c => c.body.startsWith(pr)))
		await api('POST', '/comments', { taskId: task, body: note ? `${pr}\n${note}` : pr });
	if ((await view()).tasks.some(t => t.id === task && t.completedAt === null))
		await call('POST', `/tasks/complete?id=${task}`);
	console.log(`completed ${task}`);
}

const program = new Command('pm')
	.description(
		"Calls ProcrastiMate's production agent API as the AI account, with env-manager's PROCRASTIMATE_TOKEN from " +
			`${envFile}.\nRepo commands run from the repo's main checkout and read its .agents/task-orchestrator.md.`,
	)
	.showHelpAfterError()
	.showSuggestionAfterError()
	.hook('preAction', loadEnv);

program
	.command('check')
	.description("validate the repo's .agents/task-orchestrator.md and print it")
	.action(async () => {
		const { body, ...config } = loadConfig();
		const projects = (await view()).projects;
		if (!projects.some(p => p.name === config.project || p.id === config.project))
			fail(`no ProcrastiMate project named ${config.project}`);
		console.log(JSON.stringify(config, null, 2));
	});

program
	.command('tasks')
	.description('open tasks with section, parent, priority, label names, notes')
	.argument('<project>', 'project name or id')
	.action(async project => {
		const v = await view();
		const names = (list: Named[]) => new Map(list.map(x => [x.id, x.name]));
		const labels = names(v.labels);
		const sections = names(v.sections);
		for (const t of openTasks(v, project)) {
			console.log(
				`${t.id} p${t.priority} section=${sections.get(t.sectionId ?? '') ?? '-'} parent=${t.parentId ?? '-'}` +
					` labels=${t.labelIds.map(id => labels.get(id)).join(',')} attachments=${t.attachments.length}`,
			);
			console.log(`  ${t.title}`);
			if (t.notes) console.log(`  ${t.notes.replaceAll('\n', '\n  ')}`);
		}
	});

program
	.command('new')
	.description("open tasks whose id prefix the session file doesn't mention")
	.argument('<project>', 'project name or id')
	.argument('<session>', 'session file')
	.action(async (project, session) => {
		const known = readFileSync(session, 'utf8');
		for (const t of openTasks(await view(), project)) if (!known.includes(t.id.slice(0, 8))) console.log(t.id);
	});

program
	.command('comments')
	.description("the task's comments, oldest first")
	.argument('<task>', 'task id')
	.action(async task => {
		const { comments } = await api<{ comments: Comment[] }>('GET', `/comments?id=${task}`);
		for (const c of comments.toSorted((a, b) => a.createdAt - b.createdAt))
			console.log(`[${new Date(c.createdAt).toISOString().slice(0, 19)}Z ${c.author.name} (${c.author.kind})] ${c.body}`);
	});

program
	.command('link')
	.description('print "<id> <public read-only link>" per task')
	.argument('<task...>', 'task ids')
	.action(async tasks => {
		for (const task of tasks) console.log(`${task} ${await link(task)}`);
	});

program
	.command('images')
	.summary("download the task's images and files, print paths")
	.description("download the task's images as <dir>/<task>-<n>.<ext> and its files as <dir>/<task>-<name>, print paths")
	.argument('<task>', 'task id')
	.argument('<dir>', 'output directory, created if missing')
	.action(async (task, dir) => {
		mkdirSync(dir, { recursive: true });
		const attachments = (await view()).tasks.find(t => t.id === task)?.attachments ?? fail(`no task ${task}`);
		let n = 0;
		for (const { id, name, bytes = 0 } of attachments) {
			if (!name) {
				const res = await call('GET', `/images?id=${id}&size=full`);
				const ext = (res.headers.get('content-type') ?? 'image/jpeg').replace('image/', '').replace('jpeg', 'jpg');
				const out = join(dir, `${task}-${++n}.${ext}`);
				await Bun.write(out, res);
				console.log(out);
				continue;
			}
			const parts: ArrayBuffer[] = [];
			for (let size = 0, part = 0; size < bytes; part++) {
				const chunk = await (await call('GET', `/images?id=${id}&size=part${part}`)).arrayBuffer();
				if (chunk.byteLength === 0) fail(`attachment ${id} ended at ${size} of ${bytes} bytes`);
				parts.push(chunk);
				size += chunk.byteLength;
			}
			const out = join(dir, `${task}-${name}`);
			await Bun.write(out, new Blob(parts));
			console.log(out);
		}
	});

program
	.command('label')
	.description('add or remove labels by name, keeping the others')
	.argument('<task>', 'task id')
	.argument('<changes...>', '+name to add, -name to remove')
	// Otherwise commander reads a -name change as an unknown option.
	.allowUnknownOption()
	.action(async (task, changes) => {
		const v = await view();
		const ids = new Set(v.tasks.find(t => t.id === task)?.labelIds ?? fail(`no task ${task}`));
		for (const change of changes) {
			if (!/^[+-]./.test(change)) fail(`label changes look like +name or -name, got '${change}'`);
			const name = change.slice(1);
			const id =
				v.labels.find(l => l.name === name)?.id ??
				fail(`no label '${name}'; the AI account can't create labels, ask Stefan to`);
			if (change[0] === '+') ids.add(id);
			else ids.delete(id);
		}
		const updated = await api<Task>('PATCH', `/tasks?id=${task}`, { labelIds: [...ids] });
		console.log(JSON.stringify({ id: updated.id, labelIds: updated.labelIds }));
	});

program
	.command('file')
	.summary('add a task unless an open one has this title; safe to rerun')
	.description('add a task unless an open one in the project has this title; prints "<id> <public link>"; safe to rerun')
	.argument('<project>', 'project name or id')
	.argument('<title>')
	.argument('[notes]')
	.option('--section <id>', 'section id')
	.option('--parent <id>', 'parent task id')
	.action(async (project, title, notes, options) => {
		const pid = projectId(await view(), project);
		const find = async () =>
			(await view()).tasks.find(t => t.projectId === pid && t.title === title && t.completedAt === null)?.id;
		const body = {
			projectId: pid,
			title,
			...(notes && { notes }),
			...(options.section && { sectionId: options.section }),
			...(options.parent && { parentId: options.parent }),
		};
		const post = async () => (await api<{ id: string }>('POST', '/tasks', body)).id;
		// A failed POST may still have created the task, so look again before the one retry.
		const id = (await find()) ?? (await post().catch(find)) ?? (await post());
		console.log(`${id} ${await link(id)}`);
	});

program
	.command('complete')
	.summary('comment the PR on the task, then complete it; safe to rerun')
	.description('comment "<pr>\\n<note>" on the task, then complete it; safe to rerun')
	.argument('<task>', 'task id')
	.argument('<pr>', 'pr url')
	.argument('[note]', 'second line of the comment')
	.action((task, pr, note) => complete(task, pr, note ?? ''));

program
	.command('merged')
	.summary('complete each task with the PR, then tear down the worktree; safe to rerun')
	.description("complete each task with the PR, then run the repo config's teardown on the worktree; safe to rerun")
	.argument('<pr>', 'pr url')
	.argument('<worktree>', 'worktree path')
	.argument('<task...>', 'task ids')
	.option('--note <text>', 'second line of each completion comment')
	.action(async (pr, worktree, tasks, options) => {
		for (const task of tasks) await complete(task, pr, options.note ?? '');
		// Teardown removes the worktree, so a rerun after it finished finds nothing left to remove.
		if (existsSync(worktree)) {
			const config = loadConfig();
			const teardown = Bun.spawnSync(['sh', '-c', `${config.teardown} "$1"`, 'teardown', worktree], {
				cwd: config.repo,
				stderr: 'inherit',
			});
			console.log(teardown.stdout.toString().trim().split('\n').at(-1));
			if (teardown.exitCode !== 0) process.exit(teardown.exitCode);
		}
	});

for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
	program
		.command(method)
		.description(`raw ${method} call${method === 'GET' ? '; `pm GET /docs/agent` is the full API guide' : ''}`)
		.argument('<path>', 'e.g. /view')
		.argument('[body]', 'JSON body, or - to read it from stdin')
		.action(async (path, body) => {
			const res = await call(method, path, body === '-' ? await Bun.stdin.text() : body);
			process.stdout.write(await res.text());
		});

await program.parseAsync().catch((error: Error) => fail(error.message));
