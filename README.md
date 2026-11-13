# ai-files

My global agent instructions and skills, linked into every agent tool on this machine.

```bash
./setup.sh
```

It symlinks each file to where the tools read it It is safe to rerun. A real file in a target's place goes to the Trash first.

| File | Linked to |
|---|---|
| `GLOBAL_AGENTS.md` | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/GEMINI.md` |
| `t3-pstack/models.md` | `~/.config/t3-pstack/models.md`, `~/.claude/t3-pstack-models.md`, `~/.codex/t3-pstack-models.md` (t3-pstack's model sheet; `setup.sh` also installs the [t3-pstack](https://github.com/chhoumann/t3-pstack) plugin) |
| `claude/hooks/*` | `~/.claude/hooks/` (`setup.sh` also registers each in `~/.claude/settings.json`) |
| `skills/<name>/` | `~/.claude/skills/<name>` (Claude Code), `~/.agents/skills/<name>` (Codex) |
| `t3/settings.json`, `t3/client-settings.json`, `t3/keybindings.json` | `~/.t3/userdata/` (T3 Code's server settings, app settings, and keybindings) |
| `t3/pre-commit` | `.git/hooks/pre-commit` (runs `t3/sync.ts check-secrets`) |

## T3 Code

`setup.sh` links T3 Code's settings into `t3/`, so a change made in the T3 UI on any machine shows up here as a diff to commit. T3 writes through the links and reloads `settings.json` and `keybindings.json` when they change. It reads `client-settings.json` only at launch: after pulling a change to it, restart T3 Code. Otherwise the next UI change on that machine writes its old copy back.

Then `setup.sh` runs `t3/sync.ts apply` for what can't be a link:

- **Project overrides.** T3 keys `projectSettingsOverrides` and `projectAutoPullOverrides` by project id, and each machine gives the same repo a different id. `t3/projects.json` maps each machine's ids to a hash of the project's path. `apply` copies another machine's overrides to this machine's id for the same path, and warns when two copies differ.
- **Desktop settings.** `t3/desktop-settings.json` holds the shared keys of `~/.t3/userdata/desktop-settings.json` (the rest is window placement). The app rewrites that file from memory, so `apply` merges these keys only while T3 Code is quit.
- **Secrets.** The repo is public. T3 moves secrets into its secret store and leaves `""` or `••••••` in the file. `apply` and the pre-commit hook refuse any other value in a secret field.
- **Providers.** `apply` warns when an enabled provider's binary is not on T3's PATH.

`t3/sync.ts apply --dry-run` prints what would change.

A new skill only needs a folder under `skills/` and a rerun of `setup.sh`. A new link target goes in `setup.sh`.

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
