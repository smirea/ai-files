#!/usr/bin/env bash
# Links this repo's agent files into every place the agent tools read them. Safe to rerun.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

link() {
	local source="$repo/$1" target="$2"
	[ -e "$source" ] || { echo "missing $source" >&2; exit 1; }
	if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
		echo "ok      $target"
		return
	fi
	mkdir -p "$(dirname "$target")"
	if [ -L "$target" ]; then
		rm "$target"
	elif [ -e "$target" ]; then
		if diff -rq "$source" "$target" >/dev/null 2>&1; then
			trash "$target"
		else
			trash "$target"
			echo "trashed $target (it differed from the repo's copy; restore it from the Trash if it held anything new)"
		fi
	fi
	ln -s "$source" "$target"
	echo "linked  $target -> $source"
}

link GLOBAL_AGENTS.md ~/.claude/CLAUDE.md
link GLOBAL_AGENTS.md ~/.codex/AGENTS.md
link GLOBAL_AGENTS.md ~/.config/opencode/AGENTS.md
link GLOBAL_AGENTS.md ~/.gemini/GEMINI.md
link GLOBAL_AGENTS.md ~/code/AGENTS.md
link claude/pstack-models.md ~/.claude/pstack-models.md
link claude/hooks/no-agent-worktree.sh ~/.claude/hooks/no-agent-worktree.sh

# Claude Code reads ~/.claude/skills; Codex reads ~/.agents/skills (and ~/.codex/skills, skipped so it doesn't list each skill twice).
for skill in "$repo"/skills/*/; do
	name="$(basename "$skill")"
	link "skills/$name" ~/.claude/skills/"$name"
	link "skills/$name" ~/.agents/skills/"$name"
done

if [ ! -f "$repo/.env.local" ]; then
	(cd "$repo" && env-manager down)
fi
