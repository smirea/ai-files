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
link t3-pstack/models.md ~/.config/t3-pstack/models.md
# Older t3-pstack releases read the sheet from each host's config dir.
link t3-pstack/models.md ~/.claude/t3-pstack-models.md
link t3-pstack/models.md ~/.codex/t3-pstack-models.md
link claude/hooks/no-agent-worktree.sh ~/.claude/hooks/no-agent-worktree.sh
link claude/hooks/no-hook-skipping.ts ~/.claude/hooks/no-hook-skipping.ts

register_hook() {
	local settings=~/.claude/settings.json matcher="$1" command="$2"
	[ -f "$settings" ] || echo '{}' > "$settings"
	if jq -e --arg c "$command" 'any(.hooks.PreToolUse[]?.hooks[]?; .command == $c)' "$settings" >/dev/null; then
		echo "ok      hook $command"
		return
	fi
	jq --arg m "$matcher" --arg c "$command" '.hooks.PreToolUse += [{matcher: $m, hooks: [{type: "command", command: $c}]}]' "$settings" > "$settings.tmp"
	mv "$settings.tmp" "$settings"
	echo "added   hook $command"
}

register_hook 'Agent|Task' '$HOME/.claude/hooks/no-agent-worktree.sh'
register_hook Bash 'bun --no-env-file "$HOME/.claude/hooks/no-hook-skipping.ts"'

# Claude Code reads ~/.claude/skills; Codex reads ~/.agents/skills (and ~/.codex/skills, skipped so it doesn't list each skill twice).
for skill in "$repo"/skills/*/; do
	name="$(basename "$skill")"
	link "skills/$name" ~/.claude/skills/"$name"
	link "skills/$name" ~/.agents/skills/"$name"
done

# Installs or updates the t3-pstack plugin in every Claude Code and Codex home T3 runs, and trusts its Codex hook.
# npm 12 refuses git packages unless --allow-git is passed.
npx --allow-git=all -y github:chhoumann/t3-pstack install
