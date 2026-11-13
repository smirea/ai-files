# ai-files

My global agent instructions and skills, linked into every agent tool on this machine.

```bash
./setup.sh
```

It symlinks each file to where the tools read it, installs the global skills, and syncs T3 Code's settings. It is safe to rerun. A real file in a target's place goes to the Trash first.

| File | Linked to |
|---|---|
| `GLOBAL_AGENTS.md` | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/GEMINI.md` |
| `t3-pstack/models.md` | `~/.config/t3-pstack/models.md`, `~/.claude/t3-pstack-models.md`, `~/.codex/t3-pstack-models.md` (t3-pstack's model sheet) |
| `claude/hooks/*` | `~/.claude/hooks/` (`setup.sh` also registers each in `~/.claude/settings.json`) |
| `t3/client-settings.json`, `t3/keybindings.json` | `~/.t3/userdata/` (T3 Code's app settings and keybindings) |
| `t3/pre-commit` | `.git/hooks/pre-commit` (runs `t3/sync.ts check-secrets`) |

## Skills

`./setup-skills.ts` (run by `setup.sh`) sets up the skills every T3 Code provider reads, and keeps them updated:

| Skills | Installed as |
|---|---|
| `skills/<name>/` (personal: `task-orchestrator`, `x-twitter`) | links in `~/.claude/skills` (Claude Code), `~/.agents/skills` (Codex, Cursor, OpenCode), `~/.gemini/config/skills` (Antigravity) |
| [t3-pstack](https://github.com/chhoumann/t3-pstack) | Claude Code and Codex plugin, through its own installer |
| Cloudflare ([cloudflare/skills](https://github.com/cloudflare/skills)), `untangle-codebase` ([caldoai/skills](https://github.com/caldoai/skills)), Sentry | Claude Code and Codex plugins |
| `frontend-design` | Claude Code plugin (turned off in Codex) |
| `cua-driver` | `cua-driver skills install`, which links its pack into each agent |

Each run updates the marketplaces and plugins, and moves anything else in those skill directories to the Trash, along with any plugin or marketplace the script doesn't list. It leaves Codex's built-in `openai-*` plugins and Claude Code's `~/.claude/skills/synced` (skills synced from claude.ai) alone. To add a skill, add its plugin and marketplace to `setup-skills.ts`, or a folder under `skills/`, and rerun. `--dry-run` prints what would change.

## T3 Code

T3 Code keeps its setup in `~/.t3/userdata/`. `setup.sh` links `client-settings.json` and `keybindings.json` into `t3/`, so a change made in the T3 UI shows up here as a diff to commit. T3 reloads `keybindings.json` when it changes. It reads `client-settings.json` only at launch: after pulling a change to it, restart T3 Code. Otherwise the next UI change on that machine writes its old copy back.

`settings.json` can't be a link. Its project overrides are keyed by project id, each machine gives the same repo a different id, and T3 deletes overrides for ids it doesn't know. `t3/sync.ts` copies it instead:

- `t3/sync.ts capture` copies this machine's `settings.json` into `t3/settings.json`, and its project overrides into `t3/projects.json`, keyed by a hash of each project's path. Run it after changing T3 settings, then commit.
- `t3/sync.ts apply` writes them back into this machine's `settings.json` under its own project ids, and keeps the old file as `settings.json.bak-<time>`. `setup.sh` runs it, so after pulling, rerun `./setup.sh`. A change that was never captured is overwritten (it stays in the backup).

`apply` also:

- merges `t3/desktop-settings.json`, the shared keys of `~/.t3/userdata/desktop-settings.json` (the rest is window placement). The app rewrites that file from memory, so `apply` merges them only while T3 Code is quit.
- warns when an enabled provider's binary is not on T3's PATH.

The repo is public. T3 moves secrets into its secret store and leaves `""` or `••••••` in the file. `capture`, `apply`, and the pre-commit hook refuse any other value in a secret field. Add `--dry-run` to `capture` or `apply` to print what would change.

## task-orchestrator

`/task-orchestrator` works a repo's ProcrastiMate backlog through T3 Code child tasks. The skill and the worker brief are shared. Each repo that uses it adds `.agents/task-orchestrator.md`:

```md
---
project: <ProcrastiMate project name>
gc: <command that prunes merged worktrees>
teardown: <command that removes one worktree, given its path>
ship: <command that drives a PR to merge; last line `pr-ship exit <0-3>`>
---

# Orchestrator
Decision docs, natural areas, shared work, human-only tasks, known shared failures.

# Worker
Setup, verification, PR, and after-merge rules for this repo, including the post-merge runs a child waits on. Wins over the shared brief.
```

Run `~/code/ai-files/skills/task-orchestrator/scripts/check-config.ts` from the repo's main checkout to validate it. The skill reaches ProcrastiMate through `procrastimate`, a CLI on PATH from `~/code/scripts`.
