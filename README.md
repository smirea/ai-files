# ai-files

My global agent instructions and skills, linked into every agent tool on this machine.

```bash
./setup.sh
```

It symlinks each file to where the tools read it and pulls `.env.local` from env-manager on first run. It is safe to rerun. A real file in a target's place goes to the Trash first.

| File | Linked to |
|---|---|
| `GLOBAL_AGENTS.md` | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/GEMINI.md` |
| `claude/pstack-models.md` | `~/.claude/pstack-models.md` (imported by `GLOBAL_AGENTS.md`) |
| `claude/hooks/*` | `~/.claude/hooks/` (`setup.sh` also registers each in `~/.claude/settings.json`) |
| `skills/<name>/` | `~/.claude/skills/<name>` (Claude Code), `~/.agents/skills/<name>` (Codex) |

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
Decision docs, natural areas, shared work, human-only tasks, post-merge checks, known shared failures.

# Worker
Setup, verification, PR, and after-merge rules for this repo. Wins over the shared brief.
```

Run `bun ~/code/ai-files/skills/task-orchestrator/scripts/pm.ts check` from the repo's main checkout to validate it. `skills/task-orchestrator/scripts/pm.ts` reads the ProcrastiMate token from env-manager (`PROCRASTIMATE_TOKEN` in this repo's `.env.local`).
